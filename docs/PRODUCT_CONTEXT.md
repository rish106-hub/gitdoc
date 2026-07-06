# GitRescue — Product Context for AI Agents

This document is the authoritative context transfer file for GitRescue. It is written for AI agents and future contributors who need to understand the product well enough to extend, debug, or reason about it correctly. Read this before touching any code.

---

## What is GitRescue?

GitRescue is a VS Code extension (and Cursor-compatible) that makes git accessible to developers who understand their goals but not git's error syntax. It watches the repository, detects known bad states, and offers one-click fixes with plain-English explanations.

**Core thesis:** Git errors are not random — they cluster around ~10 situations that beginners hit repeatedly. Covering those 10 situations completely, safely, and in plain English eliminates 80% of beginner git pain. You don't need AI-generated commands; you need 10 well-written, tested handlers.

---

## Target user

- Students learning to code
- Junior developers new to git workflow
- Designers and product people who write code ("vibe coders")
- Developers who know what they want to do but forget the syntax

**Not the target:** Git power users who prefer raw CLI. GitRescue should not try to compete with those users' workflows.

---

## Non-negotiable product principles

These came directly from the founder and must never be violated:

1. **No AI-generated git commands.** Fixed, hand-written, audited handlers only. AI generating git commands on the fly is the fastest way to lose someone's work. This is a hard product constraint, not a technical preference.

2. **execFile, never exec.** All git runs via `child_process.execFile` with an args array. Shell string interpolation is forbidden — branch names can contain `;`, `&&`, and backticks.

3. **Destructive ops always require two-step confirmation.** `git reset --hard`, `git push --force-with-lease` — anything that rewrites history or is hard to undo — uses `confirmDestructive()` which shows two dialogs. The first is "are you sure?" The second shows the exact command and says "this cannot be undone." Neither can be bypassed.

4. **Safe fixes may skip confirmation** (configurable via `gitrescue.confirmSafeFixes`). Destructive fixes ignore this setting — they always two-step.

5. **The handler whitelist is fixed.** New handlers go through deliberate review. The NL router can only route to handler IDs in the registered registry. It cannot route to arbitrary commands.

---

## Architecture

### File map

| File | Role |
|---|---|
| `src/extension.ts` | Entry point: `activate()`, register all commands + sidebar |
| `src/types.ts` | `Handler` interface, `GitContext`, `GitExtensionAPI` |
| `src/handlers.ts` | All 10 handlers — detection logic + fix logic |
| `src/detection.ts` | FSWatcher, debounce, re-entrancy guard, on-activate resume |
| `src/git.ts` | `git()`, `gitSafe()`, `getUpstream()`, `getAheadBehind()`, `getConflicts()` |
| `src/ui.ts` | `confirmSafe()`, `confirmDestructive()`, `quickPick()`, `previewCommand()`, statusBar, outputChannel |
| `src/config.ts` | `getConfig()`, `isHandlerEnabled()` |
| `src/telemetry.ts` | Local-only log: handler id + timestamp to `globalStorageUri` |
| `src/errorMap.ts` | 18-entry curated error map + reverse index by handler id + `explainerTextForHandler()` |
| `src/explainer.ts` | `explainError()` + `explainDetectedState()` — matches error, checks live state |
| `src/classifier.ts` | Keyword rules classifier → `Classification {kind, handlerId, confidence, needsConfirm}` |
| `src/nlRouter.ts` | `planRoute()` → `RoutePlan {action, handlerId, needsConfirm, message}` |
| `src/treeView.ts` | `GitRescueTreeProvider` — sidebar TreeDataProvider |
| `src/config.ts` | Settings reader |

### Handler interface

```typescript
interface Handler {
  id: string            // e.g. 'h1-detached-head'
  destructive: boolean  // true = has destructive branch
  advisory: boolean     // true = never auto-applies, asks first
  commandOnly?: boolean // true = only reachable via command, never auto-detected
  detect: (ctx: GitContext) => boolean | Promise<boolean>
  handle: (ctx: GitContext) => Promise<void>
}
```

`commandOnly` handlers (h5, h9) have `detect: () => false`. This prevents the "always-true function identity" bug where comparing function references is meaningless.

### Detection flow

