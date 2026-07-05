import { describe, it, expect } from 'vitest'
import { classify } from '../../src/classifier'

describe('classify — intents', () => {
  const intentCases: Array<[string, string]> = [
    ['undo my last commit', 'h5-undo-last-commit'],
    ['take back that commit', 'h5-undo-last-commit'],
    ['uncommit please', 'h5-undo-last-commit'],
    ['force push my branch', 'h9-force-push'],
    ['push with force', 'h9-force-push'],
    ['discard my changes', 'h4-local-changes-overwrite'],
    ['throw away my changes', 'h4-local-changes-overwrite'],
    ['my branch is behind the remote', 'h8-branch-diverged'],
    ['pull with rebase', 'h8-branch-diverged'],
    ['save this as a branch', 'h1-detached-head'],
    ['finish the merge', 'h2-merge-conflict'],
    ['continue the rebase', 'h3-rebase-in-progress'],
    ['abort my cherry-pick', 'h7-cherry-pick-in-progress'],
  ]
  it.each(intentCases)('%s -> %s', (phrase, handlerId) => {
    const c = classify(phrase)
    expect(c.kind).toBe('intent')
    expect(c.handlerId).toBe(handlerId)
  })
})

describe('classify — safety', () => {
  it('destructive intents always require confirmation', () => {
    for (const phrase of ['undo my last commit', 'force push', 'discard my changes']) {
      expect(classify(phrase).needsConfirm, phrase).toBe(true)
    }
  })

  it('a pasted error is classified as error, not an intent', () => {
    const c = classify('error: Your local changes would be overwritten by merge')
    expect(c.kind).toBe('error')
  })

  it('fatal/CONFLICT/rejected markers route to error', () => {
    expect(classify('fatal: not a git repository').kind).toBe('error')
    expect(classify('CONFLICT (content): Merge conflict in a.js').kind).toBe('error')
    expect(classify('Updates were rejected because the remote contains work').kind).toBe('error')
  })

  it('gibberish is unknown, never a guessed action', () => {
    const c = classify('make the thing do the stuff')
    expect(c.kind).toBe('unknown')
    expect(c.handlerId).toBeUndefined()
  })

  it('empty input is unknown', () => {
    expect(classify('   ').kind).toBe('unknown')
  })
})
