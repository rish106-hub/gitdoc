// AI chat brain for the "Ask AI" panel.
//
// Design: the model returns ONE structured JSON answer per turn (no tool
// calling — that path was flaky: llama sometimes emitted `<function=…>` tool
// calls as plain text that leaked into chat). The webview renders the JSON into
// a fixed learner layout, and every git command gets a click-to-run button.
// Nothing runs until the learner clicks Run, and every run still goes through
// the commandGuard + two-step confirm.

import { chatCompletion, ChatMessage, GroqError } from './groq'
import { classifyProposedCommand, blockedReason, CommandClass } from './commandGuard'
import { git } from './git'
import { previewCommand } from './ui'
import { getRepositorySnapshot, guidanceFor } from './companion'

const OUTPUT_LIMIT = 4000 // chars of git output kept for context / display

/** The structured answer the model must return, rendered into the learner UI. */
export interface ChatAnswer {
  /** 1–2 short, plain sentences — no jargon */
  answer: string
  /** git commands that help; `command` is argv-style WITHOUT the leading "git" */
  commands: { command: string; explanation: string }[]
  /** 1–2 real professional git terms with a one-line plain definition */
  terms: { term: string; definition: string }[]
}

export interface AnswerTurnParams {
  apiKey: string
  model: string
  workspaceRoot: string
  history: ChatMessage[]
  userMessage: string
  signal?: AbortSignal
}

export interface AnswerTurnResult {
  answer: ChatAnswer
  history: ChatMessage[]
  error?: { message: string; kind?: string }
}

/** Strip any tool-call / function-call syntax the model might leak into prose. */
export function sanitizeText(s: string): string {
  return (s ?? '')
    .replace(/<function[^>]*>[\s\S]*?<\/function>/gi, '')
    .replace(/<function[^>]*>/gi, '')
    .replace(/<\/?tool_call>/gi, '')
    .trim()
}

function systemPrompt(workspaceRoot: string): Promise<ChatMessage> {
  return getRepositorySnapshot(workspaceRoot)
    .then(snap => {
      const g = guidanceFor(snap)
      const state = snap
        ? `Current repo — ${g.title}: ${g.summary} (branch: ${snap.branch ?? 'detached'}, staged: ${snap.staged}, modified: ${snap.unstaged}, untracked: ${snap.untracked}, conflicts: ${snap.conflicts}, ahead: ${snap.ahead}, behind: ${snap.behind}${snap.operation ? ', ' + snap.operation + ' in progress' : ''}).`
        : 'Repository state is unavailable.'
      return sysMsg(state)
    })
    .catch(() => sysMsg('Repository state is unavailable.'))
}

function sysMsg(state: string): ChatMessage {
  return {
    role: 'system',
    content:
      'You are GitRescue, a git tutor for absolute beginners. ' +
      'Respond with ONLY a JSON object, no prose outside it, matching exactly:\n' +
      '{"answer": string, "commands": [{"command": string, "explanation": string}], "terms": [{"term": string, "definition": string}]}\n' +
      '- "answer": 1–2 short, plain sentences. No jargon. Speak to a first-time git user.\n' +
      '- "commands": the git command(s) that help, MOST RELEVANT FIRST. "command" is the part AFTER the word "git" (e.g. "status", "add ." , "commit -m \\"message\\""). "explanation" is 8 words or fewer. Never include force pushes, hard resets, history rewrites, or file deletion. Use [] if no command is needed.\n' +
      '- "terms": exactly 1 or 2 REAL professional git terms relevant to the answer (e.g. staging area, upstream, detached HEAD, fast-forward, HEAD, remote), each with a one-line plain definition.\n' +
      'Never wrap commands in <function> tags or put them in "answer" — they belong only in the "commands" array.\n' +
      state,
  }
}

const FALLBACK: ChatAnswer = { answer: '', commands: [], terms: [] }

/** Run one turn: returns a structured ChatAnswer plus updated history. */
export async function answerTurn(params: AnswerTurnParams): Promise<AnswerTurnResult> {
  const { apiKey, model, workspaceRoot, userMessage, history, signal } = params
  const convo: ChatMessage[] = [...history, { role: 'user', content: userMessage }]
  try {
    const system = await systemPrompt(workspaceRoot)
    const reply = await chatCompletion({
      apiKey, model,
      messages: [system, ...convo],
      responseFormat: { type: 'json_object' },
      signal,
    })
    const raw = reply.content ?? ''
    const answer = parseAnswer(raw)
    convo.push({ role: 'assistant', content: raw })
    return { answer, history: capHistory(convo) }
  } catch (e) {
    const err = e instanceof GroqError
      ? { message: e.message, kind: e.kind }
      : { message: (e as Error).message }
    return { answer: FALLBACK, history, error: err }
  }
}

