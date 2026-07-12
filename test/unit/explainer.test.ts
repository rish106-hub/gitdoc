import { describe, it, expect, vi, beforeEach } from 'vitest'

// Control the live-detect result without spawning git or loading vscode.
const detect = vi.fn()
vi.mock('../../src/handlers', () => ({
  handlers: [
    { id: 'h1-detached-head', destructive: false, advisory: true, detect: (c: unknown) => detect(c), handle: async () => {} },
  ],
}))

import { explainError, explainDetectedState } from '../../src/explainer'

const ctx = { workspaceRoot: '/repo' }
// Real error text that errorMap maps to h1-detached-head (fixHandlerId).
const DETACHED = 'You are in "detached HEAD" state.'

beforeEach(() => vi.resetAllMocks())

describe('explainError', () => {
  it('offers a live fix when the matched handler detects the state', async () => {
    detect.mockResolvedValue(true)
    const e = await explainError(DETACHED, ctx)
    expect(e.unmatched).toBe(false)
    expect(e.liveFixHandlerId).toBe('h1-detached-head')
    expect(e.suggestedCommand).toBeUndefined()
  })

  it('explains only (with a suggested command) when the state is not live', async () => {
    detect.mockResolvedValue(false)
    const e = await explainError(DETACHED, ctx)
    expect(e.liveFixHandlerId).toBeUndefined()
    expect(e.suggestedCommand).toBeTruthy()
  })

  it('treats a throwing detect() as not-live (swallowed)', async () => {
    detect.mockImplementation(() => { throw new Error('git blew up') })
    const e = await explainError(DETACHED, ctx)
    expect(e.liveFixHandlerId).toBeUndefined()
    expect(e.unmatched).toBe(false)
  })

  it('marks unrecognized errors as unmatched', async () => {
    const e = await explainError('completely unrecognizable blah blah', ctx)
    expect(e.unmatched).toBe(true)
    expect(e.liveFixHandlerId).toBeUndefined()
  })
})

describe('explainDetectedState', () => {
  it('returns a live-fix explanation for a mapped handler', () => {
    const e = explainDetectedState('h1-detached-head')
    expect(e).not.toBeNull()
    expect(e!.liveFixHandlerId).toBe('h1-detached-head')
  })

  it('returns null for a handler with no error-map entry', () => {
    expect(explainDetectedState('h99-does-not-exist')).toBeNull()
  })
})
