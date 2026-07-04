import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import * as vscode from 'vscode'
import { execFile } from 'child_process'

type Fn = ReturnType<typeof vi.fn>
type CbExec = (cmd: string, args: string[], opts: unknown, cb: (e: Error | null, r?: { stdout: string; stderr: string }) => void) => void

const mockExec = execFile as unknown as Fn
const showWarning = (vscode.window.showWarningMessage as unknown) as Fn
const showQuickPick = (vscode.window.showQuickPick as unknown) as Fn
const createOutputChannel = (vscode.window.createOutputChannel as unknown) as Fn

// Default execFile: always invoke the callback so promisify(execFile) resolves.
// resetAllMocks (not clearAllMocks) is required — it wipes the mockResolvedValueOnce
// queue too, so queued dialog answers can't leak between tests.
function setExec(impl: CbExec): void {
  mockExec.mockImplementation(impl as unknown as (...a: unknown[]) => void)
}

beforeEach(() => {
  vi.resetAllMocks()
  createOutputChannel.mockReturnValue({ appendLine: vi.fn() })
  setExec((_cmd, _args, _opts, cb) => cb(null, { stdout: '', stderr: '' }))
})

function resetCalls(): string[][] {
  return (mockExec.mock.calls as unknown as unknown[][])
    .map(call => call[1] as string[])
}

describe('destructive safety gate', () => {
  const ctx = { workspaceRoot: '/repo' }

  const h5 = handlers.find(h => h.id === 'h5-undo-last-commit')!
  const h9 = handlers.find(h => h.id === 'h9-force-push')!

  it('handler #5: step 1 cancel = no command runs', async () => {
    setExec((_c, args, _o, cb) => cb(null, { stdout: 'abc123 test commit\n', stderr: '' }))
    showWarning.mockResolvedValueOnce('Cancel') // step 1 rejected

    await h5.handle(ctx)

    const resets = resetCalls().filter(a => a[0] === 'reset')
    expect(resets).toHaveLength(0)
  })

  it('handler #5: step 2 cancel after step 1 confirm = no command runs', async () => {
    setExec((_c, _a, _o, cb) => cb(null, { stdout: 'abc123 test commit\n', stderr: '' }))
    showWarning
      .mockResolvedValueOnce('Yes')    // step 1
      .mockResolvedValueOnce('Cancel') // step 2

    await h5.handle(ctx)

    const resets = resetCalls().filter(a => a[0] === 'reset' && a[1] === 'HEAD~1')
    expect(resets).toHaveLength(0)
  })

  it('handler #5: both confirmed = exactly one git reset HEAD~1', async () => {
    setExec((_c, _a, _o, cb) => cb(null, { stdout: 'abc123 test commit\n', stderr: '' }))
    showWarning
      .mockResolvedValueOnce('Yes')     // step 1
      .mockResolvedValueOnce('Execute') // step 2

    await h5.handle(ctx)

    const resets = resetCalls().filter(a => a[0] === 'reset' && a[1] === 'HEAD~1')
    expect(resets).toHaveLength(1)
  })

  it('handler #9: both confirmed = exactly one force push call', async () => {
    setExec((_c, args, _o, cb) => {
      if (args.includes('@{u}')) cb(null, { stdout: 'origin/main\n', stderr: '' })
      else cb(null, { stdout: '', stderr: '' })
    })
    showWarning
      .mockResolvedValueOnce('Yes')     // step 1
      .mockResolvedValueOnce('Execute') // step 2

    await h9.handle(ctx)

    const pushes = resetCalls().filter(a => a[0] === 'push' && a.includes('--force-with-lease'))
    expect(pushes).toHaveLength(1)
    expect(pushes[0]).toEqual(['push', '--force-with-lease', 'origin', 'main'])
  })

  it('handler #9: step 2 only reachable after step 1 confirmed', async () => {
    setExec((_c, args, _o, cb) => {
      if (args.includes('@{u}')) cb(null, { stdout: 'origin/main\n', stderr: '' })
      else cb(null, { stdout: '', stderr: '' })
    })
    showWarning.mockResolvedValueOnce('Cancel') // step 1 rejected

    await h9.handle(ctx)

    // confirmDestructive returns after step 1 = only one dialog shown
    expect(showWarning).toHaveBeenCalledTimes(1)
    const pushes = resetCalls().filter(a => a[0] === 'push')
    expect(pushes).toHaveLength(0)
  })

  it('handler #9 not reachable without upstream (safety)', async () => {
    setExec((_c, _a, _o, cb) => cb(new Error('no upstream')))
    void showQuickPick

    await h9.handle(ctx)

    const pushes = resetCalls().filter(a => a[0] === 'push')
    expect(pushes).toHaveLength(0)
  })
})
