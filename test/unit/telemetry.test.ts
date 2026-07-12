import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs')
vi.mock('vscode', () => ({}))

const getConfig = vi.fn(() => ({ telemetry: true }))
vi.mock('../../src/config', () => ({ getConfig: () => getConfig() }))

import * as fs from 'fs'
import {
  initTelemetry,
  logHandlerRun,
  logErrorMiss,
  readLog,
  clearLog,
  summarizeErrorMisses,
} from '../../src/telemetry'

type Fn = ReturnType<typeof vi.fn>
const mkdirSync = fs.mkdirSync as unknown as Fn
const appendFileSync = fs.appendFileSync as unknown as Fn
const readFileSync = fs.readFileSync as unknown as Fn
const writeFileSync = fs.writeFileSync as unknown as Fn

const ctx = { globalStorageUri: { fsPath: '/store' } } as never

/** Last string written by appendFileSync, parsed from JSONL. */
function lastAppended(): Record<string, unknown> {
  const calls = appendFileSync.mock.calls
  return JSON.parse((calls[calls.length - 1][1] as string).trim())
}

beforeEach(() => {
  vi.resetAllMocks()
  getConfig.mockReturnValue({ telemetry: true })
})

describe('initTelemetry', () => {
  it('creates the storage dir', () => {
    initTelemetry(ctx)
    expect(mkdirSync).toHaveBeenCalledWith('/store', { recursive: true })
  })
})

describe('logHandlerRun', () => {
  it('appends a handler run entry with the expected shape', () => {
    initTelemetry(ctx)
    logHandlerRun('h1-detached-head', 'applied')
    const entry = lastAppended()
    expect(entry.handlerId).toBe('h1-detached-head')
    expect(entry.outcome).toBe('applied')
    expect(typeof entry.ts).toBe('string')
  })

  it('no-ops when telemetry is disabled', () => {
    initTelemetry(ctx)
    getConfig.mockReturnValue({ telemetry: false })
    logHandlerRun('h1-detached-head', 'applied')
    expect(appendFileSync).not.toHaveBeenCalled()
  })
})

describe('logErrorMiss — privacy', () => {
  it('never stores the raw error text, only a hash + length', () => {
    initTelemetry(ctx)
    const secret = 'fatal: super secret repo path /Users/me/private'
    logErrorMiss(secret)
    const raw = appendFileSync.mock.calls[0][1] as string
    expect(raw).not.toContain('secret')
    expect(raw).not.toContain('/Users/me/private')
    const entry = JSON.parse(raw.trim())
    expect(entry.kind).toBe('error-miss')
    expect(typeof entry.hash).toBe('string')
    expect(entry.len).toBe(secret.length)
    expect(entry).not.toHaveProperty('text')
  })

  it('no-ops when telemetry is disabled', () => {
    initTelemetry(ctx)
    getConfig.mockReturnValue({ telemetry: false })
    logErrorMiss('anything')
    expect(appendFileSync).not.toHaveBeenCalled()
  })
})

describe('readLog', () => {
  it('parses JSONL entries', () => {
    initTelemetry(ctx)
    readFileSync.mockReturnValue('{"handlerId":"h1","ts":"t"}\n{"kind":"error-miss","ts":"t2"}\n')
    const log = readLog()
    expect(log).toHaveLength(2)
    expect(log[0].handlerId).toBe('h1')
  })

  it('returns [] on a missing/unreadable file', () => {
    initTelemetry(ctx)
    readFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    expect(readLog()).toEqual([])
  })
})

describe('clearLog', () => {
  it('truncates the log file', () => {
    initTelemetry(ctx)
    clearLog()
    expect(writeFileSync).toHaveBeenCalledWith('/store/telemetry.jsonl', '')
  })
})

describe('summarizeErrorMisses', () => {
  it('returns [] for an empty log', () => {
    expect(summarizeErrorMisses([])).toEqual([])
  })

  it('groups by hash, counts, and orders by count desc', () => {
    const misses = summarizeErrorMisses([
      { kind: 'error-miss', hash: 'a', len: 10, ts: '2026-01-01' },
      { kind: 'error-miss', hash: 'b', len: 20, ts: '2026-01-02' },
      { kind: 'error-miss', hash: 'a', len: 10, ts: '2026-01-03' },
      { handlerId: 'h1', outcome: 'applied', ts: '2026-01-04' }, // ignored
    ])
    expect(misses).toHaveLength(2)
    expect(misses[0]).toMatchObject({ hash: 'a', count: 2, lastSeen: '2026-01-03' })
    expect(misses[1]).toMatchObject({ hash: 'b', count: 1 })
  })

  it('respects the limit', () => {
    const entries = ['a', 'b', 'c'].map(h => ({ kind: 'error-miss', hash: h, len: 1, ts: 't' }))
    expect(summarizeErrorMisses(entries, 2)).toHaveLength(2)
  })
})
