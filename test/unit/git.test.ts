import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUpstream, getAheadBehind, getConflicts } from '../../src/git'

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'child_process'

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUpstream', () => {
  it('returns upstream from @{u} when available', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, { stdout: 'origin/main\n', stderr: '' })
    })
    const result = await getUpstream('/repo')
    expect(result).toBe('origin/main')
  })

  it('falls back to origin/HEAD branch when @{u} fails', async () => {
    let callCount = 0
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
      callCount++
      if (callCount === 1 && args.includes('@{u}')) {
        cb(new Error('no upstream'))
      } else if (args.includes('HEAD')) {
        cb(null, { stdout: 'main\n', stderr: '' })
      } else if (args.includes('origin/main')) {
        cb(null, { stdout: 'abc123\n', stderr: '' })
      } else {
        cb(new Error('unexpected'))
      }
    })
    const result = await getUpstream('/repo')
    expect(result).toBe('origin/main')
  })

  it('returns null when no upstream found', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('not found'))
    })
    const result = await getUpstream('/repo')
    expect(result).toBeNull()
  })
})

describe('getAheadBehind', () => {
  it('parses "ahead\\tbehind" from rev-list --left-right', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(null, { stdout: '3\t5\n', stderr: '' })
    })
    expect(await getAheadBehind('/repo', 'origin/main')).toEqual({ ahead: 3, behind: 5 })
  })

  it('handles space-separated output', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(null, { stdout: '0 2', stderr: '' })
    })
    expect(await getAheadBehind('/repo', 'origin/main')).toEqual({ ahead: 0, behind: 2 })
  })

  it('returns null on non-numeric / malformed output', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(null, { stdout: 'garbage', stderr: '' })
    })
    expect(await getAheadBehind('/repo', 'origin/main')).toBeNull()
  })

  it('returns null when git fails', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(new Error('bad range'))
    })
    expect(await getAheadBehind('/repo', 'origin/main')).toBeNull()
  })
})

describe('getConflicts', () => {
  it('returns unmerged file list', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(null, { stdout: 'src/a.ts\nsrc/b.ts\n', stderr: '' })
    })
    expect(await getConflicts('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('returns empty array when none', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(null, { stdout: '\n', stderr: '' })
    })
    expect(await getConflicts('/repo')).toEqual([])
  })

  it('returns empty array when git fails', async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: unknown, cb: Function) => {
      cb(new Error('fail'))
    })
    expect(await getConflicts('/repo')).toEqual([])
  })
})
