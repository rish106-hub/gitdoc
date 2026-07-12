import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({ execFile: vi.fn() }))
vi.mock('fs')

import { guidanceFor, parseStatus, getRepositorySnapshot, RepositorySnapshot } from '../../src/companion'
import { execFile } from 'child_process'
import * as fs from 'fs'

const mockExec = execFile as unknown as ReturnType<typeof vi.fn>
const mockExistsSync = fs.existsSync as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

function snapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    branch: 'main',
    detached: false,
    unborn: false,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicts: 0,
    ahead: 0,
    behind: 0,
    ...overrides,
  }
}

describe('parseStatus', () => {
  it('reads branch + tracking header and counts staged/unstaged/untracked', () => {
    const state = parseStatus([
      '## feature/login...origin/feature/login',
      'M  staged.ts',
      ' M edited.ts',
      '?? new.ts',
    ].join('\n'))
    expect(state).toMatchObject({ branch: 'feature/login', staged: 1, unstaged: 1, untracked: 1, conflicts: 0 })
  })

  it('detects an unborn branch ("No commits yet on ...")', () => {
    const state = parseStatus('## No commits yet on main')
    expect(state.unborn).toBe(true)
    expect(state.branch).toBe('main')
    expect(state.detached).toBe(false)
  })

  it('detects detached HEAD ("HEAD (no branch)")', () => {
    const state = parseStatus('## HEAD (no branch)')
    expect(state.detached).toBe(true)
    expect(state.branch).toBeUndefined()
    expect(state.unborn).toBe(false)
  })

  it('counts conflict codes: UU, AA, DD, and any U-containing code', () => {
    const state = parseStatus([
      '## main',
      'UU a.ts',
      'AA b.ts',
      'DD c.ts',
      'AU d.ts',
      'UD e.ts',
    ].join('\n'))
    expect(state.conflicts).toBe(5)
    expect(state.staged).toBe(0)
    expect(state.unstaged).toBe(0)
  })

  it('counts both staged and unstaged for a fully-modified index entry ("MM")', () => {
    const state = parseStatus(['## main', 'MM both.ts'].join('\n'))
    expect(state.staged).toBe(1)
    expect(state.unstaged).toBe(1)
  })

  it('handles a branch name with no upstream (no "...")', () => {
    const state = parseStatus('## main')
    expect(state.branch).toBe('main')
  })

  it('handles empty status output without throwing', () => {
    expect(() => parseStatus('')).not.toThrow()
    const state = parseStatus('')
    expect(state.branch).toBeUndefined()
    expect(state.staged).toBe(0)
  })

  it('ignores blank lines interleaved in porcelain output', () => {
    const state = parseStatus('## main\n\n?? a.ts\n\n?? b.ts\n')
    expect(state.untracked).toBe(2)
  })

  it('stress: 5000 changed-file entries all count correctly, no throw', () => {
    const lines = ['## main']
    for (let i = 0; i < 5000; i++) lines.push(`?? file${i}.ts`)
    const state = parseStatus(lines.join('\n'))
    expect(state.untracked).toBe(5000)
  })

  it('does not choke on a branch name containing unusual characters', () => {
    const state = parseStatus('## feature/weird "name" (test)...origin/feature/weird "name" (test)')
    expect(state.branch).toContain('feature/weird')
  })
})

