import { describe, it, expect } from 'vitest'
import { planRoute } from '../../src/nlRouter'

describe('planRoute', () => {
  it('routes an error string to explain', () => {
    const p = planRoute('fatal: not a git repository')
    expect(p.action).toBe('explain')
  })

  it('routes a known intent to run-handler with the handler id', () => {
    const p = planRoute('my branch is behind the remote')
    expect(p.action).toBe('run-handler')
    expect(p.handlerId).toBe('h8-branch-diverged')
  })

  it('flags a destructive intent as needsConfirm', () => {
    const p = planRoute('undo my last commit')
    expect(p.action).toBe('run-handler')
    expect(p.handlerId).toBe('h5-undo-last-commit')
    expect(p.needsConfirm).toBe(true)
  })

  it('routes gibberish to unknown with a helpful message, no handler', () => {
    const p = planRoute('do the git thing')
    expect(p.action).toBe('unknown')
    expect(p.handlerId).toBeUndefined()
    expect(p.message.length).toBeGreaterThan(10)
  })

  it('run-handler carries an empty message and the classification', () => {
    const p = planRoute('my branch is behind the remote')
    expect(p.action).toBe('run-handler')
    expect(p.message).toBe('')
    expect(p.classification.kind).toBe('intent')
  })

  it('a confident non-destructive intent does not need confirmation', () => {
    const p = planRoute('save this as a branch')
    expect(p.action).toBe('run-handler')
    expect(p.handlerId).toBe('h1-detached-head')
    expect(p.needsConfirm).toBe(false)
  })

  it('an ambiguous match needs confirmation even when neither side is destructive', () => {
    // ties h2-merge-conflict and h3-rebase-in-progress (both "finish …", non-destructive)
    const p = planRoute('finish the merge and rebase')
    expect(p.action).toBe('run-handler')
    expect(p.needsConfirm).toBe(true) // ambiguous never auto-routes
  })
})
