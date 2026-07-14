import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vscode', () => ({ workspace: { getConfiguration: () => ({ get: (_k: string, d: unknown) => d }) } }))
vi.mock('../../src/groq', async (orig) => ({
  ...(await orig<typeof import('../../src/groq')>()),
  chatCompletion: vi.fn(),
}))
vi.mock('../../src/git', () => ({ git: vi.fn() }))
vi.mock('../../src/companion', () => ({
  getRepositorySnapshot: vi.fn(async () => null),
  guidanceFor: vi.fn(() => ({ title: 't', summary: 's', nextStep: 'n' })),
}))

import { answerTurn, parseAnswer, sanitizeText, runSuggestedCommand } from '../../src/aiChat'
import { chatCompletion, GroqError } from '../../src/groq'
import { git } from '../../src/git'

type Fn = ReturnType<typeof vi.fn>
const mockChat = chatCompletion as unknown as Fn
const mockGit = git as unknown as Fn

beforeEach(() => {
  vi.clearAllMocks()
  mockGit.mockResolvedValue({ stdout: 'out', stderr: '' })
})

describe('sanitizeText', () => {
  it('strips leaked <function> tool-call syntax', () => {
    expect(sanitizeText('hi <function=run_git_command>{"argv":["status"]}</function> there')).toBe('hi  there')
    expect(sanitizeText('<function=x>')).toBe('')
  })
})

describe('parseAnswer', () => {
  it('parses a valid structured answer and strips leading "git"', () => {
    const a = parseAnswer(JSON.stringify({
      answer: 'Your repo has changes.',
      commands: [{ command: 'git status', explanation: 'shows changes' }, { command: 'add .', explanation: 'stage' }],
      terms: [{ term: 'staging area', definition: 'where changes wait' }],
    }))
    expect(a.answer).toBe('Your repo has changes.')
    expect(a.commands[0].command).toBe('status') // leading "git" stripped
    expect(a.commands[1].command).toBe('add .')
    expect(a.terms).toHaveLength(1)
  })

  it('caps terms at 2', () => {
    const a = parseAnswer(JSON.stringify({
      answer: 'x', commands: [],
      terms: [{ term: 'a', definition: '1' }, { term: 'b', definition: '2' }, { term: 'c', definition: '3' }],
    }))
    expect(a.terms).toHaveLength(2)
  })

  it('degrades to prose when the content is not JSON', () => {
    const a = parseAnswer('just some plain text, no json here')
    expect(a.answer).toContain('plain text')
    expect(a.commands).toEqual([])
  })

  it('recovers a JSON object embedded in surrounding text', () => {
    const a = parseAnswer('Sure! {"answer":"hi","commands":[],"terms":[]} done')
    expect(a.answer).toBe('hi')
  })

  it('sanitizes function-call leakage inside fields', () => {
    const a = parseAnswer(JSON.stringify({ answer: 'ok <function=x>{}</function>', commands: [], terms: [] }))
    expect(a.answer).toBe('ok')
  })
})

describe('answerTurn', () => {
  it('returns a parsed answer and appends to history', async () => {
    mockChat.mockResolvedValueOnce({ content: JSON.stringify({ answer: 'hello', commands: [], terms: [] }) })
    const r = await answerTurn({ apiKey: 'k', model: 'm', workspaceRoot: '/repo', history: [], userMessage: 'hi' })
    expect(r.answer.answer).toBe('hello')
    expect(r.error).toBeUndefined()
    expect(r.history.some(h => h.role === 'user')).toBe(true)
    expect(r.history.some(h => h.role === 'assistant')).toBe(true)
    // JSON mode requested
    expect(mockChat.mock.calls[0][0].responseFormat).toEqual({ type: 'json_object' })
  })

  it('surfaces a GroqError as result.error', async () => {
    mockChat.mockRejectedValueOnce(new GroqError('bad key', 'auth', 401))
    const r = await answerTurn({ apiKey: 'k', model: 'm', workspaceRoot: '/repo', history: [], userMessage: 'hi' })
    expect(r.error).toMatchObject({ message: 'bad key', kind: 'auth' })
  })
})

describe('runSuggestedCommand', () => {
  const confirmYes = vi.fn(async () => true)
  const confirmNo = vi.fn(async () => false)

  it('runs a read command and returns its output', async () => {
    mockGit.mockResolvedValueOnce({ stdout: 'clean tree', stderr: '' })
    const r = await runSuggestedCommand('status', '/repo', confirmYes)
    expect(r.klass).toBe('read')
    expect(r.ok).toBe(true)
    expect(mockGit).toHaveBeenCalledWith('/repo', ['status'])
    expect(r.output).toBe('clean tree')
  })

  it('surfaces the real error on a failed read (no opaque "command failed")', async () => {
    mockGit.mockRejectedValueOnce({ stderr: 'fatal: not a git repository' })
    const r = await runSuggestedCommand('status', '/repo', confirmYes)
    expect(r.ok).toBe(false)
    expect(r.output).toContain('not a git repository')
  })

  it('gates a mutating command on confirm and runs it when accepted', async () => {
    const r = await runSuggestedCommand('commit -m "x"', '/repo', confirmYes)
    expect(r.klass).toBe('mutating')
    expect(confirmYes).toHaveBeenCalled()
    expect(mockGit).toHaveBeenCalled()
    expect(r.ok).toBe(true)
  })

  it('runs NOTHING when a mutating command is declined', async () => {
    const r = await runSuggestedCommand('commit -m "x"', '/repo', confirmNo)
    expect(mockGit).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    expect(r.output).toMatch(/cancelled/i)
  })

  it('refuses a blocked command — never runs it', async () => {
    const r = await runSuggestedCommand('push --force', '/repo', confirmYes)
    expect(r.klass).toBe('blocked')
    expect(mockGit).not.toHaveBeenCalled()
    expect(r.output).toMatch(/copy/i)
  })

  it('strips a leading "git" from the suggested command', async () => {
    await runSuggestedCommand('git status', '/repo', confirmYes)
    expect(mockGit).toHaveBeenCalledWith('/repo', ['status'])
  })
})
