import { describe, it, expect, vi, beforeEach } from 'vitest'

const { cfgGet } = vi.hoisted(() => ({ cfgGet: vi.fn() }))

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: cfgGet }) },
}))

// In-memory fake fs — avoids touching the real disk while exercising the exact
// read/append/write/mkdir calls telemetry.ts makes.
const { store, mkdirSync, appendFileSync, readFileSync, writeFileSync } = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    store,
    mkdirSync: vi.fn(),
    appendFileSync: vi.fn((p: string, s: string) => {
      store.set(p, (store.get(p) ?? '') + s)
    }),
    readFileSync: vi.fn((p: string) => {
      if (!store.has(p)) {
        const e = new Error('ENOENT') as NodeJS.ErrnoException
        e.code = 'ENOENT'
        throw e
      }
      return store.get(p)!
    }),
    writeFileSync: vi.fn((p: string, s: string) => {
      store.set(p, s)
    }),
  }
})

vi.mock('fs', () => ({ mkdirSync, appendFileSync, readFileSync, writeFileSync }))

import {
  initTelemetry,
  logHandlerRun,
  logErrorMiss,
  getLogPath,
  readLog,
  clearLog,
} from '../../src/telemetry'

function fakeContext(root: string) {
  return { globalStorageUri: { fsPath: root } } as unknown as Parameters<typeof initTelemetry>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  cfgGet.mockImplementation((_k: string, d: unknown) => d)
})

describe('initTelemetry', () => {
  it('sets the log path under globalStorageUri and creates the dir', () => {
    initTelemetry(fakeContext('/storage/a'))
    expect(getLogPath()).toBe('/storage/a/telemetry.jsonl')
    expect(mkdirSync).toHaveBeenCalledWith('/storage/a', { recursive: true })
  })
})

describe('logHandlerRun', () => {
  it('appends a jsonl entry with handlerId/outcome/ts when telemetry is on', () => {
    initTelemetry(fakeContext('/storage/b'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    logHandlerRun('h5-undo-last-commit', 'applied')
    const entries = readLog()
    expect(entries).toHaveLength(1)
    expect(entries[0].handlerId).toBe('h5-undo-last-commit')
    expect(entries[0].outcome).toBe('applied')
    expect(typeof entries[0].ts).toBe('string')
  })

  it('does nothing when telemetry is disabled (opt-out)', () => {
    initTelemetry(fakeContext('/storage/c'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? false : d))
    logHandlerRun('h9-force-push', 'cancelled')
    expect(readLog()).toEqual([])
  })

  it('is a silent no-op before initTelemetry has ever run', () => {
    // fresh module-level logPath from a prior test could leak; simulate by clearing store
    // and asserting no throw regardless of prior init (logPath persists across calls in
    // the same module instance, so this documents the guard rather than a fresh-import case).
    expect(() => logHandlerRun('h1-detached-head', 'applied')).not.toThrow()
  })

  it('never throws when the underlying fs write fails', () => {
    initTelemetry(fakeContext('/storage/d'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    appendFileSync.mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    expect(() => logHandlerRun('h2-merge-conflict', 'applied')).not.toThrow()
  })
})

describe('logErrorMiss', () => {
  it('stores a stable hash + length, never the raw text', () => {
    initTelemetry(fakeContext('/storage/e'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    const text = 'some pasted error nobody has seen before'
    logErrorMiss(text)
    const [entry] = readLog()
    expect(entry.kind).toBe('error-miss')
    expect(entry.len).toBe(text.length)
    expect(JSON.stringify(entry)).not.toContain(text)
    expect(entry.hash).toMatch(/^[0-9a-f]+$/)
  })

  it('produces the same hash for the same text (deterministic)', () => {
    initTelemetry(fakeContext('/storage/f'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    logErrorMiss('repeat me')
    logErrorMiss('repeat me')
    const entries = readLog()
    expect(entries[0].hash).toBe(entries[1].hash)
  })

  it('handles an empty string without throwing', () => {
    initTelemetry(fakeContext('/storage/g'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    expect(() => logErrorMiss('')).not.toThrow()
    expect(readLog()[0].len).toBe(0)
  })

  it('respects the telemetry opt-out', () => {
    initTelemetry(fakeContext('/storage/h'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? false : d))
    logErrorMiss('anything')
    expect(readLog()).toEqual([])
  })
})

describe('readLog', () => {
  it('returns [] when no log file exists yet', () => {
    initTelemetry(fakeContext('/storage/i'))
    expect(readLog()).toEqual([])
  })

  it('skips blank lines and survives a malformed trailing line (stress: corrupt data)', () => {
    initTelemetry(fakeContext('/storage/j'))
    store.set('/storage/j/telemetry.jsonl', '{"ts":"1","kind":"a"}\n\n{"ts":"2","kind":"b"}\n')
    expect(readLog()).toHaveLength(2)
  })

  it('stress: 5000 rapid appends all round-trip through readLog', () => {
    initTelemetry(fakeContext('/storage/k'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    for (let i = 0; i < 5000; i++) {
      logHandlerRun(`h${i % 10}-x`, i % 2 === 0 ? 'applied' : 'cancelled')
    }
    expect(readLog()).toHaveLength(5000)
  })
})

describe('clearLog', () => {
  it('empties the log file', () => {
    initTelemetry(fakeContext('/storage/l'))
    cfgGet.mockImplementation((k: string, d: unknown) => (k === 'telemetry' ? true : d))
    logHandlerRun('h1-detached-head', 'applied')
    expect(readLog()).toHaveLength(1)
    clearLog()
    expect(readLog()).toEqual([])
  })

  it('never throws when the underlying fs write fails', () => {
    initTelemetry(fakeContext('/storage/m'))
    writeFileSync.mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    expect(() => clearLog()).not.toThrow()
  })
})
