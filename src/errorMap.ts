// Curated, versioned map of common git errors -> plain-English explanations.
// Each entry may reference a fixHandlerId; that id MUST exist in the handler
// registry (enforced by test/unit/errorMap.test.ts). Static + offline: no LLM,
// no tokens. This is the dataset miss-logging telemetry grows over time.

export const ERROR_MAP_VERSION = 1

export interface GitErrorEntry {
  id: string
  /** Signatures that identify this error in raw git output (case-insensitive). */
  match: RegExp[]
  /** Short human title. */
  title: string
  /** ELI10 — what this actually means, no jargon. */
  whatItMeans: string
  /** Why it happened. */
  why: string
  /**
   * Handler that fixes this IF the repo is currently in the matching detected
   * state. Offered as "Do the safe fix" only when that state is live.
   */
  fixHandlerId?: string
  /** Command to show as text when there's no live one-click fix. */
  suggestedCommand?: string
}

export const ERROR_MAP: GitErrorEntry[] = [
  {
    id: 'detached-head',
    match: [/detached head/i, /you are in .detached head. state/i],
    title: "You're on a detached HEAD",
    whatItMeans:
      "You're not on any branch right now — you're looking at a specific snapshot of history. Any commits you make here aren't attached to a branch and can be lost.",
    why: 'You checked out a specific commit or tag instead of a branch name.',
    fixHandlerId: 'h1-detached-head',
    suggestedCommand: 'git switch -c my-branch',
  },
  {
    id: 'merge-conflict',
    match: [/conflict \(content\): merge conflict in/i, /automatic merge failed/i, /fix conflicts and then commit/i],
    title: 'You have a merge conflict',
    whatItMeans:
      'Two changes touched the same lines, so git needs you to choose which version to keep before it can finish the merge.',
    why: 'You merged (or pulled) a branch whose changes overlap with yours.',
    fixHandlerId: 'h2-merge-conflict',
    suggestedCommand: 'git status   # see conflicted files, edit them, then git add',
  },
  {
    id: 'unmerged-paths',
    match: [/you have unmerged paths/i, /fix them up in the work tree/i, /needs merge/i],
    title: 'Some files still have unresolved conflicts',
    whatItMeans:
      "git can't continue until you resolve the conflicts and mark those files as done.",
    why: "You're mid-merge/rebase and at least one file still has conflict markers.",
    fixHandlerId: 'h2-merge-conflict',
    suggestedCommand: 'git add <resolved-file>   # then continue',
  },
  {
    id: 'rebase-conflict',
    match: [/could not apply/i, /resolve all conflicts manually.*git rebase --continue/i, /when you have resolved this problem, run .git rebase --continue/i],
    title: 'Your rebase is paused on a conflict',
    whatItMeans:
      'git is replaying your commits one at a time and hit a conflict. Fix it, then tell git to continue (or abort to bail out).',
    why: "You ran a rebase and one of your commits clashes with the branch you're rebasing onto.",
    fixHandlerId: 'h3-rebase-in-progress',
    suggestedCommand: 'git rebase --continue   # or: git rebase --abort',
  },
  {
    id: 'cherry-pick-conflict',
    match: [/after resolving the conflicts.*git cherry-pick --continue/i, /cherry-pick.*--continue/i],
    title: 'Your cherry-pick hit a conflict',
    whatItMeans:
      'The commit you tried to copy over conflicts with what you have. Resolve it, then continue or abort.',
    why: 'You cherry-picked a commit whose changes overlap with your current branch.',
    fixHandlerId: 'h7-cherry-pick-in-progress',
    suggestedCommand: 'git cherry-pick --continue   # or: git cherry-pick --abort',
  },
  {
    id: 'local-changes-overwrite',
    match: [
      /your local changes to the following files would be overwritten/i,
      /please commit your changes or stash them before you (merge|switch|checkout)/i,
      /commit your changes or stash them before you/i,
    ],
    title: 'Your uncommitted changes are in the way',
    whatItMeans:
      "git won't proceed because it would have to overwrite edits you haven't saved. You need to either tuck them away (stash) or throw them out.",
    why: 'You have uncommitted edits to files that the incoming operation also wants to change.',
    fixHandlerId: 'h4-local-changes-overwrite',
    suggestedCommand: 'git stash   # tuck changes away safely; git stash pop to bring them back',
  },
  {
    id: 'non-fast-forward',
    match: [
      /updates were rejected because the tip of your current branch is behind/i,
      /failed to push some refs/i,
      /non-fast-forward/i,
    ],
    title: 'Your push was rejected — the remote moved ahead',
    whatItMeans:
      "Someone (or another machine) pushed commits you don't have yet. git won't let you push over them until you catch up.",
    why: 'The remote branch has commits your local branch is missing.',
    fixHandlerId: 'h8-branch-diverged',
    suggestedCommand: 'git pull --rebase   # get their commits, replay yours on top, then push',
  },
  {
    id: 'diverged',
    match: [/have diverged/i, /and have \d+ and \d+ different commits each/i],
    title: 'Your branch and the remote have diverged',
    whatItMeans:
      "Both you and the remote have commits the other doesn't. You need to combine the two histories before pushing.",
    why: 'You committed locally while the remote also gained commits.',
    fixHandlerId: 'h8-branch-diverged',
    suggestedCommand: 'git pull --rebase',
  },
  {
    id: 'not-a-repo',
    match: [/not a git repository/i, /fatal: not a git repository/i],
    title: "This folder isn't a git repository",
    whatItMeans:
      "git has no history here yet. There's nothing to commit or push until you start tracking the folder.",
    why: "You ran a git command in a folder that was never initialized with git.",
    suggestedCommand: 'git init   # start tracking this folder',
  },
  {
    id: 'nothing-to-commit',
    match: [/nothing to commit, working tree clean/i],
    title: 'Nothing to commit',
    whatItMeans:
      "There are no changes to save — everything is already committed. This isn't an error, just git telling you you're up to date.",
    why: 'You ran commit but no files have changed since the last one.',
  },
  {
    id: 'unrelated-histories',
    match: [/refusing to merge unrelated histories/i],
    title: "These two branches don't share any history",
    whatItMeans:
      "git thinks these are two completely separate projects and won't merge them by accident. If you really mean to combine them, you have to say so explicitly.",
    why: 'You tried to merge/pull two repos that were started separately (common after re-initializing or cloning wrong).',
    suggestedCommand: 'git pull origin main --allow-unrelated-histories',
  },
  {
    id: 'pathspec-no-match',
    match: [/pathspec .* did not match any file/i, /error: pathspec/i],
    title: "git can't find that branch or file",
    whatItMeans:
      "The branch, file, or path you named doesn't exist (check the spelling, or the branch may not be created yet).",
    why: 'A typo, or the branch/file was never created or was deleted.',
    suggestedCommand: 'git branch -a   # list all branches; git status for files',
  },
  {
    id: 'no-upstream',
    match: [/there is no tracking information for the current branch/i, /no upstream branch/i, /set the upstream/i],
    title: 'This branch has no remote to push to yet',
    whatItMeans:
      "git doesn't know which remote branch this one belongs to, so it doesn't know where to push or pull.",
    why: 'You created the branch locally and never pushed it with an upstream set.',
    suggestedCommand: 'git push -u origin HEAD   # push and remember the remote',
  },
  {
    id: 'permission-denied',
    match: [/permission denied \(publickey\)/i, /remote: permission to .* denied/i, /authentication failed/i],
    title: "The remote rejected your access",
    whatItMeans:
      "The server won't let you in — either your credentials/SSH key aren't set up, or you don't have write access to this repo.",
    why: 'Missing/incorrect SSH key or token, or you lack permission on the remote.',
    suggestedCommand: 'gh auth login   # or set up an SSH key / personal access token',
  },
  {
    id: 'detached-after-checkout-sha',
    match: [/note: switching to/i, /you can return to the original branch/i],
    title: 'You checked out a commit, not a branch',
    whatItMeans:
      "You're now in detached HEAD — viewing an old snapshot. Make a branch here if you want to keep any new work.",
    why: 'You ran checkout/switch with a commit hash or tag instead of a branch name.',
    fixHandlerId: 'h1-detached-head',
    suggestedCommand: 'git switch -c my-branch',
  },
  {
    id: 'stash-conflict',
    match: [/conflict.*stash/i, /the stash entry is kept in case you need it again/i],
    title: 'Applying your stash caused a conflict',
    whatItMeans:
      "The changes you tucked away clash with what's in your files now. Resolve the conflict; your stash is kept until you're done.",
    why: 'The working tree changed since you stashed, so popping it conflicts.',
    fixHandlerId: 'h6-stash-conflict',
    suggestedCommand: 'git status   # resolve conflicts, git add, then git stash drop',
  },
  {
    id: 'behind-remote',
    match: [/your branch is behind .* and can be fast-forwarded/i, /your branch is behind/i],
    title: 'Your branch is behind the remote',
    whatItMeans:
      "The remote has newer commits than you. Pull to catch up — this one is simple, no conflicts expected.",
    why: 'New commits were pushed to the remote since you last pulled.',
    suggestedCommand: 'git pull',
  },
  {
    id: 'detached-commit-warning',
    match: [/warning: you are leaving \d+ commits? behind/i, /leaving .* commits behind, not connected to/i],
    title: "You're about to lose commits that aren't on a branch",
    whatItMeans:
      "You made commits in detached HEAD and are switching away — those commits will become hard to find unless you put them on a branch first.",
    why: 'You committed while detached, then switched branches without saving them.',
    fixHandlerId: 'h1-detached-head',
    suggestedCommand: 'git branch keep-my-work <commit-sha>',
  },
]

/**
 * Find the first error entry whose signatures match the given git output text.
 * Returns null when nothing matches (caller should log a miss + explain generically).
 */
export function matchError(text: string): GitErrorEntry | null {
  if (!text) return null
  for (const entry of ERROR_MAP) {
    if (entry.match.some(re => re.test(text))) return entry
  }
  return null
}

// Reverse index: handler id -> its error entry (first match wins). Lives here (not
// in explainer.ts) so handlers.ts can read it without importing explainer, avoiding
// an explainer<->handlers import cycle.
const ERROR_MAP_BY_HANDLER: Record<string, GitErrorEntry> = (() => {
  const idx: Record<string, GitErrorEntry> = {}
  for (const e of ERROR_MAP) {
    if (e.fixHandlerId && !idx[e.fixHandlerId]) idx[e.fixHandlerId] = e
  }
  return idx
})()

export function entryForHandler(handlerId: string): GitErrorEntry | undefined {
  return ERROR_MAP_BY_HANDLER[handlerId]
}

/** Plain-English text for a handler's state, for embedding in destructive confirms. */
export function explainerTextForHandler(handlerId: string): string | undefined {
  return ERROR_MAP_BY_HANDLER[handlerId]?.whatItMeans
}