```
.git/ changed (FSWatcher, 200ms debounce)
  → detectionInFlight guard (prevents overlapping cycles)
  → getConfig().autoDetect check
  → run all handlers where !commandOnly && isHandlerEnabled(id)
  → first matching handler fires (priority: order in handlers array)
  → handler.handle() through safety gates
```

On activation (`checkOnActivate`): same flow runs once, no watcher needed, to resume in-progress states (merge, rebase, cherry-pick) after editor restart.

### NL Router flow

```
User types in Ask box
  → classifier.classify(input)
      → looksLikeError()? → kind: 'error' → explainer
      → match INTENT_RULES (keyword patterns) → kind: 'intent' → run handler
      → no match → kind: 'unknown' → show error message, suggest rephrasing
  → nlRouter.planRoute() produces RoutePlan
  → extension.ts executor:
      → if 'explain': runExplain(input)
      → if 'run-handler': find handler in registry, call handler.handle()
          → goes through handler's normal confirmSafe/confirmDestructive gates
      → if 'unknown': showError(plan.message)
```

Critical: the NL router **never bypasses safety gates**. The handler's own `handle()` runs normally — the router only determines which handler to call.

### Import cycle prevention

`errorMap.ts` ← `handlers.ts` ← `explainer.ts` would be a cycle if `explainer.ts` imported `handlers.ts` for the reverse index.

Solution: `explainerTextForHandler()` and `ERROR_MAP_BY_HANDLER` live in `errorMap.ts`, not `explainer.ts`. Handlers import from `errorMap.ts` only. `explainer.ts` also imports from `errorMap.ts` only.

### Two-tier confirm

```typescript
// Safe: one dialog. Skippable via gitrescue.confirmSafeFixes = false.
confirmSafe(message: string): Promise<boolean>

// Destructive: two dialogs. NEVER skippable.
confirmDestructive(step1: string, step2: string): Promise<boolean>
// step2 always shows the exact command via previewCommand()
```

`previewCommand(args)` quotes args that contain spaces so the user sees the real command they're confirming.

---

## The 10 handlers — full spec

### h1 — Detached HEAD (auto-detected, advisory)
- **Detect**: `HEAD` file doesn't start with `ref:` (reading `.git/HEAD`)
- **Fix**: `git checkout -b <name>` where user picks the branch name from a quick-pick
- **Extra**: counts commits made while detached using `git log HEAD --not --branches --oneline`. If any, warns "N commits at risk — creating a branch keeps them."
- **Safe**: one-click

### h2 — Merge conflict (auto-detected)
- **Detect**: `.git/MERGE_HEAD` exists
- **Fix**: if conflicts remain (unmerged paths from `git status --porcelain`), report them to Output channel + toast. If all resolved, offer `git commit --no-edit`.
- **Safe**: one-click

### h3 — Rebase in progress (auto-detected)
- **Detect**: `.git/rebase-merge/` directory exists
- **Fix**: if conflicts remain, report. If resolved, quick-pick: Continue (`git rebase --continue`) or Abort (`git rebase --abort`)
- **Safe**: one-click

### h4 — Local changes would be overwritten (auto-detected, mixed)
- **Detect**: `.git/ORIG_HEAD` exists but `.git/MERGE_HEAD` does not (failed pull scenario)
- **Fix**: quick-pick: "Stash my changes" (safe, `git stash`) or "Discard my changes" (destructive, `git reset --hard`, two-step confirm)
- **Note**: this is the only handler with both a safe and a destructive branch

### h5 — Undo last commit (command-only, destructive)
- **Detect**: `() => false` — never auto-detected
- **Fix**: `git reset HEAD~1` (keeps changes in working dir)
- **Shows**: last commit message + old→new HEAD in Output channel
- **Safety**: always two-step confirm, step 2 shows exact command

### h6 — Stash pop conflict (auto-detected)
- **Detect**: `.git/refs/stash` exists AND `.git/MERGE_HEAD` does NOT (conflict from `git stash pop`, not regular merge)
- **Fix**: report conflicted files to Output channel. User resolves manually, then `git add`.
- **Safe**: one-click (advisory only, no auto-apply)

### h7 — Cherry-pick in progress (auto-detected)
- **Detect**: `.git/CHERRY_PICK_HEAD` exists
- **Fix**: same pattern as h3 — report or quick-pick continue/abort
- **Safe**: one-click

