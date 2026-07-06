# Week 1 Spike — Validation Checklist

The design doc flagged three assumptions as unvalidated. This spike closes them before we build further on the detection layer. Run it in a real VS Code extension host (`npm run dev`, then F5).

## Goal

Confirm detection works end-to-end and decide whether the `vscode.git` API adds anything over the `.git/` FileSystemWatcher we already ship.

## Setup

```bash
npm install
npm run dev          # esbuild watch — leave running
# In VS Code: press F5 → "Run Extension" → an [Extension Development Host] window opens
```

Open a throwaway git repo in the dev-host window (init one in a scratch dir). Open **Output → GitRescue** to see handler logs.

## 1. FileSystemWatcher fires on `.git/` changes

For each scenario, perform the git action in the dev-host repo's terminal and confirm GitRescue reacts (dialog or Output line). This is the primary detection path — it must work.

- [ ] **Detached HEAD** — `git checkout <sha>` → expect "Create a branch?" prompt (handler #1)
- [ ] **Merge conflict** — create conflicting branches, `git merge` → conflict report, then complete-merge prompt once resolved (#2)
- [ ] **Rebase paused** — `git rebase` into a conflict → continue/abort quick-pick (#3)
- [ ] **Cherry-pick paused** — `git cherry-pick` into a conflict → continue/abort (#7)
- [ ] **Diverged branch** — local + remote both ahead → pull-with-rebase prompt (#8)
- [ ] **On-activate resume** — leave repo mid-merge, reload window → handler fires on activation

Record: does the watcher catch `.git/` writes reliably? Any missed events? Debounce (200 ms) too short/long?

## 2. `vscode.git` API event shape (the real unknown)

`src/detection.ts::wireGitApi` currently only attaches `onDidOpenRepository`. Determine whether the stable API exposes push/pull **errors** we can key handlers #4 and #9 off of.

- [ ] Log `gitApi.repositories[0].state` — inspect `HEAD`, `remotes`, `workingTreeChanges`
- [ ] Trigger a failed `git pull` (local changes would be overwritten) — does any API event carry the error? (handler #4)
- [ ] Trigger a rejected `git push` (non-fast-forward) — does the API surface it? (handler #9)
- [ ] Check `getAPI(1)` surface for an operation/error event (`onDidRunGitStatus`, `onDidChangeState`, etc.)

**Decision to record:** if the API exposes push/pull errors → wire #4/#9 to real events and drop the ORIG_HEAD heuristic. If not → keep command-only + heuristic detection, document the gap.

## 3. Cursor compatibility

- [ ] Install the VSIX (`npm run package`, then Install from VSIX) in Cursor
- [ ] Confirm activation (`onStartupFinished` + `workspaceContains:.git`) fires
- [ ] Confirm `vscode.git` extension id resolves in Cursor (it may be forked/renamed)

Record: does `getExtension('vscode.git')` return non-null in Cursor? If not, detection must not depend on it (it doesn't today — good).

## Exit criteria

- FSWatcher detection confirmed for all auto-detected handlers
- API error-event question answered yes/no, with follow-up task filed
- Cursor activation + git-extension resolution confirmed or gap documented
