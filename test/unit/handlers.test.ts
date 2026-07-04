import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('fs')
vi.mock('child_process', () => ({ execFile: vi.fn() }))
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showQuickPick: vi.fn(),
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
  },
  workspace: { workspaceFolders: null },
  extensions: { getExtension: vi.fn() },
}))

import { handlers } from '../../src/handlers'
import vscode from 'vscode'

const mockFs = fs as jest.Mocked<typeof fs>
const mockVscode = vscode as jest.Mocked<typeof vscode>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('destructive safety gate', () => {
  const ctx = { workspaceRoot: '/repo' }

  const h5 = handlers.find(h => h.id === 'h5-undo-last-commit')!
  const h9 = handlers.find(h => h.id === 'h9-force-push')!

  it('handler #5: step 1 cancel = no command runs', async () => {
    const { execFile } = await import('child_process')
    const mockExec = execFile as unknown as ReturnType<typeof vi.fn>

    ;(mockVscode.window.showWarningMessage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Cancel')  // log query
      .mockResolvedValueOnce('Cancel')  // step 1

    await h5.handle(ctx)
    expect(mockExec).not.toHaveBeenCalledWith(
      'git', expect.arrayContaining(['reset']), expect.anything(), expect.anything()
    )
  })

  it('handler #5: step 2 cancel after step 1 confirm = no command runs', async () => {
    const { execFile } = await import('child_process')
    const mockExec = execFile as unknown as ReturnType<typeof vi.fn>

    mockExec.mockImplementation((_: string, args: string[], __: unknown, cb: Function) => {
      if (args.includes('log')) cb(null, { stdout: 'abc123 test commit\n', stderr: '' })
      else cb(new Error('not called'))
    })

    ;(mockVscode.window.showWarningMessage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Yes')    // step 1
      .mockResolvedValueOnce('Cancel') // step 2

    await h5.handle(ctx)
    expect(mockExec).not.toHaveBeenCalledWith(
      'git', ['reset', 'HEAD~1'], expect.anything(), expect.anything()
    )
  })

  it('handler #5: both confirmed = exactly one git reset HEAD~1', async () => {
    const { execFile } = await import('child_process')
    const mockExec = execFile as unknown as ReturnType<typeof vi.fn>

    mockExec.mockImplementation((_: string, args: string[], __: unknown, cb: Function) => {
      cb(null, { stdout: 'abc123 test commit\n', stderr: '' })
    })

    ;(mockVscode.window.showWarningMessage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Yes')     // step 1
      .mockResolvedValueOnce('Execute') // step 2

    await h5.handle(ctx)

    const resetCalls = (mockExec.mock.calls as unknown as string[][][]).filter(
      ([, args]) => args[0] === 'reset' && args[1] === 'HEAD~1'
    )
    expect(resetCalls).toHaveLength(1)
  })

  it('handler #9: both confirmed = exactly one force push call', async () => {
    const { execFile } = await import('child_process')
    const mockExec = execFile as unknown as ReturnType<typeof vi.fn>

    // Mock upstream lookup: @{u} returns origin/main
    mockExec.mockImplementation((_: string, args: string[], __: unknown, cb: Function) => {
      if (args.includes('@{u}')) cb(null, { stdout: 'origin/main\n', stderr: '' })
      else cb(null, { stdout: '', stderr: '' })
    })

    ;(mockVscode.window.showWarningMessage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('Yes')     // step 1
      .mockResolvedValueOnce('Execute') // step 2

    await h9.handle(ctx)

    const pushCalls = (mockExec.mock.calls as unknown as string[][][]).filter(
      ([, args]) => args[0] === 'push' && args.includes('--force-with-lease')
    )
    expect(pushCalls).toHaveLength(1)
    expect(pushCalls[0][1]).toEqual(['push', '--force-with-lease', 'origin', 'main'])
  })

  it('handler #9: step 2 only reachable after step 1 confirmed', async () => {
    const { execFile } = await import('child_process')
    const mockExec = execFile as unknown as ReturnType<typeof vi.fn>

    mockExec.mockImplementation((_: string, args: string[], __: unknown, cb: Function) => {
      if (args.includes('@{u}')) cb(null, { stdout: 'origin/main\n', stderr: '' })
      else cb(null, { stdout: '', stderr: '' })
    })

    const showWarning = mockVscode.window.showWarningMessage as ReturnType<typeof vi.fn>
    showWarning.mockResolvedValueOnce('Cancel') // step 1 rejected

    await h9.handle(ctx)
    // step 2 should never have been called
    expect(showWarning).toHaveBeenCalledTimes(1)
  })
})
