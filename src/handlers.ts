import * as fs from 'fs'
import * as path from 'path'
import { Handler } from './types'
import { git, gitSafe, getUpstream, getAheadBehind, getConflicts } from './git'
import { confirmSafe, confirmDestructive, quickPick, showInfo, showError, getOutputChannel, previewCommand } from './ui'
import { logHandlerRun } from './telemetry'
import { explainerTextForHandler } from './errorMap'

/** Prefix a destructive step-1 message with plain-English context, if we have it. */
function withExplainer(handlerId: string, message: string): string {
  const ex = explainerTextForHandler(handlerId)
  return ex ? `${ex}\n\n${message}` : message
}

/** Log the full conflict list to the Output channel so the count in the toast is actionable. */
function reportConflicts(context: string, files: string[]): void {
  const ch = getOutputChannel()
  ch.appendLine(`[${context}] ${files.length} conflict(s):`)
  files.forEach(f => ch.appendLine(`  - ${f}`))
}

function readGitFile(root: string, file: string): string | null {
  try {
    return fs.readFileSync(path.join(root, '.git', file), 'utf8').trim()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

// Handler #1: Detached HEAD
const detachedHead: Handler = {
  id: 'h1-detached-head',
  destructive: false,
  advisory: true,
  detect: (ctx) => {
    const head = readGitFile(ctx.workspaceRoot, 'HEAD')
    return !!head && !head.startsWith('ref:')
  },
  handle: async (ctx) => {
    const head = readGitFile(ctx.workspaceRoot, 'HEAD')
    const short = head?.slice(0, 8) ?? 'unknown'
    // Count commits made while detached (not reachable from any branch) so we can
    // tell the user whether they have work at risk.
    const orphan = await gitSafe(ctx.workspaceRoot, ['log', '--branches', '--not', 'HEAD', '--oneline'])
    const detachedCommits = await gitSafe(ctx.workspaceRoot, ['log', 'HEAD', '--not', '--branches', '--oneline'])
    const atRisk = detachedCommits?.stdout.trim().split('\n').filter(Boolean).length ?? 0
    void orphan
    const risk = atRisk > 0
      ? ` You have ${atRisk} commit(s) here that no branch points to — creating a branch keeps them.`
      : ''
    const ok = await confirmSafe(
      `Detached HEAD at ${short}.${risk} Create a branch to save your work?`
    )
    if (!ok) { logHandlerRun('h1-detached-head', 'cancelled'); return }
    const name = await quickPick('Name for new branch:', [
      { label: 'recovery/detached', description: 'safe default' },
      { label: 'temp/work', description: '' },
    ])
    if (!name) { logHandlerRun('h1-detached-head', 'cancelled'); return }
    // checkout -b moves the current (detached) commits onto the new branch
    await git(ctx.workspaceRoot, ['checkout', '-b', name])
    logHandlerRun('h1-detached-head', 'applied')
    showInfo(`Branch '${name}' created${atRisk > 0 ? ` with your ${atRisk} commit(s)` : ''}. You're safe.`)
  },
}

// Handler #2: Merge conflict
const mergeConflict: Handler = {
  id: 'h2-merge-conflict',
  destructive: false,
  advisory: false,
  detect: (ctx) => !!readGitFile(ctx.workspaceRoot, 'MERGE_HEAD'),
  handle: async (ctx) => {
    const unresolved = await getConflicts(ctx.workspaceRoot)
    if (unresolved.length > 0) {
      reportConflicts('merge', unresolved)
      showInfo(`Merge in progress. ${unresolved.length} conflict(s) remaining (see Output → GitRescue): ${unresolved.slice(0, 3).join(', ')}`)
      logHandlerRun('h2-merge-conflict', 'applied')
      return
    }
    const ok = await confirmSafe('All conflicts resolved. Complete the merge?')
    if (!ok) { logHandlerRun('h2-merge-conflict', 'cancelled'); return }
    await git(ctx.workspaceRoot, ['commit', '--no-edit'])
    logHandlerRun('h2-merge-conflict', 'applied')
    showInfo('Merge complete.')
  },
}

// Handler #3: Rebase in progress
const rebaseInProgress: Handler = {
  id: 'h3-rebase-in-progress',
  destructive: false,
  advisory: false,
  detect: (ctx) => {
    try {
      fs.accessSync(path.join(ctx.workspaceRoot, '.git', 'rebase-merge'))
      return true
    } catch {
      return false
    }
  },
  handle: async (ctx) => {
    const unresolved = await getConflicts(ctx.workspaceRoot)
    if (unresolved.length > 0) {
      reportConflicts('rebase', unresolved)
      showInfo(`Rebase paused. ${unresolved.length} conflict(s) to resolve (see Output → GitRescue).`)
      logHandlerRun('h3-rebase-in-progress', 'applied')
      return
    }
    const choice = await quickPick('Rebase conflict resolved. What next?', [
      { label: 'Continue rebase', description: 'git rebase --continue' },
      { label: 'Abort rebase', description: 'git rebase --abort' },
    ])
    if (!choice) { logHandlerRun('h3-rebase-in-progress', 'cancelled'); return }
    const args = choice === 'Continue rebase' ? ['rebase', '--continue'] : ['rebase', '--abort']
    await git(ctx.workspaceRoot, args)
    logHandlerRun('h3-rebase-in-progress', 'applied')
    showInfo(choice === 'Continue rebase' ? 'Rebase continued.' : 'Rebase aborted.')
  },
}

// Handler #4: Local changes would be overwritten (checkout/pull failure)
const localChangesOverwrite: Handler = {
  id: 'h4-local-changes-overwrite',
  destructive: false,
  advisory: false,
  detect: (ctx) => {
    // Detect via ORIG_HEAD written by failed pull + dirty working tree
    const origHead = readGitFile(ctx.workspaceRoot, 'ORIG_HEAD')
    if (!origHead) return false
    const result = fs.existsSync(path.join(ctx.workspaceRoot, '.git', 'MERGE_HEAD'))
    return !result // ORIG_HEAD without MERGE_HEAD = failed pull scenario
  },
  handle: async (ctx) => {
    const choice = await quickPick(
      'Your local changes conflict with incoming changes. What do you want to do?',
      [
        { label: 'Stash my changes', description: 'Saves your work temporarily (safe)' },
        { label: 'Discard my changes', description: 'git reset --hard — DESTRUCTIVE, cannot undo' },
      ]
    )
    if (!choice) { logHandlerRun('h4-local-changes-overwrite', 'cancelled'); return }

    if (choice === 'Stash my changes') {
      await git(ctx.workspaceRoot, ['stash'])
      logHandlerRun('h4-local-changes-overwrite', 'applied')
      showInfo('Changes stashed. Run git stash pop to restore them later.')
      return
    }

    // Destructive path: 2-step confirm, with plain-English context embedded (P2)
    const ok = await confirmDestructive(
      withExplainer('h4-local-changes-overwrite', 'This will permanently discard all local changes. Are you sure?'),
      `Execute "${previewCommand(['reset', '--hard'])}"? This cannot be undone.`
    )
    if (!ok) { logHandlerRun('h4-local-changes-overwrite', 'cancelled'); return }
    await git(ctx.workspaceRoot, ['reset', '--hard'])
    logHandlerRun('h4-local-changes-overwrite', 'applied')
    showInfo('Local changes discarded.')
  },
}

// Handler #5: Undo last commit (reset HEAD~1)
const undoLastCommit: Handler = {
  id: 'h5-undo-last-commit',
  destructive: true,
  advisory: false,
  commandOnly: true,
  detect: (_ctx) => false, // command-triggered only, not auto-detected
  handle: async (ctx) => {
    const log = await gitSafe(ctx.workspaceRoot, ['log', '--oneline', '-1'])
    const lastCommit = log?.stdout.trim() ?? 'unknown'
    const before = (await gitSafe(ctx.workspaceRoot, ['rev-parse', 'HEAD']))?.stdout.trim()

    const ok = await confirmDestructive(
      `Undo last commit: "${lastCommit}"? Changes kept in working directory.`,
      `Execute "${previewCommand(['reset', 'HEAD~1'])}"? This rewrites history.`
    )
    if (!ok) { logHandlerRun('h5-undo-last-commit', 'cancelled'); return }
    await git(ctx.workspaceRoot, ['reset', 'HEAD~1'])
    const after = (await gitSafe(ctx.workspaceRoot, ['rev-parse', 'HEAD']))?.stdout.trim()
    const ch = getOutputChannel()
    ch.appendLine(`[undo] reset HEAD~1: ${before ?? '?'} -> ${after ?? '?'} (was "${lastCommit}")`)
    logHandlerRun('h5-undo-last-commit', 'applied')
    showInfo('Last commit undone. Changes are back in your working directory. (see Output → GitRescue)')
  },
}

// Handler #6: Stash conflict on pop
const stashConflict: Handler = {
  id: 'h6-stash-conflict',
  destructive: false,
  advisory: false,
  detect: (ctx) => {
    // stash pop failure leaves MERGE_HEAD absent but leaves index in conflict state
    // Detect: stash list non-empty + unmerged paths
    const stashExists = readGitFile(ctx.workspaceRoot, path.join('refs', 'stash'))
    if (!stashExists) return false
    const mergeHead = readGitFile(ctx.workspaceRoot, 'MERGE_HEAD')
    return !mergeHead // conflict from stash pop, not merge
  },
  handle: async (ctx) => {
    const unresolved = await getConflicts(ctx.workspaceRoot)
    if (unresolved.length === 0) return

    reportConflicts('stash pop', unresolved)
    showInfo(`Stash conflict: ${unresolved.length} file(s) have conflicts (see Output → GitRescue). Resolve them, then run "git add" to mark resolved.`)
    logHandlerRun('h6-stash-conflict', 'applied')
  },
}

// Handler #7: Cherry-pick in progress
const cherryPickInProgress: Handler = {
  id: 'h7-cherry-pick-in-progress',
  destructive: false,
  advisory: false,
  detect: (ctx) => !!readGitFile(ctx.workspaceRoot, 'CHERRY_PICK_HEAD'),
  handle: async (ctx) => {
    const unresolved = await getConflicts(ctx.workspaceRoot)
    if (unresolved.length > 0) {
      reportConflicts('cherry-pick', unresolved)
      showInfo(`Cherry-pick paused. ${unresolved.length} conflict(s) to resolve (see Output → GitRescue).`)
      logHandlerRun('h7-cherry-pick-in-progress', 'applied')
      return
    }
    const choice = await quickPick('Cherry-pick conflict resolved. What next?', [
      { label: 'Continue cherry-pick', description: 'git cherry-pick --continue' },
      { label: 'Abort cherry-pick', description: 'git cherry-pick --abort' },
    ])
    if (!choice) { logHandlerRun('h7-cherry-pick-in-progress', 'cancelled'); return }
    const args = choice.includes('Continue')
      ? ['cherry-pick', '--continue']
      : ['cherry-pick', '--abort']
    await git(ctx.workspaceRoot, args)
    logHandlerRun('h7-cherry-pick-in-progress', 'applied')
    showInfo(choice.includes('Continue') ? 'Cherry-pick continued.' : 'Cherry-pick aborted.')
  },
}

// Handler #8: Branch diverged from remote
const branchDiverged: Handler = {
  id: 'h8-branch-diverged',
  destructive: false,
  advisory: true,
  detect: async (ctx) => {
    const upstream = await getUpstream(ctx.workspaceRoot)
    if (!upstream) return false
    await gitSafe(ctx.workspaceRoot, ['fetch', '--quiet'])
    const ab = await getAheadBehind(ctx.workspaceRoot, upstream)
    // Diverged = both sides have unique commits
    return !!ab && ab.ahead > 0 && ab.behind > 0
  },
  handle: async (ctx) => {
    const upstream = await getUpstream(ctx.workspaceRoot)
    const ab = upstream ? await getAheadBehind(ctx.workspaceRoot, upstream) : null
    const detail = ab
      ? `${ab.ahead} local commit(s) ahead, ${ab.behind} behind ${upstream}.`
      : 'Your branch has diverged from remote.'
    const ok = await confirmSafe(
      `${detail} Pull with rebase to replay your work on top? (git pull --rebase)`
    )
    if (!ok) { logHandlerRun('h8-branch-diverged', 'cancelled'); return }
    await git(ctx.workspaceRoot, ['pull', '--rebase'])
    logHandlerRun('h8-branch-diverged', 'applied')
    showInfo('Pull with rebase complete.')
  },
}

// Handler #9: Force push (push rejected, not fast-forward)
const forcePush: Handler = {
  id: 'h9-force-push',
  destructive: true,
  advisory: false,
  commandOnly: true,
  detect: (_ctx) => false, // command-triggered only
  handle: async (ctx) => {
    const upstream = await getUpstream(ctx.workspaceRoot)
    if (!upstream) { showError('No upstream configured.'); return }

    const parts = upstream.split('/')
    const remote = parts[0]
    const branch = parts.slice(1).join('/')

    const ok = await confirmDestructive(
      `Force push to ${upstream}? This overwrites remote history.`,
      `Execute "${previewCommand(['push', '--force-with-lease', remote, branch])}"? Others may lose work.`
    )
    if (!ok) { logHandlerRun('h9-force-push', 'cancelled'); return }
    const result = await git(ctx.workspaceRoot, ['push', '--force-with-lease', remote, branch])
    const ch = getOutputChannel()
    ch.appendLine(`[force-push] git push --force-with-lease ${remote} ${branch}`)
    const detail = (result.stderr || result.stdout).trim()
    if (detail) ch.appendLine(`  ${detail.split('\n').join('\n  ')}`)
    logHandlerRun('h9-force-push', 'applied')
    showInfo(`Force push to ${upstream} complete. (see Output → GitRescue)`)
  },
}

// Handler #10: Branch far behind remote (advisory)
//
// T10 (eng review) called for a polling merge wizard with a 30-minute timeout,
// to bound an indefinite background process on abandoned merges. We replaced
// polling with the event-driven FSWatcher in detection.ts: state is re-checked
// only when .git/ actually changes, never on a timer. That eliminates the
// runaway-process risk entirely, so no timeout is needed. This handler is a
// stateless advisory triggered per detection cycle.
const mergeWizard: Handler = {
  id: 'h10-merge-wizard',
  destructive: false,
  advisory: true,
  detect: async (ctx) => {
    // Branch significantly behind remote (>10 commits) = merge wizard candidate
    const upstream = await getUpstream(ctx.workspaceRoot)
    if (!upstream) return false
    const result = await gitSafe(ctx.workspaceRoot, ['rev-list', '--count', `HEAD..${upstream}`])
    if (!result) return false
    return parseInt(result.stdout.trim()) > 10
  },
  handle: async (ctx) => {
    const upstream = await getUpstream(ctx.workspaceRoot)
    showInfo(`Your branch is significantly behind ${upstream ?? 'remote'}. Consider pulling to stay up to date.`)
    logHandlerRun('h10-merge-wizard', 'applied')
  },
}

export const handlers: Handler[] = [
  detachedHead,
  mergeConflict,
  rebaseInProgress,
  localChangesOverwrite,
  cherryPickInProgress,
  stashConflict,
  branchDiverged,
  mergeWizard,
  // command-only (not auto-detected):
  undoLastCommit,
  forcePush,
]

// Export individually for command registration
export {
  undoLastCommit,
  forcePush,
}
