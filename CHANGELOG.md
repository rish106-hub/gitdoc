# Changelog

All notable changes to GitDoc are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/).

## [Unreleased]

## [0.3.0] — 2026-07-05

### Added — NL Router + Sidebar
- `GitDoc: Ask` — one unified input: plain-English intent OR a pasted error. A
  rules-based classifier (`src/classifier.ts`, offline, token-free, no LLM) maps intent
  to ONE audited handler; error-looking text routes to the explainer instead (resolves
  the two-box confusion). Whitelist: only registered handler ids are reachable.
- Safety: destructive intents always confirm (two-step, with the plain-English
  explanation embedded); low-confidence/ambiguous never auto-routes; unmatched input is
  never guessed — GitDoc says so and suggests rephrasing.
- `src/nlRouter.ts` — pure, testable route planner (classify → action).
- GitDoc **sidebar** (`src/treeView.ts`): activity-bar view with quick actions and a
  live list of what GitDoc detects in the repo right now.
- Tests: classifier corpus (intents, error-detection, safety, gibberish→unknown) +
  route-planner + integration command registration. 84 tests total.

## [0.2.0] — 2026-07-05 (retroactive)

### Added — Error Explainer
- `GitDoc: Explain a Git Error` command — paste any git error, get a plain-English
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
- Settings: `gitdoc.autoDetect`, `gitdoc.disabledHandlers`, `gitdoc.telemetry`,
  `gitdoc.confirmSafeFixes` — with per-handler enable/disable wired into detection
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
