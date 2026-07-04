# Changelog

All notable changes to GitDoc are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/).

## [Unreleased]

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