/** Parse the model's JSON into a ChatAnswer, tolerating minor drift. */
export function parseAnswer(raw: string): ChatAnswer {
  let obj: Record<string, unknown> | undefined
  try {
    obj = JSON.parse(raw) as Record<string, unknown>
  } catch {
    // Not JSON — try to recover a JSON object embedded in text, else show as prose.
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) { try { obj = JSON.parse(m[0]) as Record<string, unknown> } catch { /* fall through */ } }
    if (!obj) return { answer: sanitizeText(raw) || 'Sorry, I could not produce an answer.', commands: [], terms: [] }
  }
  const commands = Array.isArray(obj.commands)
    ? obj.commands
        .map(c => ({
          command: sanitizeText(String((c as { command?: unknown }).command ?? '')).replace(/^git\s+/, ''),
          explanation: sanitizeText(String((c as { explanation?: unknown }).explanation ?? '')),
        }))
        .filter(c => c.command.length > 0)
    : []
  const terms = Array.isArray(obj.terms)
    ? obj.terms
        .map(t => ({
          term: sanitizeText(String((t as { term?: unknown }).term ?? '')),
          definition: sanitizeText(String((t as { definition?: unknown }).definition ?? '')),
        }))
        .filter(t => t.term.length > 0)
        .slice(0, 2)
    : []
  return { answer: sanitizeText(String(obj.answer ?? '')), commands, terms }
}

export interface RunResult {
  ok: boolean
  klass: CommandClass
  output: string
}

/**
 * Click-to-run executor. Normalizes a command string/argv, classifies it, and:
 *   read     -> run, surfacing the real error on failure
 *   mutating -> two-step confirm, then run
 *   blocked  -> never run; return the reason + copy-paste guidance
 */
export async function runSuggestedCommand(
  command: string | string[],
  workspaceRoot: string,
  confirm: (step1: string, step2: string) => Promise<boolean>,
  explanation = ''
): Promise<RunResult> {
  const argv = normalizeArgv(command)
  if (argv.length === 0) return { ok: false, klass: 'blocked', output: 'Empty command.' }

  const klass = classifyProposedCommand(argv)
  const pretty = previewCommand(argv)

  if (klass === 'blocked') {
    return { ok: false, klass, output: `Not run — ${blockedReason(argv)} Copy and run it yourself: ${pretty}` }
  }

  if (klass === 'read') {
    try {
      const res = await git(workspaceRoot, argv)
      return { ok: true, klass, output: (res.stdout || res.stderr || '(no output)').slice(0, OUTPUT_LIMIT) }
    } catch (e) {
      // Surface the REAL error instead of an opaque "(command failed)".
      return { ok: false, klass, output: gitErr(e) }
    }
  }

  // mutating -> two-step confirm
  const ok = await confirm(
    explanation ? `${explanation}\n\nRun this git command?` : 'Run this git command?',
    `Execute "${pretty}"?`
  )
  if (!ok) return { ok: false, klass, output: 'Cancelled — nothing was run.' }
  try {
    const res = await git(workspaceRoot, argv)
    return { ok: true, klass, output: (res.stdout || res.stderr || '(done)').slice(0, OUTPUT_LIMIT) }
  } catch (e) {
    return { ok: false, klass, output: gitErr(e) }
  }
}

/** Append a run outcome to history so follow-up turns have context. */
export function recordRun(history: ChatMessage[], command: string, result: RunResult): ChatMessage[] {
  return capHistory([
    ...history,
    { role: 'user', content: `[ran: git ${normalizeArgv(command).join(' ')}] -> ${result.ok ? 'ok' : 'failed'}: ${result.output.slice(0, 800)}` },
  ])
}

function normalizeArgv(command: string | string[]): string[] {
  if (Array.isArray(command)) return command.map(String).filter(Boolean)
  return command.trim().replace(/^git\s+/, '').split(/\s+/).filter(Boolean)
}

function gitErr(e: unknown): string {
  const err = e as { stderr?: string; message?: string }
  return (err.stderr || err.message || 'command failed').toString().slice(0, OUTPUT_LIMIT)
}

/** Keep history bounded so the context window doesn't grow without limit. */
function capHistory(convo: ChatMessage[], max = 20): ChatMessage[] {
  return convo.length <= max ? convo : convo.slice(convo.length - max)
}
