import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// vscode isn't available in a plain node test process, but importing handlers
// pulls it in transitively (via ui/config). Stub just enough for the import to
// resolve — detect() itself only touches fs + real git, never vscode.
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: () => ({ appendLine: () => {}, clear: () => {}, show: () => {} }),
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {},
    createStatusBarItem: () => ({ show: () => {}, text: '', tooltip: '', command: '' }),
    StatusBarAlignment: { Left: 1 },
  },
  workspace: { getConfiguration: () => ({ get: (_k: string, d: unknown) => d }) },
  extensions: { getExtension: () => undefined },
}))

import { handlers } from '../../src/handlers'
import { explainError } from '../../src/explainer'
import { getGitDir } from '../../src/git'
import { GitContext } from '../../src/types'

// Real git — NOT mocked.
function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).toString()
}

function tryGit(cwd: string, args: string[]): void {
  try {
    git(cwd, args)
  } catch {
    // expected to fail for conflict-inducing operations
  }
}

function detectId(id: string, ctx: GitContext): Promise<boolean> {
  const h = handlers.find(x => x.id === id)!
  return Promise.resolve(h.detect(ctx))
}

let root: string

function newRepo(name: string): string {
  const dir = fs.mkdtempSync(path.join(root, `${name}-`))
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'Test'])
  fs.writeFileSync(path.join(dir, 'file.txt'), 'line1\n')
  git(dir, ['add', '.'])
  git(dir, ['commit', '-qm', 'initial'])
  return dir
}

function commit(dir: string, content: string, msg: string): void {
  fs.writeFileSync(path.join(dir, 'file.txt'), content)
  git(dir, ['commit', '-qam', msg])
}

// Bare remote + a clone tracking it. Offline (file:// path), no network.
function newRemoteAndClone(name: string): { remote: string; local: string } {
  const remote = fs.mkdtempSync(path.join(root, `${name}-remote-`))
  git(remote, ['init', '-q', '--bare', '-b', 'main'])
  const seed = newRepo(`${name}-seed`)
  git(seed, ['remote', 'add', 'origin', remote])
  git(seed, ['push', '-q', 'origin', 'main'])
  const local = fs.mkdtempSync(path.join(root, `${name}-local-`))
  git(root, ['clone', '-q', remote, local])
  git(local, ['config', 'user.email', 'test@example.com'])
  git(local, ['config', 'user.name', 'Test'])
  return { remote, local }
}

