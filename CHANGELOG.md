# Changelog

All notable changes to GitRescue are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/).

## [Unreleased]

## [0.4.0] — 2026-07-14

### Added — Ask AI panel (opt-in, Groq)
- New "Ask AI" webview in the GitRescue sidebar: a chat panel that answers git
  questions in plain English, powered by your own free Groq API key.
- Smooth onboarding: a "Get a free key" button opens Groq's key page; paste once
  and the chat unlocks. Key stored securely in the OS keychain (VS Code
  SecretStorage) — never in settings.json, never logged. Commands
  `GitRescue: Set Groq API Key` / `Clear Groq API Key`.
- Agentic, but guardrailed: the AI can propose and run git commands. Read-only
  commands (status/log/diff) run automatically; state-changing commands require
  the same two-step confirmation as every other GitRescue fix; and catastrophic
  commands (force push, hard reset, history rewrite, file deletion) are refused
  outright and shown as copy-paste text. Command classification happens in code
  (`commandGuard.ts`), never by trusting the model.
- Settings: `gitrescue.aiChat.enabled` (default true) and `gitrescue.groqModel`
  (default `llama-3.3-70b-versatile`).
- No new runtime dependency — the Groq client is a thin `fetch` wrapper.
- This is a deliberate, documented carve-out from the "no AI-generated git
  commands" principle (see docs/PRODUCT_CONTEXT.md); the deterministic detection
  engine, the 10 handlers, and the rules classifier are unchanged and remain
  LLM-free.

## [0.3.5] — 2026-07-14

### Fixed — detection reliability
- h4 (local changes would be overwritten) no longer auto-detects from stale `ORIG_HEAD`
  — it's command-only now (Ask / explicit command), since `ORIG_HEAD` persists after
  many successful operations and can't reliably prove a rejected overwrite.
- h3 (rebase in progress) also detects `rebase-apply` (not just `rebase-merge`), so
  `git am --rebase` and older Git rebase modes resume correctly.
- h5 (undo last commit) refuses safely on a repo's first commit instead of failing.
- h6 (stash conflict) detection tightened to require actual unmerged paths, not just
  a stash ref (which is normal after any `git stash`).
- h8 (branch diverged) detect no longer runs its own `git fetch` — uses current
  tracking refs, avoiding an extra network call on every detection cycle.
- Worktree / submodule support: `.git` as a gitdir-pointer file is now resolved
  correctly across handlers and detection (`getGitDir()`).
- Added a Git Companion sidebar guidance panel.

### Changed — product depth
- Classifier confidence is now gradated (base + pattern-hit credit + margin
  credit, capped at 0.95) instead of a binary 0.9/0.5 score. The safety gate
  (destructive/ambiguous always confirm) is unchanged.
- Renamed handler id `h10-merge-wizard` → `h10-far-behind-remote` to match
  the advisory it actually is. `gitrescue.disabledHandlers` entries using the
  old id still work (legacy-id back-compat).
- `gitrescue.viewLog` now surfaces a "top unmatched errors" summary
  (hash · length · count) so maintainers can see which errors to add to the
  error map next — still hash-only, no raw error text is ever stored.
- `telemetry.readLog` now parses JSONL lines independently, so one corrupt
  line no longer discards the whole log.

### Fixed
- Removed a dead unused variable in the detached-HEAD handler.
- `.vscode/launch.json` "Run Integration Tests" now points at the correct
  compiled-test task, so F5 debugging of integration tests works.

### Added — tests
- New unit test coverage for `telemetry.ts`, `explainer.ts`, `treeView.ts`,
  and the `companion` module (previously zero/partial coverage).
- Expanded handler, classifier, and NL router test coverage; a stress-test
  suite hardening `classify()` against edge-case input.

## [0.3.4] — 2026-07-06

### Added — Launch readiness
- HD icon set + regenerated brand assets; `scripts/gen-icon.js` rewritten to emit the
  full PNG set.
- Contribution & launch governance: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `SUPPORT.md`, GitHub `CODEOWNERS`, issue/PR templates, and
  labeler / PR-title / release-draft workflows.
- Internal launch-readiness tooling was added and then deliberately kept out of the
  public repo (gitignored) so launch collateral doesn't ship in the source tree.

## [0.3.3] — 2026-07-06

### Changed
- Marketplace release bump (version + lockfile only; no functional change). Note: there
  is no 0.3.2 — the version went 0.3.1 → 0.3.3.

## [0.3.1] — 2026-07-06

### Changed — GitRescue branding
- Rebranded to **GitRescue**. The package went through several Marketplace-availability
  renames (`gitfix` → `git-guardian` → `gitdoc-safe` → `git-rescue`) before settling on
  the final publisher/name; `displayName` is **GitRescue**.
- README rewritten around the product story; added `docs/brand-assets.md` and
  `docs/launch-video-script.md`; new `media/gitrescue-*` brand SVGs.
