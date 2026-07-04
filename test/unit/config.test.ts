import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
vi.mock('vscode', () => ({
  workspace: { getConfiguration: vi.fn(() => ({ get: getMock })) },
}))

import { getConfig, isHandlerEnabled } from '../../src/config'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getConfig', () => {
  it('returns defaults when settings are unset', () => {
    getMock.mockImplementation((_key: string, dflt: unknown) => dflt)
    expect(getConfig()).toEqual({
      autoDetect: true,
      disabledHandlers: [],
      telemetry: true,
      confirmSafeFixes: true,
    })
  })

  it('reflects user overrides', () => {
    getMock.mockImplementation((key: string, dflt: unknown) => {
      const values: Record<string, unknown> = {
        autoDetect: false,
        disabledHandlers: ['h8-branch-diverged'],
        telemetry: false,
      }
      return key in values ? values[key] : dflt
    })
    const c = getConfig()
    expect(c.autoDetect).toBe(false)
    expect(c.disabledHandlers).toEqual(['h8-branch-diverged'])
    expect(c.telemetry).toBe(false)
    expect(c.confirmSafeFixes).toBe(true) // still default
  })
})

describe('isHandlerEnabled', () => {
  it('false for a disabled id, true otherwise', () => {
    getMock.mockImplementation((key: string, dflt: unknown) =>
      key === 'disabledHandlers' ? ['h8-branch-diverged'] : dflt
    )
    expect(isHandlerEnabled('h8-branch-diverged')).toBe(false)
    expect(isHandlerEnabled('h2-merge-conflict')).toBe(true)
  })
})
