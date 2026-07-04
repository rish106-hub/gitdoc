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

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitdoc-realgit-'))
})
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
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
})