- Terminology updated to "GitRescue" across PRODUCT_CONTEXT, manual-qa, publishing, and
  roadmap docs. No handler or runtime behavior changed.

## [0.3.0] — 2026-07-05

### Added — NL Router + Sidebar
- `GitRescue: Ask` — one unified input: plain-English intent OR a pasted error. A
  rules-based classifier (`src/classifier.ts`, offline, token-free, no LLM) maps intent
  to ONE audited handler; error-looking text routes to the explainer instead (resolves
  the two-box confusion). Whitelist: only registered handler ids are reachable.
- Safety: destructive intents always confirm (two-step, with the plain-English
  explanation embedded); low-confidence/ambiguous never auto-routes; unmatched input is
  never guessed — GitRescue says so and suggests rephrasing.
- `src/nlRouter.ts` — pure, testable route planner (classify → action).
- GitRescue **sidebar** (`src/treeView.ts`): activity-bar view with quick actions and a
  live list of what GitRescue detects in the repo right now.
- Tests: classifier corpus (intents, error-detection, safety, gibberish→unknown) +
  route-planner + integration command registration. 84 tests total.

## [0.2.0] — 2026-07-05 (retroactive)

### Added — Error Explainer
- `GitRescue: Explain a Git Error` command — paste any git error, get a plain-English
  explanation (what it means + why). Curated, versioned static map of common git errors
  (`src/errorMap.ts`, no LLM, no tokens, offline).
- Live-state fix: if the repo is currently in the matching detected state, the explainer
  offers the real audited handler fix; otherwise explain-only + the command as text.
- Destructive confirms embed the plain-English explanation (a beginner clicking "yes" on
  `reset --hard` now sees what it means).
- Miss-logging telemetry: unrecognized pasted errors logged locally (hash only, no text)
  to grow the map — honors the telemetry opt-out.
- Tests: error-map integrity (every fix id ∈ registry), matcher cases, explainer against
  real repo state (fix offered only when state is live). 58 automated tests total.



## [0.1.0] — 2026-07-05 (retroactive)

### Added
- Initial scaffold: 10 hand-written git handlers with a typed registry
- Two-tier safety model — one-click safe fixes, two-step confirmation for
  destructive operations (`git reset HEAD~1`, `git push --force-with-lease`)
- Event-driven detection via `.git/` FileSystemWatcher (200 ms debounce,
  create/change/delete) with a re-entrancy guard
- On-activate resume for in-progress merge / rebase / cherry-pick states
- Dynamic upstream resolution (`@{u}` with `origin/<branch>` fallback)
- Local-only telemetry (handler id + timestamp to `globalStorageUri`)
- Vitest unit suite (13 tests, incl. all destructive safety-gate cases) and
  `@vscode/test-electron` integration harness
- esbuild bundling, CI (lint / typecheck / test / build / package), and a
  tag-triggered Marketplace publish workflow
- Extension icon (`media/icon.png`, 128×128) generated dependency-free via
  `npm run gen:icon`; galleryBanner + Marketplace metadata

### Added (product build)
- Settings: `gitrescue.autoDetect`, `gitrescue.disabledHandlers`, `gitrescue.telemetry`,
  `gitrescue.confirmSafeFixes` — with per-handler enable/disable wired into detection
- Status-bar item + brief "fix applied" flash
- Commands: Check Repository Now, View Activity Log, Clear Activity Log
- Consistent exact-command preview on every destructive dialog (`previewCommand`)
- Handler #1 now reports how many commits are at risk in detached HEAD
- **Real-git detection test suite** (`npm run test:realgit`): spawns an actual
  git binary in temp repos and asserts handlers #1/#2/#3/#7 fire on real state,
  and that a clean repo triggers nothing — added to CI
- **Headless integration tests in CI** (xvfb + @vscode/test-electron): launches
  real VS Code, activates the extension, asserts all 6 commands register
- Coverage reporting (`npm run test:coverage`, v8) in CI
- Expanded real-git E2E suite to 13 cases: diverged (#8, real remotes), far-behind
  (#10), local-changes-overwrite (#4), stash/rebase/cherry-pick conflicts, plus
  safety cases (non-git dir, empty repo, handler priority)
- `previewCommand` + `confirmSafe` unit tests (quoting, config-gated prompts)
- `docs/manual-qa.md`: full click-through QA script for VS Code + Cursor

### Changed
- Handler #8 (diverged) now shows exact ahead/behind commit counts in the prompt
- Handlers #2/#3/#6/#7 write the full conflicted-file list to the Output channel,
  not just a truncated count
- Extracted `getAheadBehind` and `getConflicts` git helpers (unit-tested)
- Destructive ops (#5 undo, #9 force-push) now log a "what happened" record to
  the Output channel — old→new HEAD for undo, push result for force-push

### Notes
- Not yet released to the Marketplace — awaiting `VSCE_PAT` and Week 1 spike
  validation of the `vscode.git` API error-event surface.
