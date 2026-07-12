import * as fs from 'fs'
import * as path from 'path'
import { getAheadBehind, getGitDir, getUpstream, gitSafe } from './git'

export interface RepositorySnapshot {
  branch?: string
  detached: boolean
  unborn: boolean
  staged: number
  unstaged: number
  untracked: number
  conflicts: number
  ahead: number
  behind: number
  operation?: 'merge' | 'rebase' | 'cherry-pick'
}

export interface CompanionGuidance {
  title: string
  summary: string
  nextStep: string
}

/** Parse porcelain v1 output. Kept pure so Git's everyday states stay testable. */
export function parseStatus(output: string): RepositorySnapshot {
  const [header = '', ...entries] = output.split('\n').filter(Boolean)
  const head = header.replace(/^##\s*/, '')
  const unborn = /^No commits yet on /.test(head)
  const detached = /^HEAD \(no branch\)/.test(head)
  const branch = unborn
    ? head.replace(/^No commits yet on /, '')
    : detached
      ? undefined
      : head.split('...')[0].split(' ')[0] || undefined

  let staged = 0
  let unstaged = 0
  let untracked = 0
  let conflicts = 0
  for (const entry of entries) {
    const code = entry.slice(0, 2)
    if (code === '??') { untracked++; continue }
    if (/[U]/.test(code) || ['AA', 'DD'].includes(code)) { conflicts++; continue }
    if (code[0] !== ' ') staged++
    if (code[1] !== ' ') unstaged++
  }
  return { branch, detached, unborn, staged, unstaged, untracked, conflicts, ahead: 0, behind: 0 }
}

export function guidanceFor(snapshot: RepositorySnapshot | null): CompanionGuidance {
  if (!snapshot) return {
    title: 'Open a Git repository',
    summary: 'This folder is not tracked by Git yet.',
    nextStep: 'Initialize Git here, or open a project that already has a repository.',
  }
  if (snapshot.conflicts > 0) return {
    title: 'Git needs your decision',
    summary: `${snapshot.conflicts} file(s) contain competing changes. Git stopped to protect both versions.`,
    nextStep: 'Open each conflicted file, choose the final content, then stage it before continuing.',
  }
  if (snapshot.operation === 'rebase') return {
    title: 'Rebase in progress',
    summary: 'Git is replaying your commits onto newer history.',
    nextStep: 'Review changes. Continue when ready, or abort to return to the earlier history.',
  }
  if (snapshot.operation === 'merge') return {
    title: 'Merge ready to finish',
    summary: 'All merge conflicts are resolved; Git is waiting for the merge commit.',
    nextStep: 'Review the resolved files, then complete the merge.',
  }
  if (snapshot.operation === 'cherry-pick') return {
    title: 'Cherry-pick ready to finish',
    summary: 'Git is applying one commit from another branch.',
    nextStep: 'Review the result, then continue the cherry-pick or abort it.',
  }
  if (snapshot.detached) return {
    title: 'Viewing history, not a branch',
    summary: 'New commits here are not attached to a named branch.',
    nextStep: 'Create a branch before doing work you want to keep.',
  }
  if (snapshot.unborn) return {
    title: 'New repository',
    summary: 'Git is ready, but this project has no commits yet.',
    nextStep: 'Stage your first files, then make an initial commit.',
  }
  if (snapshot.conflicts === 0 && snapshot.behind > 0 && snapshot.ahead > 0) return {
    title: 'Your branch and remote both changed',
    summary: `${snapshot.ahead} local commit(s) ahead and ${snapshot.behind} remote commit(s) behind.`,
    nextStep: 'Pull/rebase after checking your working tree is clean, then push.',
  }
  if (snapshot.behind > 0) return {
    title: 'Remote has newer work',
    summary: `${snapshot.behind} commit(s) are waiting on your remote branch.`,
    nextStep: 'Pull when you are ready to bring those changes into this workspace.',
  }
  if (snapshot.ahead > 0) return {
    title: 'Your work is saved locally',
    summary: `${snapshot.ahead} commit(s) have not been pushed yet.`,
    nextStep: 'Push when the commits are ready for teammates or backup.',
  }
  const changed = snapshot.staged + snapshot.unstaged + snapshot.untracked
  if (changed > 0) return {
    title: 'Work in progress',
    summary: `${snapshot.staged} staged, ${snapshot.unstaged} modified, ${snapshot.untracked} untracked file(s).`,
    nextStep: snapshot.staged > 0 ? 'Review staged changes, then commit when this is a coherent checkpoint.' : 'Review changes and stage only files that belong in your next checkpoint.',
  }
  return {
    title: 'Repository is clear',
    summary: `On ${snapshot.branch ?? 'your branch'} with no uncommitted changes.`,
    nextStep: 'Keep working, or use Ask GitRescue when a Git message is unclear.',
  }
}

function operationAt(gitDir: string): RepositorySnapshot['operation'] | undefined {
  if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) return 'merge'
  if (fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'))) return 'cherry-pick'
  if (fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'))) return 'rebase'
  return undefined
}

export async function getRepositorySnapshot(cwd: string): Promise<RepositorySnapshot | null> {
  const status = await gitSafe(cwd, ['status', '--porcelain=v1', '--branch'])
  if (!status) return null
  const snapshot = parseStatus(status.stdout)
  snapshot.operation = operationAt(getGitDir(cwd))
  const upstream = await getUpstream(cwd)
  if (upstream) {
    const ab = await getAheadBehind(cwd, upstream)
    if (ab) Object.assign(snapshot, ab)
  }
  return snapshot
}
