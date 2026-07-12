import { describe, expect, it } from 'vitest'
import { guidanceFor, parseStatus } from '../../src/companion'

describe('Git Companion status model', () => {
  it('turns everyday porcelain output into useful work counts', () => {
    const state = parseStatus([
      '## feature/login...origin/feature/login',
      'M  staged.ts',
      ' M edited.ts',
      '?? new.ts',
    ].join('\n'))
    expect(state).toMatchObject({ branch: 'feature/login', staged: 1, unstaged: 1, untracked: 1 })
  })

  it('prioritizes conflicts over all ordinary work guidance', () => {
    const guidance = guidanceFor({
      branch: 'main', detached: false, unborn: false, staged: 2, unstaged: 1,
      untracked: 0, conflicts: 1, ahead: 2, behind: 3,
    })
    expect(guidance.title).toBe('Git needs your decision')
    expect(guidance.nextStep).toContain('conflicted file')
  })

  it('explains a clean, everyday repository without needing an error', () => {
    const guidance = guidanceFor({
      branch: 'main', detached: false, unborn: false, staged: 0, unstaged: 0,
      untracked: 0, conflicts: 0, ahead: 0, behind: 0,
    })
    expect(guidance.title).toBe('Repository is clear')
  })
})