### h8 — Branch diverged from remote (auto-detected, advisory)
- **Detect**: upstream exists AND `git fetch` + `getAheadBehind()` shows both ahead>0 and behind>0
- **Fix**: `git pull --rebase`
- **Shows**: exact commit counts ("3 local, 2 behind origin/main")
- **Safe**: one-click confirm (not auto-applied without confirm)
- **Note**: performs a `git fetch` during detection — mild network call

### h9 — Force push (command-only, destructive)
- **Detect**: `() => false` — never auto-detected
- **Fix**: `git push --force-with-lease <remote> <branch>`
- **Upstream resolution**: `getUpstream()` tries `@{u}` via `git rev-parse`, falls back to `origin/<branch>`
- **Safety**: always two-step confirm

### h10 — Merge wizard / Far behind remote (auto-detected, advisory)
- **Detect**: `git rev-list --count HEAD..<upstream>` > 10
- **Fix**: advisory toast only — "Your branch is significantly behind, consider pulling"
- **Reasoning**: originally designed as a "polling merge wizard with 30-minute timeout" but the FSWatcher approach eliminates the polling problem — state is re-checked only when `.git/` changes, never on a timer. Advisory is sufficient.

---

## Error Map

`src/errorMap.ts` contains 23 entries. Each entry has:
- `id`: unique string
- `match`: array of RegExps matched case-insensitively against pasted text
- `title`: short human title
- `whatItMeans`: ELI10 explanation (no jargon)
- `why`: why this happened
- `fixHandlerId?`: handler to offer if repo is currently in that state
- `suggestedCommand?`: command to show as text when no live fix available

Every `fixHandlerId` is integrity-checked against the handler registry in `test/unit/errorMap.test.ts`. Adding a new error entry with a `fixHandlerId` that doesn't exist in handlers will fail CI.

The error map is versioned (`ERROR_MAP_VERSION = 1`). Future breaking changes should bump this.

---

## NL Classifier — intent rules

Rules in priority order (first match wins ties):

| Handler | Destructive | Sample patterns |
|---|---|---|
| h5-undo-last-commit | yes | undo commit, revert last, uncommit |
| h9-force-push | yes | force push, push force, overwrite remote |
| h4-local-changes-overwrite | yes* | discard changes, throw away changes, stash changes |
| h8-branch-diverged | no | diverged, behind remote, catch up, pull rebase, sync remote |
| h1-detached-head | no | detached, save branch, create branch here, make branch |
| h2-merge-conflict | no | finish merge, complete merge, resolve merge |
| h3-rebase-in-progress | no | continue rebase, abort rebase |
| h7-cherry-pick-in-progress | no | cherry-pick, cherry pick |

*h4 is marked `destructive: true` in the classifier because it has a destructive branch. The handler itself shows a safe/destructive quick-pick; the router just ensures confirmation.

**Error detection takes priority over intent matching.** If the input matches any `ERROR_MARKERS` or any `ERROR_MAP` entry, it routes to the explainer first, regardless of whether it also matches intent patterns.

---

## Tests

### test/unit/
- `errorMap.test.ts` — T2 integrity: every `fixHandlerId` in registry, matcher cases, entryForHandler/explainerTextForHandler
- `classifier.test.ts` — 13 intent cases, safety (destructive always needsConfirm, error→explainer, gibberish→unknown, empty→unknown)
- `nlRouter.test.ts` — planRoute: error/intent/destructive/unknown routing

### test/realgit/
- `detection.realgit.test.ts` — 16 cases: spawns real git binary in temp repos, asserts h1/h2/h3/h4/h7/h8/h10 fire on real `.git` state. Proves detection without F5 or a running editor.
- Teardown: `fs.rmSync` with `maxRetries: 5, retryDelay: 100` — git subprocesses hold file handles briefly on Windows/macOS, this prevents ENOTEMPTY.

### test/integration/
- Headless VS Code activation test via @vscode/test-electron
- Asserts all 8 commands register correctly
- Runs in CI with `xvfb-run`

### Running tests
```bash
npm run test:unit       # fast, mocked vscode
npm run test:realgit    # real git, temp repos, ~10s
npm run test:integration # needs display or xvfb
npm run test:coverage   # v8 coverage report
```

