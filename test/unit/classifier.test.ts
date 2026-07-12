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

describe('classify — confidence gradation', () => {
  it('a single one-pattern match scores 0.7 (enough to auto-route)', () => {
    const c = classify('save this as a branch')
    expect(c.confidence).toBeCloseTo(0.7)
    expect(c.needsConfirm).toBe(false)
  })

  it('matching more patterns in a rule scores higher than a single hit', () => {
    const single = classify('save this as a branch').confidence
    const multi = classify('force push and overwrite the remote').confidence
    expect(multi).toBeGreaterThan(single)
  })

  it('an ambiguous tie is pinned to 0.5 and always confirms', () => {
    const c = classify('finish the merge and rebase')
    expect(c.confidence).toBeCloseTo(0.5)
    expect(c.needsConfirm).toBe(true)
  })

  it('confidence never exceeds the 0.95 cap', () => {
    for (const phrase of ['force push and overwrite the remote', 'undo and uncommit my last commit']) {
      expect(classify(phrase).confidence).toBeLessThanOrEqual(0.95)
    }
  })

  it('a destructive intent still confirms even at high confidence', () => {
    const c = classify('force push and overwrite the remote')
    expect(c.confidence).toBeGreaterThan(0.7)
    expect(c.needsConfirm).toBe(true) // safety invariant is independent of confidence
  })
})
