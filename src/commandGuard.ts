// Safety classifier for AI-proposed git commands.
//
// GitRescue's deterministic path uses hand-audited handlers. The opt-in AI chat
// is the ONE place an LLM may propose a git command — so this module is the
// single line of defense between an LLM's argv and `git()` (which runs whatever
// argv it is given, with no validation of its own). The LLM's own opinion of
// whether a command is "destructive" is never trusted; classification happens
// here, in code, from the argv alone.
//
//   'blocked'  — catastrophic / irreversible / out-of-scope. Never executed;
//                surfaced to the user as copy-paste text to run manually.
//   'mutating' — changes repo state but is recoverable. Two-step confirm.
//   'read'     — cannot change anything. Auto-run so the AI can investigate.

export type CommandClass = 'read' | 'mutating' | 'blocked'

/** Read-only subcommands: cannot mutate the repo, safe to auto-run. */
const READ_ONLY = new Set([
  'status', 'log', 'diff', 'show', 'rev-parse', 'rev-list', 'branch',
  'remote', 'stash', 'config', 'ls-files', 'blame', 'describe', 'shortlog',
  'reflog', 'tag', 'cat-file', 'name-rev', 'whatchanged',
])

/**
 * Subcommands that are always safe to auto-run regardless of flags (pure reads).
 * `branch`/`remote`/`stash`/`config`/`tag`/`reflog` are read-only ONLY in their
 * listing forms; their mutating/destructive forms are handled below.
 */
const ALWAYS_READ = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'rev-list', 'ls-files', 'blame', 'describe', 'shortlog', 'cat-file', 'name-rev', 'whatchanged'])

/** Mutating-but-recoverable subcommands: allowed behind a two-step confirm. */
const MUTATING = new Set([
  'add', 'commit', 'checkout', 'switch', 'merge', 'fetch', 'pull', 'stash',
  'tag', 'branch', 'restore', 'cherry-pick', 'revert', 'mv', 'init', 'apply',
])

/** Flags/tokens that make ANY command catastrophic. */
const DANGEROUS_FLAGS = new Set([
  '--hard', '--force', '-f', '--force-with-lease', '-D', '-fd', '-fdx', '-fx',
  '-df', '-xf', '--prune', '--exec',
])

/** Subcommands that are always blocked — history rewrite / mass deletion. */
const BLOCKED_SUBCOMMANDS = new Set([
  'filter-branch', 'filter-repo', 'rm', 'clean', 'update-ref', 'gc',
  'reset', 'push', 'rebase', 'reflog',
])

/** Only word-ish tokens are allowed. Anything with shell metacharacters is blocked. */
const SHELL_METACHAR = /[;&|`$(){}<>\n\r\\]|\$\(|&&|\|\|/

/**
 * Classify an AI-proposed git command from its argv (WITHOUT the leading "git").
 * Conservative by construction: anything not positively recognized is blocked.
 */
export function classifyProposedCommand(argv: string[]): CommandClass {
  if (!Array.isArray(argv) || argv.length === 0) return 'blocked'

  // Reject shell-injection attempts and the `-c key=val` config override trick.
  for (const tok of argv) {
    if (typeof tok !== 'string' || SHELL_METACHAR.test(tok)) return 'blocked'
  }
  // `git -c core.pager=… <cmd>` and `git --exec-path=…` can smuggle behavior.
  if (argv[0].startsWith('-')) return 'blocked'

  const sub = argv[0]
  const rest = argv.slice(1)
  const flags = rest.filter(a => a.startsWith('-'))

  // Any dangerous flag anywhere → blocked, regardless of subcommand.
  if (flags.some(f => DANGEROUS_FLAGS.has(f))) return 'blocked'

  // push is blocked outright (network-visible, force variants especially) — the
  // audited h9 handler is the only sanctioned force-push path.
  if (sub === 'push') return 'blocked'

  // reset: --hard already caught above; --soft/--mixed still rewrite the index/
  // HEAD in ways that surprise beginners. Block all AI-driven resets.
  if (sub === 'reset') return 'blocked'

  // rebase and history-rewrite tools: always blocked.
  if (BLOCKED_SUBCOMMANDS.has(sub)) return 'blocked'

  // Destructive forms of otherwise-listy subcommands.
  if (sub === 'branch' && flags.some(f => /^-D$|^-d$|^--delete$|^--force$/.test(f))) return 'blocked'
  if (sub === 'tag' && flags.some(f => /^-d$|^--delete$/.test(f))) return 'blocked'
  if (sub === 'stash' && (rest[0] === 'drop' || rest[0] === 'clear')) return 'blocked'
  if (sub === 'remote' && ['add', 'remove', 'rm', 'set-url', 'rename'].includes(rest[0])) return 'blocked'
  if (sub === 'config' && !flags.some(f => f === '--get' || f === '--list' || f === '-l' || f === '--get-all')) return 'blocked'
  if ((sub === 'checkout' || sub === 'switch' || sub === 'restore') &&
      (flags.includes('--force') || flags.includes('-f') || flags.includes('--discard-changes'))) return 'blocked'

  // Pure reads.
  if (ALWAYS_READ.has(sub)) return 'read'
  if (sub === 'branch' && (rest.length === 0 || flags.some(f => /^--list$|^-a$|^-r$|^-v$|^-vv$/.test(f)))) return 'read'
  if (sub === 'remote' && (rest.length === 0 || rest[0] === '-v' || rest[0] === 'show' || rest[0] === 'get-url')) return 'read'
  if (sub === 'stash' && (rest.length === 0 || rest[0] === 'list' || rest[0] === 'show')) return 'read'
  if (sub === 'config' && flags.some(f => f === '--get' || f === '--list' || f === '-l' || f === '--get-all')) return 'read'
  if (sub === 'tag' && rest.every(a => a.startsWith('-')) && !flags.some(f => f === '-a' || f === '-s')) return 'read'
  if (READ_ONLY.has(sub) && rest.every(a => a.startsWith('-'))) return 'read'

  // Known mutating-but-recoverable subcommand → gated.
  if (MUTATING.has(sub)) return 'mutating'

  // Anything unrecognized: block. Better to refuse and let the user run it
  // manually than to hand an unknown command to git().
  return 'blocked'
}

/** Human-facing reason a command was blocked (shown in chat next to copy-paste). */
export function blockedReason(argv: string[]): string {
  const sub = argv[0] ?? ''
  if (sub === 'push') return 'Force/remote pushes can overwrite shared history — run this yourself if you’re sure.'
  if (sub === 'reset') return 'reset can move HEAD and discard work — run this yourself after reviewing.'
  if (sub === 'clean') return 'clean permanently deletes untracked files — run this yourself if intended.'
  if (sub === 'rebase') return 'rebase rewrites history — run this yourself in a terminal.'
  if (['filter-branch', 'filter-repo'].includes(sub)) return 'History-rewrite tools are too risky to auto-run.'
  return 'This command is outside what GitRescue will run automatically — copy it to run manually.'
}
