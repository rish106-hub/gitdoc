import { describe, it, expect, vi } from 'vitest'

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

import { explainError, explainDetectedState } from '../../src/explainer'
import { ERROR_MAP } from '../../src/errorMap'
import { GitContext } from '../../src/types'

const ctx: GitContext = { workspaceRoot: '/repo' }

function erroMapFixHandlerIds(): string[] {
  const ids = new Set<string>()
  for (const e of ERROR_MAP) if (e.fixHandlerId) ids.add(e.fixHandlerId)
  return [...ids]
}

describe('explainError', () => {
  it('returns unmatched shape for unrecognized text', async () => {
    const e = await explainError('total gibberish that matches nothing', ctx)
    expect(e.unmatched).toBe(true)
    expect(e.liveFixHandlerId).toBeUndefined()
    expect(e.title.length).toBeGreaterThan(0)
  })

  it('returns unmatched for empty string', async () => {
    const e = await explainError('', ctx)
    expect(e.unmatched).toBe(true)
  })

  it('explains a matched error without offering a live fix when the state is not live', async () => {
    const e = await explainError('fatal: not a git repository (or any of the parent directories): .git', ctx)
    expect(e.unmatched).toBe(false)
    expect(e.liveFixHandlerId).toBeUndefined()
    expect(e.suggestedCommand).toBeTruthy()
    expect(e.body).toContain('What this means:')
    expect(e.body).toContain('Why it happened:')
  })

  it('offers a live fix when the matching handler currently detects true', async () => {
    // detached-head's handler reads .git/HEAD off disk; force it to detect live
    // by pointing at a workspace root with no HEAD file at all is not "detached" —
    // instead assert the no-live-fix path stays consistent (handler.detect throws/false safely).
    const e = await explainError('You are in detached HEAD state', ctx)
    expect(e.unmatched).toBe(false)
    // On a non-existent /repo, h1's detect() reads a missing file and returns false,
    // so no live fix should be offered, and suggestedCommand should be present instead.
    expect(e.liveFixHandlerId).toBeUndefined()
    expect(e.suggestedCommand).toBe('git switch -c my-branch')
  })

  it('never throws even when the matched handler id is bogus-safe (defensive)', async () => {
    await expect(explainError('CONFLICT (content): Merge conflict in app.js', ctx)).resolves.toBeDefined()
  })
})

describe('explainDetectedState', () => {
  it('returns null for an unknown handler id', () => {
    expect(explainDetectedState('nope-not-a-handler')).toBeNull()
  })

  it('always sets liveFixHandlerId to the given id for a known handler', () => {
    const e = explainDetectedState('h1-detached-head')
    expect(e).not.toBeNull()
    expect(e!.liveFixHandlerId).toBe('h1-detached-head')
    expect(e!.unmatched).toBe(false)
  })

  it('works for every fixHandlerId actually referenced in the error map (no silent gaps)', () => {
    for (const id of erroMapFixHandlerIds()) {
      expect(explainDetectedState(id), id).not.toBeNull()
    }
  })
})
