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
})
