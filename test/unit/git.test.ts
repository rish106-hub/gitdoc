import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUpstream } from '../../src/git'

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
