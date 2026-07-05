# GitDoc

Detects git errors and fixes them with one click. For developers who don't want to learn git syntax.

GitDoc watches your repository for the git states that trip people up — detached HEAD, merge conflicts, a paused rebase, diverged branches — and offers a safe, one-click fix. Destructive operations (undoing a commit, force pushing) always require a two-step confirmation so nothing irreversible happens by accident.

## How it works

- **Fixed, hand-written handlers.** GitDoc never asks an AI to generate a git command. Every fix is a hardcoded, tested, audited handler. There are ten of them.
- **execFile, never a shell.** All git commands run via `child_process.execFile` with an argument array, so branch names containing shell metacharacters (`;`, `&&`, backticks) can't inject anything.
- **Two-tier safety.** Safe fixes are one click. Destructive fixes (`git reset HEAD~1`, `git push --force-with-lease`) require an explicit two-step confirmation.
- **Local only.** Usage telemetry (handler id + timestamp) is written to the extension's local storage. Nothing leaves your machine.

## Handlers

| # | Situation | Fix | Destructive |
|---|-----------|-----|-------------|
| 1 | Detached HEAD | Create a branch to save your work | no |
| 2 | Merge conflict | Report remaining conflicts / complete the merge | no |
| 3 | Rebase in progress | Continue or abort | no |
| 4 | Local changes would be overwritten | Stash (safe) or discard (2-step) | mixed |
| 6 | Stash pop conflict | Report conflicted files | no |
| 7 | Cherry-pick in progress | Continue or abort | no |
| 8 | Branch diverged from remote | Pull with rebase | no |
| 10 | Branch far behind remote | Advise pulling | no |
| 5 | Undo last commit (command only) | `git reset HEAD~1` | **yes — 2-step** |
| 9 | Force push (command only) | `git push --force-with-lease` | **yes — 2-step** |

## Commands

- **GitDoc: View My Fixes** — list active auto-detection handlers
- **GitDoc: Undo Last Commit** — 2-step confirmed `git reset HEAD~1`
- **GitDoc: Force Push (safe)** — 2-step confirmed `git push --force-with-lease`
- **GitDoc: Ask** — one box: describe what you want in plain English *or* paste a git
  error. GitDoc figures out which it is → runs the matching audited fix (through its
  safety gate) or explains the error. Rules-based, offline, no tokens. Destructive
  actions always require confirmation; unmatched input is never guessed.
- **GitDoc: Explain a Git Error** — paste any git error → plain-English explanation of
  what it means and why. If your repo is currently in the matching state, GitDoc offers
  the one-click safe fix; otherwise it shows the command to run yourself.

There's also a **GitDoc sidebar** (activity bar) with quick actions and a live view of
what GitDoc detects in your repo right now.
- **GitDoc: Check Repository Now** — run a detection sweep on demand
- **GitDoc: View Activity Log** — show every fix you've applied (from local telemetry)
- **GitDoc: Clear Activity Log** — wipe the local log

A status-bar item (`$(git-branch) GitDoc`) shows GitDoc is watching; click it for
the handler list, and it briefly flashes when a fix is applied.

## Settings

| Setting | Default | Effect |
|---|---|---|
| `gitdoc.autoDetect` | `true` | Watch the repo and offer fixes automatically |
| `gitdoc.disabledHandlers` | `[]` | Handler IDs to disable (e.g. `["h8-branch-diverged"]`) |
| `gitdoc.telemetry` | `true` | Record applied fixes locally (handler id + timestamp; never sent anywhere) |
| `gitdoc.confirmSafeFixes` | `true` | Ask before safe fixes. Destructive fixes always require two-step confirmation regardless. |

## Development

```bash
npm install
npm run dev          # esbuild watch
# press F5 in VS Code to launch the extension host
npm run test:unit         # Vitest unit tests (mocked)
npm run test:realgit      # detection tests against a real git binary
npm run test:integration  # @vscode/test-electron (needs a display)
npm run package           # build a .vsix
```

## License

MIT
