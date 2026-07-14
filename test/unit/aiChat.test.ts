import { describe, it, expect, vi, beforeEach } from 'vitest'

// vscode is pulled in transitively via ui.ts -> config.ts. Stub it.
vi.mock('vscode', () => ({ workspace: { getConfiguration: () => ({ get: (_k: string, d: unknown) => d }) } }))

// Keep GroqError real (instanceof check in aiChat), mock only the network call.
vi.mock('../../src/groq', async (orig) => ({
  ...(await orig<typeof import('../../src/groq')>()),
  chatCompletion: vi.fn(),
}))
vi.mock('../../src/git', () => ({ git: vi.fn(), gitSafe: vi.fn() }))
vi.mock('../../src/companion', () => ({
  getRepositorySnapshot: vi.fn(async () => null),
  guidanceFor: vi.fn(() => ({ title: 't', summary: 's', nextStep: 'n' })),
}))

import { runAgenticTurn, ChatEvent } from '../../src/aiChat'
import { chatCompletion, GroqError, ToolCall } from '../../src/groq'
import { git, gitSafe } from '../../src/git'

type Fn = ReturnType<typeof vi.fn>
const mockChat = chatCompletion as unknown as Fn
const mockGit = git as unknown as Fn
const mockGitSafe = gitSafe as unknown as Fn

function toolCall(argv: string[], rationale = 'because'): ToolCall {
  return { id: 'c1', type: 'function', function: { name: 'run_git_command', arguments: JSON.stringify({ argv, rationale }) } }
}

function run(over: Partial<Parameters<typeof runAgenticTurn>[0]> = {}) {
  const events: ChatEvent[] = []
  const confirm = over.confirm ?? vi.fn(async () => true)
  return {
    events,
    confirm,
    promise: runAgenticTurn({
      apiKey: 'k', model: 'm', workspaceRoot: '/repo', history: [],
      userMessage: 'hi', emit: (e) => events.push(e), confirm,
      ...over,
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGitSafe.mockResolvedValue({ stdout: 'clean', stderr: '' })
  mockGit.mockResolvedValue({ stdout: 'ok', stderr: '' })
})

describe('runAgenticTurn', () => {
  it('emits final assistant text when the model does not call tools', async () => {
    mockChat.mockResolvedValueOnce({ content: 'here is an answer', tool_calls: undefined })
    const { events, promise } = run()
    const history = await promise
    expect(events).toContainEqual({ type: 'assistant', text: 'here is an answer' })
    expect(mockChat).toHaveBeenCalledOnce()
    expect(history.some(m => m.role === 'user')).toBe(true)
  })

  it('auto-runs a read command without confirming', async () => {
    mockChat
      .mockResolvedValueOnce({ content: null, tool_calls: [toolCall(['status'])] })
      .mockResolvedValueOnce({ content: 'your repo is clean', tool_calls: undefined })
    const { events, confirm, promise } = run()
    await promise
    expect(mockGitSafe).toHaveBeenCalledWith('/repo', ['status'])
    expect(confirm).not.toHaveBeenCalled()
    expect(events.find(e => e.type === 'ran')).toMatchObject({ type: 'ran', ok: true })
    expect(events).toContainEqual({ type: 'assistant', text: 'your repo is clean' })
  })

  it('gates a mutating command on confirm and runs it when accepted', async () => {
    mockChat
      .mockResolvedValueOnce({ content: null, tool_calls: [toolCall(['commit', '-m', 'x'])] })
      .mockResolvedValueOnce({ content: 'committed', tool_calls: undefined })
    const confirm = vi.fn(async () => true)
    const { events, promise } = run({ confirm })
    await promise
    expect(confirm).toHaveBeenCalledOnce()
    expect(mockGit).toHaveBeenCalledWith('/repo', ['commit', '-m', 'x'])
    expect(events.find(e => e.type === 'ran')).toMatchObject({ ok: true })
  })

  it('runs NOTHING when the user declines a mutating command', async () => {
    mockChat
      .mockResolvedValueOnce({ content: null, tool_calls: [toolCall(['commit', '-m', 'x'])] })
      .mockResolvedValueOnce({ content: 'ok, skipped', tool_calls: undefined })
    const confirm = vi.fn(async () => false)
    const { events, promise } = run({ confirm })
    await promise
    expect(mockGit).not.toHaveBeenCalled()
    expect(events.some(e => e.type === 'declined')).toBe(true)
  })

  it('refuses a blocked command — never executes it, surfaces to user', async () => {
    mockChat
      .mockResolvedValueOnce({ content: null, tool_calls: [toolCall(['push', '--force'])] })
      .mockResolvedValueOnce({ content: 'I cannot force push for you', tool_calls: undefined })
    const confirm = vi.fn(async () => true)
    const { events, promise } = run({ confirm })
    await promise
    expect(mockGit).not.toHaveBeenCalled()
    expect(mockGitSafe).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(events.find(e => e.type === 'blocked')).toMatchObject({ type: 'blocked' })
  })

  it('stops after the step cap instead of looping forever', async () => {
    // Model keeps asking to run reads and never finishes.
    mockChat.mockResolvedValue({ content: null, tool_calls: [toolCall(['status'])] })
    const { events, promise } = run()
    await promise
    expect(events.some(e => e.type === 'error' && /too many steps/i.test(e.message))).toBe(true)
    expect(mockChat.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('maps a GroqError to an error event with its kind', async () => {
    mockChat.mockRejectedValueOnce(new GroqError('bad key', 'auth', 401))
    const { events, promise } = run()
    await promise
    expect(events).toContainEqual({ type: 'error', message: 'bad key', kind: 'auth' })
  })
})
