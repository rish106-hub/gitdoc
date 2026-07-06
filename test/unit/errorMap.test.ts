import { describe, it, expect, vi } from 'vitest'

// handlers.ts pulls vscode transitively; stub it so the registry import resolves.
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: () => ({ appendLine: () => {} }),
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {},
    createStatusBarItem: () => ({ show: () => {}, text: '', tooltip: '', command: '' }),
    StatusBarAlignment: { Left: 1 },
  },
  workspace: { getConfiguration: () => ({ get: (_k: string, d: unknown) => d }) },
  extensions: { getExtension: () => undefined },
}))

import { ERROR_MAP, matchError, entryForHandler, explainerTextForHandler } from '../../src/errorMap'
import { handlers } from '../../src/handlers'

describe('error map integrity (T2)', () => {
  it('every fixHandlerId references a real handler in the registry', () => {
    const ids = new Set(handlers.map(h => h.id))
    for (const e of ERROR_MAP) {
      if (e.fixHandlerId) {
        expect(ids.has(e.fixHandlerId), `${e.id} -> ${e.fixHandlerId}`).toBe(true)
      }
    }
  })

  it('every entry has a unique id and at least one matcher', () => {
    const seen = new Set<string>()
    for (const e of ERROR_MAP) {
      expect(seen.has(e.id), `dup id ${e.id}`).toBe(false)
      seen.add(e.id)
      expect(e.match.length).toBeGreaterThan(0)
      expect(e.title.length).toBeGreaterThan(0)
      expect(e.whatItMeans.length).toBeGreaterThan(0)
    }
  })
})

describe('matchError', () => {
  const cases: Array<[string, string]> = [
    ["error: Your local changes to the following files would be overwritten by merge:", 'local-changes-overwrite'],
    ['fatal: refusing to merge unrelated histories', 'unrelated-histories'],
    ['CONFLICT (content): Merge conflict in app.js', 'merge-conflict'],
    ["Updates were rejected because the tip of your current branch is behind", 'non-fast-forward'],
    ['fatal: not a git repository (or any of the parent directories): .git', 'not-a-repo'],
    ['You are in detached HEAD state', 'detached-head'],
    ['hint: You have divergent branches and have diverged', 'diverged'],
    ['error: cannot pull with rebase: You have unstaged changes.', 'pull-rebase-unstaged-changes'],
    ['error: src refspec main does not match any', 'refspec-does-not-match'],
    ['error: remote origin already exists.', 'remote-origin-already-exists'],
    ["fatal: a branch named 'feature/login' already exists", 'branch-already-exists'],
    ['! [rejected]        v1.0 -> v1.0  (would clobber existing tag)', 'would-clobber-existing-tag'],
  ]
  it.each(cases)('matches %s', (text, expectedId) => {
    expect(matchError(text)?.id).toBe(expectedId)
  })

  it('returns null for unrecognized text', () => {
    expect(matchError('some totally unrelated message')).toBeNull()
    expect(matchError('')).toBeNull()
  })
})

describe('handler lookups', () => {
  it('entryForHandler returns the entry for a known handler', () => {
    expect(entryForHandler('h1-detached-head')?.id).toBe('detached-head')
    expect(entryForHandler('nope')).toBeUndefined()
  })

  it('explainerTextForHandler returns plain-English text', () => {
    const t = explainerTextForHandler('h4-local-changes-overwrite')
    expect(t).toBeTruthy()
    expect(t!.length).toBeGreaterThan(20)
  })
})
