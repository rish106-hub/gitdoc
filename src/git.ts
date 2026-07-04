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
