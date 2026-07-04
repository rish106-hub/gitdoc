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

## Development

```bash
npm install
npm run dev          # esbuild watch
# press F5 in VS Code to launch the extension host
npm run test:unit    # Vitest unit tests
npm run test:integration  # @vscode/test-electron
npm run package      # build a .vsix
```

## License

MIT
