// The agentic loop behind the AI chat panel.
//
// Flow: user message -> Groq (with a single `run_git_command` tool) -> the model
// either answers in text or asks to run a git command. Every proposed command is
// classified by commandGuard (NOT by trusting the model), then:
//   read     -> run immediately (cannot mutate), feed output back
//   mutating -> two-step confirm; run only if the user accepts
//   blocked  -> never run; surfaced as copy-paste text
// Results are fed back and the loop continues until the model returns final text
// (bounded by MAX_STEPS).
//
// This is a NEW path, deliberately outside the deterministic handler registry
// and the rules classifier — those stay a fixed, audited whitelist.

import { chatCompletion, ChatMessage, ToolDef, GroqError } from './groq'
import { classifyProposedCommand, blockedReason } from './commandGuard'
import { git, gitSafe } from './git'
import { previewCommand } from './ui'
import { getRepositorySnapshot, guidanceFor } from './companion'

const MAX_STEPS = 6
const OUTPUT_LIMIT = 4000 // chars of git output fed back to the model

/** Events streamed to the UI as the turn progresses. */
export type ChatEvent =
  | { type: 'assistant'; text: string }
  | { type: 'ran'; command: string; ok: boolean; output: string }
  | { type: 'blocked'; command: string; reason: string }
  | { type: 'declined'; command: string }
  | { type: 'error'; message: string; kind?: string }

export interface AgenticTurnParams {
  apiKey: string
  model: string
  workspaceRoot: string
  /** prior LLM messages (system excluded — rebuilt each turn with fresh repo state) */
  history: ChatMessage[]
  userMessage: string
  /** UI sink for streaming events */
  emit: (event: ChatEvent) => void
  /** two-step confirm for mutating commands; returns true to execute */
  confirm: (step1: string, step2: string) => Promise<boolean>
  signal?: AbortSignal
}

const RUN_GIT_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'run_git_command',
    description:
      'Run a git command in the user\'s repository. Provide the arguments AFTER "git" as an array (e.g. ["status"], ["commit","-m","msg"]). Read-only commands run automatically; state-changing commands ask the user to confirm; dangerous/irreversible commands are refused and shown to the user to run manually. Always explain why in `rationale`.',
    parameters: {
      type: 'object',
      properties: {
        argv: {
          type: 'array',
          items: { type: 'string' },
          description: 'git arguments after the word "git", e.g. ["log","--oneline","-5"]',
        },
        rationale: {
          type: 'string',
          description: 'one short sentence: why this command helps the user right now',
        },
      },
      required: ['argv', 'rationale'],
    },
  },
}

async function buildSystemPrompt(workspaceRoot: string): Promise<ChatMessage> {
  let stateBlock = 'Repository state is unavailable.'
  try {
    const snap = await getRepositorySnapshot(workspaceRoot)
    const g = guidanceFor(snap)
    stateBlock = snap
      ? `Current repo state — ${g.title}: ${g.summary} (branch: ${snap.branch ?? 'detached'}, staged: ${snap.staged}, modified: ${snap.unstaged}, untracked: ${snap.untracked}, conflicts: ${snap.conflicts}, ahead: ${snap.ahead}, behind: ${snap.behind}${snap.operation ? ', operation: ' + snap.operation : ''}).`
      : stateBlock
  } catch {
    // best-effort context
  }
  return {
    role: 'system',
    content:
      'You are GitRescue, a friendly git assistant for beginners. Explain clearly and briefly, in plain English, avoiding jargon. ' +
      'When an action would help, use the run_git_command tool rather than telling the user to type commands. ' +
      'Prefer read-only commands (status, log, diff) to inspect the repo before proposing changes. ' +
      'Never propose force pushes, hard resets, history rewrites, or file deletion — those are refused automatically; if the user truly needs one, explain the risk and let them run it manually. ' +
      'Keep answers short. ' +
      stateBlock,
  }
}

/**
 * Run one user turn to completion, streaming events via `emit`. Returns the
 * updated history (user + assistant/tool messages appended) for the next turn.
 */
