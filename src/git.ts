import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(_execFile)

export interface ExecResult {
  stdout: string
  stderr: string
}

export async function git(cwd: string, args: string[]): Promise<ExecResult> {
  return execFileAsync('git', args, { cwd, timeout: 30_000 })
}

export async function gitSafe(cwd: string, args: string[]): Promise<ExecResult | null> {
  try {
    return await git(cwd, args)
  } catch {
    return null
  }
}

export interface AheadBehind {
  ahead: number
  behind: number
}

/**
 * Commits HEAD is ahead of / behind an upstream ref.
 * Uses `rev-list --left-right HEAD...upstream`: left count = ahead, right = behind.
 * Returns null if the range can't be computed (no upstream, detached, etc.).
 */
export async function getAheadBehind(cwd: string, upstream: string): Promise<AheadBehind | null> {
  const result = await gitSafe(cwd, ['rev-list', '--count', '--left-right', `HEAD...${upstream}`])
  if (!result) return null
  const parts = result.stdout.trim().split(/\s+/)
  if (parts.length !== 2) return null
  const ahead = parseInt(parts[0], 10)
  const behind = parseInt(parts[1], 10)
  if (Number.isNaN(ahead) || Number.isNaN(behind)) return null
  return { ahead, behind }
}

/** Unmerged (conflicted) paths in the working tree. */
export async function getConflicts(cwd: string): Promise<string[]> {
  const result = await gitSafe(cwd, ['diff', '--name-only', '--diff-filter=U'])
  if (!result) return []
  return result.stdout.trim().split('\n').filter(Boolean)
}

export async function getUpstream(cwd: string): Promise<string | null> {
  // Try @{u} first, fall back to origin/HEAD branch name
  const result = await gitSafe(cwd, ['rev-parse', '--abbrev-ref', '@{u}'])
  if (result) return result.stdout.trim()

  const branch = await gitSafe(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!branch) return null

  const branchName = branch.stdout.trim()
  const remoteCheck = await gitSafe(cwd, ['rev-parse', '--verify', `origin/${branchName}`])
  if (remoteCheck) return `origin/${branchName}`

  return null
}
