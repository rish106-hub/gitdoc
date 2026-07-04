# GitDoc Roadmap

Honest state of the project. The eng-review scaffold (T1–T15) is done and green.
This is what stands between "green scaffold" and "extension a real user installs."

## Status

- **Scaffold (T1–T15):** complete. 14 implemented; T10 (polling timeout) closed
  by design — event-driven FSWatcher replaces polling, so the runaway-process
  risk it guarded against no longer exists (see `src/handlers.ts` #10).
- **Verified:** build, lint, typecheck, 13 unit tests (incl. all destructive
  safety-gate cases), clean VSIX, CI on every push/PR.
- **Not verified:** the extension has never caught a git error in a live editor.

## Blocked on maintainer

- [ ] **VSCE_PAT** — Azure DevOps Marketplace token (see `docs/publishing.md`)
- [ ] **Week 1 spike** — manual F5 validation (see `docs/week1-spike.md`)

## Milestone 1 — Prove it works (unblocks everything)

- [ ] Run `docs/week1-spike.md` end to end
- [ ] Answer the open API question: does `vscode.git` expose push/pull **errors**?
  - If yes → wire handlers #4 and #9 to real events; drop the ORIG_HEAD heuristic
  - If no → keep command-only + heuristic, document the limitation
- [ ] Confirm activation + git-extension resolution in **Cursor**
- [ ] Actually run the integration suite (needs a display / xvfb in CI)

## Milestone 2 — Depth (handlers are currently shallow)

Most handlers show one message or run one command. Real product needs:

- [ ] Handler #1 detached HEAD — offer to move existing commits onto the new branch
- [x] Handler #2/#3/#6/#7 — full conflict file list to Output channel (not just count)
- [ ] Handler #4 — verify stash actually restores cleanly; handle stash-pop conflict
- [ ] Handler #6 stash conflict — offer resolve-then-continue flow, not just report
- [x] Handler #8 diverged — show ahead/behind counts before the rebase prompt
- [ ] Undo (#5) / force-push (#9) — post-action verification and a "what happened" log
- [ ] Consistent "explain what I'm about to run" preview on every destructive action

## Milestone 3 — Test depth

- [ ] Integration tests that drive real git repos through each handler
- [ ] CI runs integration suite headless (xvfb-run)
- [ ] Coverage reporting

## Milestone 4 — Marketplace readiness

- [ ] `icon` — 128×128 PNG + reference in `package.json`
- [ ] `galleryBanner` color/theme in `package.json`
- [ ] README screenshots / a short demo GIF
- [ ] `bugs`, `homepage`, `qna` fields in `package.json`
- [ ] First `v0.1.0` tag → publish → install from Marketplace and smoke test

## Milestone 5 — Iterate

- [ ] Review local telemetry to see which handlers actually fire
- [ ] Add handlers for the next most common errors observed
- [ ] Settings: let users disable specific handlers
