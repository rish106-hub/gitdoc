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

  it('two uncontested pattern hits score 0.9', () => {
    // matches two h9 patterns (force→push, overwrite→remote), no rival rule
    const c = classify('force push and overwrite the remote')
    expect(c.confidence).toBeCloseTo(0.9)
    expect(c.confidence).toBeGreaterThan(classify('save this as a branch').confidence)
  })

  it('a clear winner over a weaker rival scores by margin (2 vs 1 hit -> 0.8)', () => {
    // h9: force→push + overwrite→remote = 2 hits; h4: discard→changes = 1 hit.
    // margin = 2 - 1 = 1 -> 0.5 + 0.1*2 + 0.1*1 = 0.8
    const c = classify('force push overwrite remote and discard changes')
    expect(c.handlerId).toBe('h9-force-push')
    expect(c.confidence).toBeCloseTo(0.8)
  })

  it('an ambiguous tie is pinned to 0.5 and always confirms', () => {
    const c = classify('finish the merge and rebase')
    expect(c.confidence).toBeCloseTo(0.5)
    expect(c.needsConfirm).toBe(true)
  })

  it('caps at 0.95 when the raw score would exceed it', () => {
    // 3 h5 patterns: undo→commit, revert→last, standalone "uncommit" -> raw 1.0
    const c = classify('undo the commit, revert the last one, then uncommit it')
    expect(c.handlerId).toBe('h5-undo-last-commit')
    expect(c.confidence).toBeCloseTo(0.95) // truncated from 1.0 — exercises the cap
  })

  it('a destructive intent still confirms even at high confidence', () => {
    const c = classify('force push and overwrite the remote')
    expect(c.confidence).toBeGreaterThan(0.7)
    expect(c.needsConfirm).toBe(true) // safety invariant is independent of confidence
  })
})
