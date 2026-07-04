import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs')
vi.mock('child_process', () => ({ execFile: vi.fn() }))
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  workspace: {},
  extensions: { getExtension: vi.fn() },
}))

import { runHandlers } from '../../src/detection'
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
