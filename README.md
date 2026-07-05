# GitDoc

**Git that doesn't make you Google everything.**

GitDoc is a VS Code extension that watches your repository for the git situations that trip developers up — detached HEAD, merge conflicts, paused rebases, diverged branches — and offers a plain-English fix with one click. When something goes wrong, GitDoc tells you what happened, why, and what to do. No terminal archaeology required.

---

## Who it's for

GitDoc is built for **developers who know what they want to build but don't want to memorize git syntax** — students, junior developers, designers who code, vibe coders. It's also useful as a safety net for experienced developers who want guardrails on destructive operations.

**Not** built for: git power users who prefer raw CLI control.

---

## What it does

### Auto-Detection
GitDoc watches your `.git/` folder in real time. The moment you hit a known problem state, a notification appears with a plain-English explanation and a fix button. No refresh, no commands.

### Ask GitDoc
One input box for everything. Describe what you want in plain English **or** paste a git error — GitDoc figures out which it is.

- `"undo my last commit"` → routes to the undo handler → two-step confirmation
- `"my branch is behind the remote"` → routes to pull-rebase → one-click confirm
- Paste `fatal: refusing to merge unrelated histories` → explains what it means and why

No AI, no tokens, no internet required. The classifier is deterministic keyword rules.

### Error Explainer
Paste any git error. GitDoc translates it into plain English: what it means, why it happened, what to do. If your repo is currently in the matching bad state, it offers the one-click fix. If not, it shows the command to run yourself.

### Sidebar
A live view in the VS Code activity bar showing what GitDoc detects in your repo right now. Actions panel for quick access. Status panel updates as your repo state changes.

---

## Safety model

GitDoc has two safety tiers — and **never bypasses them**.

| Fix type | Example | Confirm flow |
|---|---|---|
| Safe | Stash changes, continue rebase, create branch | One-click confirm dialog |
| Destructive | `git reset HEAD~1`, `git push --force-with-lease` | **Two-step** explicit confirm |

Destructive confirms show the exact command that will run so the user always knows what they're agreeing to. Plain-English context from the error explainer is embedded in the confirm message.

**No AI-generated commands. Ever.** All 10 handlers are hand-written, tested, and audited. An AI generating git commands on the fly is the fastest way to destroy someone's repo.

---

## Handlers

GitDoc ships with 10 fixed, audited handlers. The handler list will only grow through deliberate review — not dynamically.

| # | Situation | Fix | Safety |
|---|---|---|---|
| h1 | Detached HEAD | Create a branch to save commits | one-click |
| h2 | Merge conflict | Report conflicts / complete merge when resolved | one-click |
| h3 | Rebase paused | Continue or abort rebase | one-click |
| h4 | Local changes would be overwritten | Stash (safe) or discard (two-step) | mixed |
| h5 | Undo last commit | `git reset HEAD~1` — keeps changes | **two-step** |
| h6 | Stash pop conflict | Report conflicted files, guide resolution | one-click |
| h7 | Cherry-pick paused | Continue or abort | one-click |
| h8 | Branch diverged from remote | `git pull --rebase` | one-click |
| h9 | Force push | `git push --force-with-lease` | **two-step** |
| h10 | Branch far behind remote (>10 commits) | Advisory — suggests pulling | advisory only |

Handlers h5 and h9 are **command-only** (palette or sidebar, never auto-detected). Handlers h8 and h10 are **advisory** (they never auto-apply, they ask first).

---

## Commands

| Command | What it does |
|---|---|
| `GitDoc: Ask` | One box: plain-English intent or pasted error |
| `GitDoc: Explain a Git Error` | Paste error → plain-English explanation |
| `GitDoc: Check Repository Now` | Manual detection sweep |
| `GitDoc: Undo Last Commit` | Two-step confirmed reset |
| `GitDoc: Force Push (safe)` | Two-step confirmed force-with-lease |
| `GitDoc: View My Fixes` | List active auto-detection handlers |
| `GitDoc: View Activity Log` | All applied fixes with timestamps |
| `GitDoc: Clear Activity Log` | Wipe local log |

---

## Settings

| Setting | Default | What it controls |
|---|---|---|
| `gitdoc.autoDetect` | `true` | Watch repo and show prompts automatically |
| `gitdoc.disabledHandlers` | `[]` | Handler IDs to silence (e.g. `["h8-branch-diverged"]`) |
| `gitdoc.confirmSafeFixes` | `true` | Require confirm for safe fixes. Destructive always two-step regardless. |
| `gitdoc.telemetry` | `true` | Log applied fixes locally (handler id + timestamp). Never sent anywhere. |

---

## Architecture at a glance

```
src/
  extension.ts      — activate(): registers sidebar, commands, detection
  detection.ts      — FSWatcher (debounced 200ms) + re-entrancy guard + on-activate resume
  handlers.ts       — 10 handlers implementing the Handler interface
  types.ts          — Handler interface, GitContext, GitExtensionAPI
  git.ts            — execFile wrappers (never exec/shell interpolation)
  ui.ts             — confirmSafe, confirmDestructive, quickPick, statusBar, outputChannel
  errorMap.ts       — 18-entry curated error map + reverse index by handlerId
  explainer.ts      — matches pasted error → checks live repo state → offers fix or text
  classifier.ts     — keyword rules classifier (intent vs error vs unknown)
  nlRouter.ts       — planRoute(): classify input → RoutePlan struct
  treeView.ts       — GitDocTreeProvider: sidebar Actions + Status sections
  config.ts         — getConfig(), isHandlerEnabled()
  telemetry.ts      — local-only log to globalStorageUri
```

**Key invariants:**
- All git runs through `child_process.execFile` with an args array. Shell interpolation is forbidden.
- Destructive handlers always require two-step confirmation. `confirmDestructive()` is the only path.
- Detection has a re-entrancy guard (`detectionInFlight`) — no overlapping detection cycles.
- All `.git/` reads are wrapped in try/catch; ENOENT = state absent, not an error.
- The NL classifier is stateless, deterministic, and makes no network calls.
- The error map is versioned (`ERROR_MAP_VERSION`). Every `fixHandlerId` is integrity-checked against the handler registry in tests.

---

## Technology

- **Runtime**: VS Code Extension API, Node.js (no external runtime deps)
- **Build**: esbuild (single-file bundle, external `vscode`)
- **Tests**: Vitest (unit + real-git), @vscode/test-electron (integration, headless VS Code)
- **CI**: GitHub Actions — lint / tsc / unit / real-git / coverage / build / package + headless VS Code integration
- **Publish**: VSCE to VS Code Marketplace (tag-triggered, `VSCE_PAT` secret)

---

## Development

```bash
npm install
npm run dev          # esbuild watch (leave running)
# F5 in VS Code → opens Extension Development Host
npm run test:unit    # Vitest unit tests (mocked vscode)
npm run test:realgit # detection tests against a real git binary in temp repos
npm run test:integration  # headless VS Code activation test (needs display)
npm run package      # build .vsix for manual install
```

Real-git tests (`test/realgit/`) spawn an actual `git` binary in temp repos and assert handlers fire on real `.git` state. They prove detection without needing F5 or a running editor.

---

## Publishing

See `docs/publishing.md` for full VSCE_PAT setup. Once set:

```bash
git tag v0.3.0
git push origin v0.3.0
# CI publish workflow fires automatically
```

Publisher: `rish106-hub` on VS Code Marketplace.

---

## License

MIT