describe('guidanceFor — branch coverage', () => {
  it('null snapshot -> "open a repository" guidance', () => {
    expect(guidanceFor(null).title).toBe('Open a Git repository')
  })

  it('conflicts win over every other state, including an active operation', () => {
    const g = guidanceFor(snapshot({ conflicts: 2, operation: 'rebase', ahead: 1, behind: 1 }))
    expect(g.title).toBe('Git needs your decision')
  })

  it('rebase operation (no conflicts)', () => {
    expect(guidanceFor(snapshot({ operation: 'rebase' })).title).toBe('Rebase in progress')
  })

  it('merge operation (no conflicts) reads as ready-to-finish', () => {
    expect(guidanceFor(snapshot({ operation: 'merge' })).title).toBe('Merge ready to finish')
  })

  it('cherry-pick operation (no conflicts)', () => {
    expect(guidanceFor(snapshot({ operation: 'cherry-pick' })).title).toBe('Cherry-pick ready to finish')
  })

  it('detached HEAD, no operation/conflicts', () => {
    expect(guidanceFor(snapshot({ detached: true })).title).toBe('Viewing history, not a branch')
  })

  it('unborn branch', () => {
    expect(guidanceFor(snapshot({ unborn: true })).title).toBe('New repository')
  })

  it('ahead AND behind -> diverged guidance with both counts in the summary', () => {
    const g = guidanceFor(snapshot({ ahead: 2, behind: 3 }))
    expect(g.title).toBe('Your branch and remote both changed')
    expect(g.summary).toContain('2 local commit(s)')
    expect(g.summary).toContain('3 remote commit(s)')
  })

  it('behind only -> remote has newer work', () => {
    expect(guidanceFor(snapshot({ behind: 4 })).title).toBe('Remote has newer work')
  })

  it('ahead only -> your work is saved locally', () => {
    expect(guidanceFor(snapshot({ ahead: 4 })).title).toBe('Your work is saved locally')
  })

  it('working-tree changes, staged present -> "review staged" next step', () => {
    const g = guidanceFor(snapshot({ staged: 2 }))
    expect(g.title).toBe('Work in progress')
    expect(g.nextStep).toContain('Review staged changes')
  })

  it('working-tree changes, only unstaged/untracked -> "stage only files" next step', () => {
    const g = guidanceFor(snapshot({ unstaged: 1, untracked: 1 }))
    expect(g.nextStep).toContain('stage only files')
  })

  it('fully clean repo on a named branch', () => {
    const g = guidanceFor(snapshot())
    expect(g.title).toBe('Repository is clear')
    expect(g.summary).toContain('main')
  })

  it('fully clean repo with no branch name falls back to "your branch"', () => {
    const g = guidanceFor(snapshot({ branch: undefined }))
    expect(g.summary).toContain('your branch')
  })

  it('never throws for any combination across the whole flag space (stress: exhaustive boolean product)', () => {
    const bools = [false, true]
    const ops: Array<RepositorySnapshot['operation'] | undefined> = [undefined, 'merge', 'rebase', 'cherry-pick']
    for (const detached of bools) {
      for (const unborn of bools) {
        for (const op of ops) {
          for (const conflicts of [0, 1]) {
            for (const ahead of [0, 1]) {
              for (const behind of [0, 1]) {
                expect(() =>
                  guidanceFor(snapshot({ detached, unborn, operation: op, conflicts, ahead, behind }))
                ).not.toThrow()
              }
            }
          }
        }
      }
    }
  })
})

describe('getRepositorySnapshot', () => {
  function execImpl(handlers: Record<string, { stdout: string; stderr?: string } | Error>) {
    return (cmd: string, args: string[], _opts: unknown, cb: (e: Error | null, r?: { stdout: string; stderr: string }) => void) => {
      const key = args.join(' ')
      for (const [pattern, result] of Object.entries(handlers)) {
        if (key.includes(pattern)) {
          if (result instanceof Error) return cb(result)
          return cb(null, { stdout: result.stdout, stderr: result.stderr ?? '' })
        }
      }
      cb(new Error(`unhandled: ${key}`))
    }
  }

  it('returns null when `git status` itself fails (not a repo)', async () => {
    mockExec.mockImplementation(execImpl({ status: new Error('not a repo') }))
    expect(await getRepositorySnapshot('/nope')).toBeNull()
  })

  it('assembles a full snapshot: status + operation marker + ahead/behind', async () => {
    mockExistsSync.mockImplementation((p: string) => String(p).endsWith('MERGE_HEAD'))
    mockExec.mockImplementation(execImpl({
      'status --porcelain': { stdout: '## main...origin/main\nM  a.ts\n' },
      '@{u}': { stdout: 'origin/main\n' },
      'rev-list': { stdout: '2\t5\n' },
    }))
    const snap = await getRepositorySnapshot('/repo')
    expect(snap).not.toBeNull()
    expect(snap!.operation).toBe('merge')
    expect(snap!.ahead).toBe(2)
    expect(snap!.behind).toBe(5)
    expect(snap!.staged).toBe(1)
  })

  it('leaves ahead/behind at 0 when there is no upstream', async () => {
    mockExistsSync.mockReturnValue(false)
    mockExec.mockImplementation(execImpl({
      'status --porcelain': { stdout: '## main\n' },
      '@{u}': new Error('no upstream'),
      'rev-parse --abbrev-ref HEAD': { stdout: 'main\n' },
      'origin/main': new Error('no remote'),
    }))
    const snap = await getRepositorySnapshot('/repo')
    expect(snap!.ahead).toBe(0)
    expect(snap!.behind).toBe(0)
  })

  it('detects a paused rebase via rebase-apply as well as rebase-merge', async () => {
    mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rebase-apply'))
    mockExec.mockImplementation(execImpl({
      'status --porcelain': { stdout: '## main\n' },
      '@{u}': new Error('no upstream'),
      'rev-parse --abbrev-ref HEAD': { stdout: 'main\n' },
      'origin/main': new Error('no remote'),
    }))
    const snap = await getRepositorySnapshot('/repo')
    expect(snap!.operation).toBe('rebase')
  })
})
