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

1. **No AI-generated git commands *in the deterministic path*.** The detection engine, the 10 handlers, and the rules-based NL classifier are fixed, hand-written, and audited — no LLM is ever in that decision path. AI generating git commands on the fly is the fastest way to lose someone's work.

   **Carve-out (opt-in "Ask AI" panel):** the product owner made a deliberate decision to add a separate, opt-in AI chat panel (Groq). This does not relax the rule for the deterministic path — it is a walled-off second surface with its own hard guardrails. As of v0.5.0 the panel returns a **structured answer** (plain explanation + suggested commands + 1–2 defined terms) and is **click-to-run**: nothing executes until the learner clicks a per-command **Run** button. Every command is then classified in code by `commandGuard.ts` (never trusting the LLM's self-report): read-only commands run on click, state-changing commands require the same two-step `confirmDestructive`, and catastrophic/irreversible commands (force push, hard reset, history rewrite, file deletion) get **no Run button** — copy-paste only. The user brings their own API key; nothing is sent anywhere without it. (v0.4.0 shipped this as an auto-running tool-call loop; v0.5.0 replaced that with the structured, click-to-run model, which also removed a tool-call-text leak.)

2. **execFile, never exec.** All git runs via `child_process.execFile` with an args array. Shell string interpolation is forbidden — branch names can contain `;`, `&&`, and backticks.

3. **Destructive ops always require two-step confirmation.** `git reset --hard`, `git push --force-with-lease` — anything that rewrites history or is hard to undo — uses `confirmDestructive()` which shows two dialogs. The first is "are you sure?" The second shows the exact command and says "this cannot be undone." Neither can be bypassed.

4. **Safe fixes may skip confirmation** (configurable via `gitrescue.confirmSafeFixes`). Destructive fixes ignore this setting — they always two-step.

5. **The handler whitelist is fixed.** New handlers go through deliberate review. The NL router can only route to handler IDs in the registered registry. It cannot route to arbitrary commands. *(The opt-in AI panel is intentionally NOT a handler and NOT routed through the classifier/router — it is a separate path in `aiChat.ts`/`chatView.ts` that reuses only the `ui.ts` confirm gates and `git.ts` primitives, so this whitelist invariant for the deterministic path is preserved.)*

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

`commandOnly` handlers (h4, h5, h9) have `detect: () => false`. This prevents the "always-true function identity" bug where comparing function references is meaningless.

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

### h4 — Local changes would be overwritten (command-only, mixed)
- **Detect**: never auto-detected. `ORIG_HEAD` is stale after normal successful Git operations and cannot identify this failed operation reliably.
- **Fix**: quick-pick: "Stash my changes" (safe, `git stash`) or "Discard my changes" (destructive, `git reset --hard`, two-step confirm)
- **Note**: this is the only handler with both a safe and a destructive branch

### h5 — Undo last commit (command-only, destructive)
- **Detect**: `() => false` — never auto-detected
- **Fix**: `git reset HEAD~1` (keeps changes in working dir)
- **Shows**: last commit message + old→new HEAD in Output channel
- **Safety**: always two-step confirm, step 2 shows exact command

### h6 — Stash pop conflict (auto-detected)
- **Detect**: stash ref exists AND unmerged paths exist, while no merge, cherry-pick, or rebase is in progress.
- **Fix**: report conflicted files to Output channel. User resolves manually, then `git add`.
- **Safe**: one-click (advisory only, no auto-apply)

### h7 — Cherry-pick in progress (auto-detected)
- **Detect**: `.git/CHERRY_PICK_HEAD` exists
- **Fix**: same pattern as h3 — report or quick-pick continue/abort
- **Safe**: one-click

### h8 — Branch diverged from remote (auto-detected, advisory)
- **Detect**: upstream exists AND current tracking refs show both ahead>0 and behind>0. Detection never fetches or makes network calls.
- **Fix**: `git pull --rebase`
- **Shows**: exact commit counts ("3 local, 2 behind origin/main")
- **Safe**: one-click confirm (not auto-applied without confirm)
- **Note**: performs a `git fetch` during detection — mild network call

### h9 — Force push (command-only, destructive)
- **Detect**: `() => false` — never auto-detected
- **Fix**: `git push --force-with-lease <remote> <branch>`
- **Upstream resolution**: `getUpstream()` tries `@{u}` via `git rev-parse`, falls back to `origin/<branch>`
- **Safety**: always two-step confirm

### h10 — Far behind remote (auto-detected, advisory)
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

This is the full pre-ship gate. **Nothing ships until `npm test` (unit + integration),
`npm run test:realgit`, and a signed-off pass of `docs/manual-qa.md` are all green.**
As of this writing: 13 unit files / 184 unit+realgit tests, ~84% line coverage
(100% on the pure-logic modules — see `test:coverage` below).

### test/unit/ — fast, `vscode` fully mocked, no real git/filesystem
- `errorMap.test.ts` — map integrity: every `fixHandlerId` resolves to a real handler,
  every entry has a unique id + matcher, `matchError` cases for all 12 error signatures,
  `entryForHandler` / `explainerTextForHandler` lookups
- `classifier.test.ts` — 13 intent cases, safety invariants (destructive intents always
  `needsConfirm`, error-shaped text → `error` not an intent, gibberish → `unknown`, empty → `unknown`)
- `nlRouter.test.ts` — `planRoute`: error/intent/destructive/unknown routing
- `config.test.ts` — defaults, user overrides, `isHandlerEnabled`
- `ui.test.ts` — `previewCommand` shell-quoting (injection-safe display), `confirmSafe` prompt/skip/cancel paths
- `git.test.ts` — `getUpstream` (with/without `@{u}`, fallback to `origin/HEAD`), `getAheadBehind`
  parsing (tab- and space-separated, malformed/non-numeric output), `getConflicts`
- `handlers.test.ts` — the destructive safety gate: h5 (undo) and h9 (force push) each need
  **two** explicit confirms before a single git command runs, any cancel at either step runs
  nothing, h9 is unreachable with no upstream, h5 refuses to touch a repo's first commit
  (no `HEAD~1`), h3's rebase-paused detection falls back to `rebase-apply` (covers `git am --rebase`)
  when `rebase-merge` isn't present
- `detection.test.ts` — `runHandlers` orchestration: command-only handlers never
  auto-fire, first matching handler wins and stops the cycle, a throwing `detect()`
  doesn't block the rest of the registry, disabled handlers are skipped, the
  re-entrancy guard drops an overlapping detection cycle
- `explainer.test.ts` — `explainError` (unmatched/empty text, live-fix offered only when
  the matching handler's `detect()` is currently true, otherwise a suggested command),
  `explainDetectedState` for every handler id the error map actually references
- `telemetry.test.ts` — opt-out is honored for both handler-run and error-miss logging,
  `logErrorMiss` stores a stable hash + length and never the raw text, log read/write/clear
  survive a missing file, a malformed trailing line, and a failing `fs` write; 5,000 rapid
  appends round-trip correctly (scale)
- `treeView.test.ts` — sidebar sections render correctly with no repo open, `refresh()`
  only calls `detect()` on non-command-only handlers, a throwing detector never crashes
  the panel, 500 rapid `refresh()` calls stay consistent (scale)
- `companion.test.ts` — `parseStatus` against real porcelain v1 shapes (unborn, detached,
  every conflict code, 5,000-entry stress case), `guidanceFor` exhaustively across the full
  boolean/operation state-space (conflicts always win, then operation, then detached/unborn,
  then ahead/behind, then working-tree changes, then clean), `getRepositorySnapshot` wiring
  (status parse + operation marker + ahead/behind, missing upstream, `rebase-apply` fallback)
- `stress.test.ts` — the adversarial/scale pass referenced above: huge strings (500KB+),
  null/undefined/non-string input via type casts, unicode and control characters, ReDoS
  smoke tests against every `ERROR_MAP` pattern, a 1000-handler registry, 500 concurrent
  `runHandlers()` calls against the same in-flight guard, and a never-resolving `detect()`
  that must not hang a fresh cycle

### test/realgit/ — real `git` binary, real temp repos on disk (~4-5s)
- `detection.realgit.test.ts` — spawns real git and asserts detection against real
  `.git` state: detached HEAD, merge/rebase/cherry-pick conflicts, stale-state false
  positives (e.g. `ORIG_HEAD` surviving a normal successful operation), and linked
  worktrees. Proves detection without F5 or a running editor.
- Teardown: `fs.rmSync` with `maxRetries: 5, retryDelay: 100` — git subprocesses hold file
  handles briefly on Windows/macOS, this prevents ENOTEMPTY.

### test/integration/
- Headless VS Code activation test via @vscode/test-electron
- Asserts all 8 commands register correctly
- Runs in CI with `xvfb-run`

### docs/manual-qa.md — what automated tests can't cover
Real dialogs, quick-picks, the status bar, and the sidebar, click-through in both
VS Code and Cursor. This is the final gate before tagging a release — see that file
for the full per-handler script and the sign-off checklist.

### Running tests
```bash
npm run test:unit       # fast, mocked vscode — includes stress.test.ts
npm run test:realgit    # real git, temp repos, ~5s
npm run test:integration # needs display or xvfb
npm run test:coverage   # v8 coverage report (unit + realgit)
npm test                # test:unit + test:integration (the CI gate)
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

- **h4 recovery** is explicit-only. Git does not persist a reliable marker for a failed overwrite: `ORIG_HEAD` survives successful pull, merge, and reset operations, so using it for auto-detection creates false prompts.
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