// Advance the remote by pushing N commits from a throwaway clone.
function advanceRemote(remote: string, name: string, n: number): void {
  const pusher = fs.mkdtempSync(path.join(root, `${name}-pusher-`))
  git(root, ['clone', '-q', remote, pusher])
  git(pusher, ['config', 'user.email', 'test@example.com'])
  git(pusher, ['config', 'user.name', 'Test'])
  for (let i = 0; i < n; i++) commit(pusher, `remote-${i}\n`, `remote commit ${i}`)
  git(pusher, ['push', '-q', 'origin', 'main'])
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitrescue-realgit-'))
})
afterAll(() => {
  // git subprocesses may still be releasing file handles; retry the cleanup.
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('real-git detection', () => {
  it('clean repo triggers no auto-detected handler', async () => {
    const dir = newRepo('clean')
    const ctx = { workspaceRoot: dir }
    for (const h of handlers.filter(x => !x.commandOnly)) {
      expect(await Promise.resolve(h.detect(ctx))).toBe(false)
    }
  })

  it('#1 detects detached HEAD', async () => {
    const dir = newRepo('detached')
    const sha = git(dir, ['rev-parse', 'HEAD']).trim()
    git(dir, ['checkout', '-q', sha])
    expect(await detectId('h1-detached-head', { workspaceRoot: dir })).toBe(true)
  })

  it('#2 detects a merge conflict (MERGE_HEAD present)', async () => {
    const dir = newRepo('merge')
    git(dir, ['checkout', '-qb', 'feature'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'feature-change\n')
    git(dir, ['commit', '-qam', 'feature'])
    git(dir, ['checkout', '-q', 'main'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'main-change\n')
    git(dir, ['commit', '-qam', 'main'])
    tryGit(dir, ['merge', 'feature']) // conflicts → leaves MERGE_HEAD
    expect(fs.existsSync(path.join(dir, '.git', 'MERGE_HEAD'))).toBe(true)
    expect(await detectId('h2-merge-conflict', { workspaceRoot: dir })).toBe(true)
  })

  it('#3 detects a paused rebase (rebase-merge dir present)', async () => {
    const dir = newRepo('rebase')
    git(dir, ['checkout', '-qb', 'feature'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'feature-change\n')
    git(dir, ['commit', '-qam', 'feature'])
    git(dir, ['checkout', '-q', 'main'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'main-change\n')
    git(dir, ['commit', '-qam', 'main'])
    git(dir, ['checkout', '-q', 'feature'])
    tryGit(dir, ['rebase', 'main']) // conflicts → pauses rebase
    expect(fs.existsSync(path.join(dir, '.git', 'rebase-merge'))).toBe(true)
    expect(await detectId('h3-rebase-in-progress', { workspaceRoot: dir })).toBe(true)
  })

  it('#3 detects the rebase-apply state too', async () => {
    const dir = newRepo('rebase-apply')
    fs.mkdirSync(path.join(dir, '.git', 'rebase-apply'))
    expect(await detectId('h3-rebase-in-progress', { workspaceRoot: dir })).toBe(true)
  })

  it('#7 detects a cherry-pick conflict (CHERRY_PICK_HEAD present)', async () => {
    const dir = newRepo('cherry')
    git(dir, ['checkout', '-qb', 'feature'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'feature-change\n')
    git(dir, ['commit', '-qam', 'feature'])
    const featureSha = git(dir, ['rev-parse', 'HEAD']).trim()
    git(dir, ['checkout', '-q', 'main'])
    fs.writeFileSync(path.join(dir, 'file.txt'), 'main-change\n')
    git(dir, ['commit', '-qam', 'main'])
    tryGit(dir, ['cherry-pick', featureSha]) // conflicts
    expect(fs.existsSync(path.join(dir, '.git', 'CHERRY_PICK_HEAD'))).toBe(true)
    expect(await detectId('h7-cherry-pick-in-progress', { workspaceRoot: dir })).toBe(true)
  })

  it('#4 never auto-detects from stale ORIG_HEAD', async () => {
    // A failed pull writes ORIG_HEAD and leaves no MERGE_HEAD.
    const { remote, local } = newRemoteAndClone('overwrite')
    advanceRemote(remote, 'overwrite', 1) // remote moves ahead
    // dirty local change that would be overwritten by the incoming commit
    fs.writeFileSync(path.join(local, 'file.txt'), 'uncommitted local edit\n')
    tryGit(local, ['pull', '--no-rebase']) // aborts: would overwrite local changes
    // Simulate ORIG_HEAD presence a failed operation leaves behind
    if (!fs.existsSync(path.join(local, '.git', 'ORIG_HEAD'))) {
      const head = git(local, ['rev-parse', 'HEAD']).trim()
      fs.writeFileSync(path.join(local, '.git', 'ORIG_HEAD'), head + '\n')
    }
    expect(fs.existsSync(path.join(local, '.git', 'MERGE_HEAD'))).toBe(false)
    expect(await detectId('h4-local-changes-overwrite', { workspaceRoot: local })).toBe(false)
  })

  it('#6 ignores a normal stash without conflicts', async () => {
    const dir = newRepo('clean-stash')
    fs.writeFileSync(path.join(dir, 'file.txt'), 'saved for later\n')
    git(dir, ['stash', '-q'])
    expect(await detectId('h6-stash-conflict', { workspaceRoot: dir })).toBe(false)
  })

  it('detects detached HEAD in a linked worktree', async () => {
    const source = newRepo('worktree-source')
    const linked = fs.mkdtempSync(path.join(root, 'worktree-linked-'))
    fs.rmSync(linked, { recursive: true, force: true })
    git(source, ['worktree', 'add', '-q', '--detach', linked, 'HEAD'])
    expect(fs.statSync(path.join(linked, '.git')).isFile()).toBe(true)
    expect(getGitDir(linked)).not.toBe(path.join(linked, '.git'))
    expect(await detectId('h1-detached-head', { workspaceRoot: linked })).toBe(true)
  })

  it('#8 detects a diverged branch (ahead AND behind)', async () => {
    const { remote, local } = newRemoteAndClone('diverged')
    advanceRemote(remote, 'diverged', 1) // remote ahead by 1
    commit(local, 'local-only\n', 'local commit') // local ahead by 1
    // Detection never performs network operations; use current tracking refs.
    git(local, ['fetch', '-q'])
    expect(await detectId('h8-branch-diverged', { workspaceRoot: local })).toBe(true)
  })

  it('#8 does NOT fire when only behind (fast-forwardable)', async () => {
    const { remote, local } = newRemoteAndClone('behind-only')
    advanceRemote(remote, 'behind-only', 1) // remote ahead, local not
    git(local, ['fetch', '-q'])
    expect(await detectId('h8-branch-diverged', { workspaceRoot: local })).toBe(false)
  })

  it('#10 detects a branch far behind remote (>10 commits)', async () => {
    const { remote, local } = newRemoteAndClone('behind')
    advanceRemote(remote, 'behind', 11)
    git(local, ['fetch', '-q']) // #10 detect reads HEAD..upstream without fetching
    expect(await detectId('h10-merge-wizard', { workspaceRoot: local })).toBe(true)
  })

  it('#10 does NOT fire when only slightly behind (<=10)', async () => {
    const { remote, local } = newRemoteAndClone('slightly-behind')
    advanceRemote(remote, 'slightly-behind', 3)
    git(local, ['fetch', '-q'])
    expect(await detectId('h10-merge-wizard', { workspaceRoot: local })).toBe(false)
  })

  it('safety: no handler throws or fires in a non-git directory', async () => {
    const dir = fs.mkdtempSync(path.join(root, 'nogit-'))
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'not a repo\n')
    const ctx = { workspaceRoot: dir }
    for (const h of handlers.filter(x => !x.commandOnly)) {
      // must resolve to false without throwing (ENOENT safety)
      expect(await Promise.resolve(h.detect(ctx))).toBe(false)
    }
  })

  it('safety: empty repo with an unborn branch is not flagged as detached', async () => {
    const dir = fs.mkdtempSync(path.join(root, 'empty-'))
    git(dir, ['init', '-q', '-b', 'main']) // no commits yet
    // HEAD is "ref: refs/heads/main" (unborn), not a raw sha → not detached
    expect(await detectId('h1-detached-head', { workspaceRoot: dir })).toBe(false)
  })

  it('priority: merge conflict wins over other states in one cycle', async () => {
    // A repo mid-merge should surface #2, and #2 appears before advisory
    // handlers in the registry, so it is what a single detection cycle reports.
    const dir = newRepo('priority')
    git(dir, ['checkout', '-qb', 'feature'])
    commit(dir, 'feature-change\n', 'feature')
    git(dir, ['checkout', '-q', 'main'])
    commit(dir, 'main-change\n', 'main')
    tryGit(dir, ['merge', 'feature'])
    const firstMatch = handlers.filter(h => !h.commandOnly).find(async h =>
      await Promise.resolve(h.detect({ workspaceRoot: dir }))
    )
    // deterministic check: #2 detects, and it precedes #8/#10 in the array
    expect(await detectId('h2-merge-conflict', { workspaceRoot: dir })).toBe(true)
    const ids = handlers.map(h => h.id)
    expect(ids.indexOf('h2-merge-conflict')).toBeLessThan(ids.indexOf('h8-branch-diverged'))
    void firstMatch
  })
})

describe('explainer against real repo state', () => {
  it('offers the live fix when the repo IS in the matching state', async () => {
    const dir = newRepo('explain-detached')
    const sha = git(dir, ['rev-parse', 'HEAD']).trim()
    git(dir, ['checkout', '-q', sha]) // now detached
    const ex = await explainError('You are in detached HEAD state', { workspaceRoot: dir })
    expect(ex.unmatched).toBe(false)
    expect(ex.liveFixHandlerId).toBe('h1-detached-head') // h1 detects true → fix offered
    expect(ex.suggestedCommand).toBeUndefined()
  })

  it('explains only (no fix) when the repo is NOT in the matching state', async () => {
    const dir = newRepo('explain-clean') // on a branch, not detached
    const ex = await explainError('You are in detached HEAD state', { workspaceRoot: dir })
    expect(ex.unmatched).toBe(false)
    expect(ex.liveFixHandlerId).toBeUndefined() // h1 detects false → no live fix
    expect(ex.suggestedCommand).toBeTruthy() // falls back to a command-as-text
  })

  it('flags unmatched for an unrecognized error', async () => {
    const dir = newRepo('explain-unknown')
    const ex = await explainError('some error GitRescue has never seen', { workspaceRoot: dir })
    expect(ex.unmatched).toBe(true)
    expect(ex.liveFixHandlerId).toBeUndefined()
  })
})
