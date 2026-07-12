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
  workspace: {
    workspaceFolders: null,
    getConfiguration: vi.fn(() => ({ get: (_key: string, dflt: unknown) => dflt })),
  },
  extensions: { getExtension: vi.fn() },
}))

import { handlers } from '../../src/handlers'
import * as vscode from 'vscode'
import * as fs from 'fs'
import { execFile } from 'child_process'

type Fn = ReturnType<typeof vi.fn>
type CbExec = (cmd: string, args: string[], opts: unknown, cb: (e: Error | null, r?: { stdout: string; stderr: string }) => void) => void

const mockExec = execFile as unknown as Fn
const showWarning = (vscode.window.showWarningMessage as unknown) as Fn
const showInfo = (vscode.window.showInformationMessage as unknown) as Fn
const showQuickPick = (vscode.window.showQuickPick as unknown) as Fn
const createOutputChannel = (vscode.window.createOutputChannel as unknown) as Fn
const readFileSync = (fs.readFileSync as unknown) as Fn

// Default execFile: always invoke the callback so promisify(execFile) resolves.
// resetAllMocks (not clearAllMocks) is required — it wipes the mockResolvedValueOnce
// queue too, so queued dialog answers can't leak between tests.
function setExec(impl: CbExec): void {
  mockExec.mockImplementation(impl as unknown as (...a: unknown[]) => void)
}

beforeEach(() => {
  vi.resetAllMocks()
  createOutputChannel.mockReturnValue({ appendLine: vi.fn() })
  ;(vscode.workspace.getConfiguration as unknown as Fn).mockReturnValue({
    get: (_key: string, dflt: unknown) => dflt,
  })
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

describe('non-destructive handler fix logic', () => {
  const ctx = { workspaceRoot: '/repo' }
  const get = (id: string) => handlers.find(h => h.id === id)!

  /** Route execFile by args: conflicts, upstream, ahead/behind — else empty. */
  function routeExec(opts: { conflicts?: string[]; upstream?: string; ab?: [number, number] } = {}): void {
    setExec((_c, args, _o, cb) => {
      if (args[0] === 'diff' && args.includes('--diff-filter=U')) {
        return cb(null, { stdout: (opts.conflicts ?? []).join('\n'), stderr: '' })
      }
      if (args[0] === 'rev-parse' && args.includes('@{u}')) {
        return opts.upstream
          ? cb(null, { stdout: opts.upstream + '\n', stderr: '' })
          : cb(new Error('no upstream'))
      }
      if (args[0] === 'rev-list' && args.includes('--left-right')) {
        const [a, b] = opts.ab ?? [0, 0]
        return cb(null, { stdout: `${a}\t${b}\n`, stderr: '' })
      }
      cb(null, { stdout: '', stderr: '' })
    })
  }

  it('#1 detached-head: confirm + name = one checkout -b', async () => {
    readFileSync.mockReturnValue('abc123ef00\n') // HEAD is a raw sha
    routeExec()
    showWarning.mockResolvedValueOnce('Yes')             // confirmSafe
    showQuickPick.mockResolvedValueOnce({ label: 'recovery/detached' })
    await get('h1-detached-head').handle(ctx)
    const co = resetCalls().filter(a => a[0] === 'checkout' && a[1] === '-b')
    expect(co).toEqual([['checkout', '-b', 'recovery/detached']])
  })

  it('#1 detached-head: cancel = no checkout', async () => {
    readFileSync.mockReturnValue('abc123ef00\n')
    routeExec()
    showWarning.mockResolvedValueOnce('Cancel')
    await get('h1-detached-head').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'checkout')).toHaveLength(0)
  })

  it('#2 merge-conflict: unresolved = reports, no commit', async () => {
    routeExec({ conflicts: ['a.js', 'b.js'] })
    await get('h2-merge-conflict').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'commit')).toHaveLength(0)
    expect(showInfo).toHaveBeenCalled()
  })

  it('#2 merge-conflict: resolved + confirm = commit --no-edit', async () => {
    routeExec({ conflicts: [] })
    showWarning.mockResolvedValueOnce('Yes')
    await get('h2-merge-conflict').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'commit' && a[1] === '--no-edit')).toHaveLength(1)
  })

  it('#3 rebase: continue choice = rebase --continue', async () => {
    routeExec({ conflicts: [] })
    showQuickPick.mockResolvedValueOnce({ label: 'Continue rebase' })
    await get('h3-rebase-in-progress').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'rebase' && a[1] === '--continue')).toHaveLength(1)
  })

  it('#3 rebase: abort choice = rebase --abort', async () => {
    routeExec({ conflicts: [] })
    showQuickPick.mockResolvedValueOnce({ label: 'Abort rebase' })
    await get('h3-rebase-in-progress').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'rebase' && a[1] === '--abort')).toHaveLength(1)
  })

  it('#4 local-changes: stash choice = git stash (safe)', async () => {
    routeExec()
    showQuickPick.mockResolvedValueOnce({ label: 'Stash my changes' })
    await get('h4-local-changes-overwrite').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'stash')).toHaveLength(1)
    expect(resetCalls().filter(a => a[0] === 'reset')).toHaveLength(0)
  })

  it('#4 local-changes: discard gates through 2-step destructive confirm', async () => {
    routeExec()
    showQuickPick.mockResolvedValueOnce({ label: 'Discard my changes' })
    showWarning.mockResolvedValueOnce('Cancel') // step 1 rejected
    await get('h4-local-changes-overwrite').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'reset' && a[1] === '--hard')).toHaveLength(0)
  })

  it('#4 local-changes: discard confirmed both steps = one reset --hard', async () => {
    routeExec()
    showQuickPick.mockResolvedValueOnce({ label: 'Discard my changes' })
    showWarning.mockResolvedValueOnce('Yes').mockResolvedValueOnce('Execute')
    await get('h4-local-changes-overwrite').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'reset' && a[1] === '--hard')).toHaveLength(1)
  })

  it('#6 stash-conflict: advisory report only, no git mutation', async () => {
    routeExec({ conflicts: ['x.js'] })
    await get('h6-stash-conflict').handle(ctx)
    const mutations = resetCalls().filter(a => ['commit', 'reset', 'stash', 'checkout'].includes(a[0]))
    expect(mutations).toHaveLength(0)
    expect(showInfo).toHaveBeenCalled()
  })

  it('#7 cherry-pick: continue choice = cherry-pick --continue', async () => {
    routeExec({ conflicts: [] })
    showQuickPick.mockResolvedValueOnce({ label: 'Continue cherry-pick' })
    await get('h7-cherry-pick-in-progress').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'cherry-pick' && a[1] === '--continue')).toHaveLength(1)
  })

  it('#8 branch-diverged: confirm = pull --rebase', async () => {
    routeExec({ upstream: 'origin/main', ab: [2, 3] })
    showWarning.mockResolvedValueOnce('Yes')
    await get('h8-branch-diverged').handle(ctx)
    expect(resetCalls().filter(a => a[0] === 'pull' && a[1] === '--rebase')).toHaveLength(1)
  })

  it('#10 far-behind-remote: renamed id present, advisory only, no git mutation', async () => {
    expect(handlers.find(h => h.id === 'h10-merge-wizard')).toBeUndefined()
    routeExec({ upstream: 'origin/main' })
    await get('h10-far-behind-remote').handle(ctx)
    const mutations = resetCalls().filter(a => ['pull', 'reset', 'commit', 'push'].includes(a[0]))
    expect(mutations).toHaveLength(0)
    expect(showInfo).toHaveBeenCalled()
  })
})