---

## CI/CD

### `.github/workflows/ci.yml` — two jobs

**check** (runs on every push/PR):
1. lint (eslint)
2. tsc (typecheck)
3. test:unit (vitest, mocked)
4. test:realgit (real git)
5. coverage
6. build (esbuild --production)
7. package (vsce package)

**integration** (same trigger):
1. `xvfb-run` headless VS Code activation
2. Asserts all commands register

### `.github/workflows/publish.yml` — tag-triggered
- Fires on `v*` tags
- Uses `VSCE_PAT` secret (Azure DevOps PAT with Marketplace → Manage scope + All orgs)
- Publisher: `rish106-hub`

### To publish
```bash
git tag v0.X.0 && git push origin v0.X.0
```

---

## Decisions that were explicitly rejected

These came up in review and were deliberately not built:

| What | Why rejected |
|---|---|
| AI-generated fix commands per error | Single fastest way to nuke a repo. Unfixable trust problem. |
| LLM in the NL classifier | Competes with Cursor/Copilot which users already have. Token-free classifier is the differentiator. Offline = works in airplane mode. |
| Two input boxes (one for errors, one for intent) | Beginners can't distinguish which box to use. Unified box with classification built in. |
| Polling-based merge wizard with timeout | FSWatcher is event-driven — re-checks only when `.git/` changes. Polling is unnecessary and adds runaway-process risk. |
| Handler auto-discovery or plugin system | Handlers must be audited. Dynamic discovery means unadited handlers. |
| Remote telemetry | Privacy non-starter. Local only: handler id + timestamp to globalStorageUri. |

---

## Version history

| Version | What shipped |
|---|---|
| 0.1.0 | Initial scaffold — 10 handlers, two-tier safety, FSWatcher, detection, local telemetry, esbuild, CI |
| 0.2.0 | Error explainer — paste-box, error map (18 entries), live-state fix, miss-logging |
| 0.3.0 | NL router (Ask GitRescue), sidebar, unified input, classifier, 84 tests total |

---

## Known limitations / things to be aware of

- **h4 detection** relies on `ORIG_HEAD` + absence of `MERGE_HEAD`. This is an approximation. The real trigger (git telling you "changes would be overwritten") only happens during a pull/checkout — by the time the user sees GitRescue's prompt, the pull has already failed. Detection is best-effort.
- **h8 and h10** do a `git fetch` during detection. On slow or offline connections this can introduce lag. `gitSafe()` swallows errors so a failed fetch = handler doesn't fire.
- **Cursor compatibility**: `vscode.extensions.getExtension('vscode.git')` may not resolve in Cursor. Detection falls back to the FSWatcher path which works without the git API. Confirmed working.
- **Two-instance problem**: if both 0.1.0 and 0.3.0 are installed, VS Code may load the older one. Resolution: `rm -rf ~/.vscode/extensions/rish106-hub.gitrescue-0.1.0` then reload.
- **VSCE_PAT** must be an Azure DevOps PAT (not GitHub), with "Marketplace → Manage" scope and "All accessible organizations". See `docs/publishing.md`.

---

## File locations

```
/
├── src/                  — all TypeScript source
├── test/
│   ├── unit/             — vitest unit tests (mocked vscode)
│   ├── realgit/          — real-git detection tests
│   └── integration/      — @vscode/test-electron suite
├── docs/
│   ├── PRODUCT_CONTEXT.md — this file
│   ├── manual-qa.md      — full click-through QA script
│   ├── publishing.md     — VSCE_PAT setup guide
│   ├── roadmap.md        — milestones with checkboxes
│   └── week1-spike.md    — Week 1 spike plan
├── scripts/
│   └── gen-icon.js       — generates media/icon.png (dependency-free)
├── media/
│   └── icon.png          — 128×128 orange rounded square + white checkmark
├── .github/
│   └── workflows/
│       ├── ci.yml        — lint/test/build/package CI
│       └── publish.yml   — tag-triggered Marketplace publish
├── .private/             — NOT committed to GitHub (gitignored)
│   └── ...               — session context, design decisions, gstack outputs
├── esbuild.js            — build config (src/extension.ts → dist/extension.js)
├── package.json          — version 0.3.0, publisher rish106-hub
└── README.md             — product-focused README
```
