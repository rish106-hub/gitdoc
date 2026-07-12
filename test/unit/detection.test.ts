import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs')
vi.mock('child_process', () => ({ execFile: vi.fn() }))
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, dflt: unknown) => dflt, // all settings at default
    })),
  },
  extensions: { getExtension: vi.fn() },
}))

import { runHandlers, detectCached, detectionGen } from '../../src/detection'
import { Handler, GitContext } from '../../src/types'

const ctx: GitContext = { workspaceRoot: '/repo' }

function handler(overrides: Partial<Handler>): Handler {
  return {
    id: 'test',
    destructive: false,
    advisory: false,
    detect: () => false,
    handle: async () => {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runHandlers auto-detection', () => {
  it('skips command-only handlers', async () => {
    const detect = vi.fn(() => true)
    const handle = vi.fn(async () => {})
    await runHandlers(ctx, [handler({ id: 'cmd', commandOnly: true, detect, handle })])
    expect(detect).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it('runs the first matching handler and stops', async () => {
    const h1Handle = vi.fn(async () => {})
    const h2Detect = vi.fn(() => true)
    await runHandlers(ctx, [
      handler({ id: 'h1', detect: () => true, handle: h1Handle }),
      handler({ id: 'h2', detect: h2Detect, handle: async () => {} }),
    ])
    expect(h1Handle).toHaveBeenCalledOnce()
    expect(h2Detect).not.toHaveBeenCalled() // stopped after first match
  })

  it('continues past a handler whose detect throws', async () => {
    const goodHandle = vi.fn(async () => {})
    await runHandlers(ctx, [
      handler({ id: 'bad', detect: () => { throw new Error('boom') } }),
      handler({ id: 'good', detect: () => true, handle: goodHandle }),
    ])
    expect(goodHandle).toHaveBeenCalledOnce()
  })

  it('skips handlers disabled via the enabled predicate', async () => {
    const detect = vi.fn(() => true)
    const handle = vi.fn(async () => {})
    await runHandlers(
      ctx,
      [handler({ id: 'h8-branch-diverged', detect, handle })],
      id => id !== 'h8-branch-diverged' // disabled
    )
    expect(detect).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it('re-entrancy guard: overlapping cycle is dropped', async () => {
    let release: () => void
    const gate = new Promise<void>(res => { release = res })
    const handle = vi.fn(async () => {})

    const blocking = handler({
      id: 'slow',
      detect: async () => { await gate; return true },
      handle,
    })

    const first = runHandlers(ctx, [blocking])   // enters, awaits gate
    const second = runHandlers(ctx, [blocking])  // should bail immediately
    await second
    expect(handle).not.toHaveBeenCalled() // first still gated

    release!()
    await first
    expect(handle).toHaveBeenCalledOnce() // only the first cycle ran
  })
})

describe('detection cache (dedup with the sidebar)', () => {
  it('bumps the generation on each cycle that runs', async () => {
    const before = detectionGen()
    await runHandlers(ctx, [handler({ id: 'x', detect: () => false })])
    expect(detectionGen()).toBe(before + 1)
    await runHandlers(ctx, [handler({ id: 'x', detect: () => false })])
    expect(detectionGen()).toBe(before + 2)
  })

  it('detectCached reuses a result computed earlier in the same generation', async () => {
    const detect = vi.fn(() => false)
    const h = handler({ id: 'cached', detect })
    // runHandlers computes + caches every handler when none match.
    await runHandlers(ctx, [h])
    expect(detect).toHaveBeenCalledTimes(1)
    // Same generation → sidebar reuses the cache, no second detect() call.
    const reused = await detectCached(h, ctx)
    expect(reused).toBe(false)
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('a new cycle invalidates the cache', async () => {
    const detect = vi.fn(() => false)
    const h = handler({ id: 'stale', detect })
    await runHandlers(ctx, [h]) // gen N, caches
    await runHandlers(ctx, [h]) // gen N+1, clears + recomputes
    expect(detect).toHaveBeenCalledTimes(2)
  })

  it('does not cache handlers past the first match (short-circuit)', async () => {
    const laterDetect = vi.fn(() => true)
    const first = handler({ id: 'first', detect: () => true, handle: async () => {} })
    const later = handler({ id: 'later', detect: laterDetect })
    await runHandlers(ctx, [first, later])
    expect(laterDetect).not.toHaveBeenCalled() // never reached by runHandlers
    // The sidebar still computes it independently (not pre-cached this generation).
    await detectCached(later, ctx)
    expect(laterDetect).toHaveBeenCalledTimes(1)
  })
})