export async function runAgenticTurn(params: AgenticTurnParams): Promise<ChatMessage[]> {
  const { apiKey, model, workspaceRoot, userMessage, emit, confirm, signal } = params
  const system = await buildSystemPrompt(workspaceRoot)
  const convo: ChatMessage[] = [...params.history, { role: 'user', content: userMessage }]

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const reply = await chatCompletion({
        apiKey,
        model,
        messages: [system, ...convo],
        tools: [RUN_GIT_TOOL],
        signal,
      })

      // Record the assistant message (may carry text and/or tool calls).
      convo.push({ role: 'assistant', content: reply.content, tool_calls: reply.tool_calls })

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        if (reply.content) emit({ type: 'assistant', text: reply.content })
        return stripSystem(convo)
      }

      if (reply.content) emit({ type: 'assistant', text: reply.content })

      // Execute each tool call, appending a tool result message per call.
      for (const call of reply.tool_calls) {
        const toolResult = await handleToolCall(call, workspaceRoot, emit, confirm)
        convo.push({ role: 'tool', tool_call_id: call.id, content: toolResult })
      }
      // loop: feed results back to the model
    }
    emit({ type: 'error', message: 'Stopped after too many steps. Try rephrasing.' })
    return stripSystem(convo)
  } catch (e) {
    if (e instanceof GroqError) {
      emit({ type: 'error', message: e.message, kind: e.kind })
    } else {
      emit({ type: 'error', message: (e as Error).message })
    }
    return stripSystem(convo)
  }
}

async function handleToolCall(
  call: { id: string; function: { name: string; arguments: string } },
  workspaceRoot: string,
  emit: (event: ChatEvent) => void,
  confirm: (step1: string, step2: string) => Promise<boolean>
): Promise<string> {
  if (call.function.name !== 'run_git_command') {
    return `Unknown tool "${call.function.name}".`
  }

  let argv: string[]
  let rationale = ''
  try {
    const parsed = JSON.parse(call.function.arguments) as { argv?: unknown; rationale?: unknown }
    argv = Array.isArray(parsed.argv) ? parsed.argv.map(String) : []
    rationale = typeof parsed.rationale === 'string' ? parsed.rationale : ''
  } catch {
    return 'Could not parse the command arguments.'
  }

  const pretty = previewCommand(argv)
  const klass = classifyProposedCommand(argv)

  if (klass === 'blocked') {
    const reason = blockedReason(argv)
    emit({ type: 'blocked', command: pretty, reason })
    return `Refused to run "${pretty}" (${reason}). Shown to the user to run manually. Do not retry it; suggest a safer alternative if one exists.`
  }

  if (klass === 'read') {
    const res = await gitSafe(workspaceRoot, argv)
    const output = res ? (res.stdout || res.stderr || '(no output)') : '(command failed)'
    const clipped = output.slice(0, OUTPUT_LIMIT)
    emit({ type: 'ran', command: pretty, ok: !!res, output: clipped })
    return `Ran "${pretty}". Output:\n${clipped}`
  }

  // mutating → two-step confirm
  const ok = await confirm(
    rationale ? `${rationale}\n\nRun this git command?` : 'Run this git command?',
    `Execute "${pretty}"?`
  )
  if (!ok) {
    emit({ type: 'declined', command: pretty })
    return `The user declined to run "${pretty}". Do not retry it; ask what they'd like to do instead.`
  }
  try {
    const res = await git(workspaceRoot, argv)
    const output = (res.stdout || res.stderr || '(done)').slice(0, OUTPUT_LIMIT)
    emit({ type: 'ran', command: pretty, ok: true, output })
    return `Ran "${pretty}". Output:\n${output}`
  } catch (e) {
    const msg = (e as Error).message.slice(0, OUTPUT_LIMIT)
    emit({ type: 'ran', command: pretty, ok: false, output: msg })
    return `"${pretty}" failed: ${msg}`
  }
}

/** Drop nothing (system is never stored in history) — history is convo as-is. */
function stripSystem(convo: ChatMessage[]): ChatMessage[] {
  return convo.filter(m => m.role !== 'system')
}
