# Manual QA — VS Code & Cursor

Automated tests prove detection logic and activation. This script covers what they
can't: real dialogs rendering, quick-picks, the status bar, and click-through flows.
Run it once in **VS Code** and once in **Cursor** before publishing.

## Setup (once)

```bash
npm install
npm run dev          # esbuild watch — leave running in one terminal
```

Then in the editor: **Run and Debug** → **Run Extension** (or press F5). A second
window opens: **[Extension Development Host]**. Do all steps below in that window.

Make a throwaway repo to abuse:

```bash
mkdir /tmp/gitdoc-qa && cd /tmp/gitdoc-qa
git init -b main && git config user.email t@t.co && git config user.name T
printf 'line1\n' > file.txt && git add . && git commit -m initial
```

Open `/tmp/gitdoc-qa` as the folder in the dev-host window. Open **Output → GitDoc**
and keep it visible. Confirm the status bar shows **`$(git-branch) GitDoc`**.

---

## Smoke — activation & commands

- [ ] Status-bar `GitDoc` item is visible
- [ ] Click it → quick-pick lists auto-detection handlers (h1, h2, h3, h4, h6, h7, h8, h10)
- [ ] Command palette → each present: `GitDoc: View My Fixes`, `Undo Last Commit`,
      `Force Push (safe)`, `Check Repository Now`, `View Activity Log`, `Clear Activity Log`

---

## Handler flows (paste command, then observe editor)

### #1 Detached HEAD
```bash
git checkout $(git rev-parse HEAD)
```
- [ ] Prompt "Detached HEAD at … Create a branch?" appears
- [ ] Confirm → quick-pick for branch name → pick `recovery/detached`
- [ ] Info toast "Branch created"; `git branch` shows the new branch
- [ ] Edge: make a commit while detached first, then re-trigger → message mentions "N commit(s) at risk"
- [ ] Edge: Cancel at step 1 → nothing happens

### #2 Merge conflict
```bash
git checkout -b feat && printf 'feat\n' > file.txt && git commit -am feat
git checkout main && printf 'main\n' > file.txt && git commit -am main
git merge feat        # conflicts
```
- [ ] Toast "Merge in progress. 1 conflict(s) remaining"; Output lists `file.txt`
- [ ] Resolve conflict, `git add file.txt`, then `GitDoc: Check Repository Now`
- [ ] Prompt "All conflicts resolved. Complete the merge?" → Yes → merge commit created

### #3 Rebase paused
```bash
# fresh repo, then:
git checkout -b feat && printf 'feat\n' > file.txt && git commit -am feat
git checkout main && printf 'main\n' > file.txt && git commit -am main
git checkout feat && git rebase main   # conflicts
```
- [ ] Toast "Rebase paused. N conflict(s)"; Output lists files
- [ ] Resolve + `git add`, `Check Repository Now` → quick-pick Continue / Abort
- [ ] Continue → "Rebase continued"; Abort → "Rebase aborted"

### #4 Local changes would be overwritten
```bash
# needs a remote — use two clones:
git clone /tmp/gitdoc-qa /tmp/qa-remote-work   # or set up origin
# simplest: make origin move ahead, edit locally, pull
```
- [ ] Quick-pick: "Stash my changes" (safe) vs "Discard my changes" (destructive)
- [ ] Stash → "Changes stashed"; `git stash list` non-empty
- [ ] Discard → **two-step** confirm (Are you sure? → Execute) → changes gone
- [ ] Edge: Cancel at either destructive step → nothing runs

### #6 Stash pop conflict
```bash
printf 'edit\n' > file.txt && git stash
printf 'other\n' > file.txt && git commit -am other
git stash pop         # conflicts
```
- [ ] Toast "Stash conflict: N file(s)"; Output lists them

### #7 Cherry-pick conflict
```bash
git checkout -b feat && printf 'feat\n' > file.txt && git commit -am feat
SHA=$(git rev-parse HEAD)
git checkout main && printf 'main\n' > file.txt && git commit -am main
git cherry-pick $SHA  # conflicts
```
- [ ] Toast "Cherry-pick paused"; Continue / Abort quick-pick via Check Now

### #8 Branch diverged (needs a remote)
Set up origin, let it move ahead, and make a local commit so both sides differ.
- [ ] Prompt shows exact counts: "N local ahead, M behind origin/main"
- [ ] Yes → `git pull --rebase` runs

### #10 Far behind remote (needs a remote, >10 commits)
- [ ] Advisory toast "significantly behind origin/main"

### #5 Undo last commit (command)
Palette → `GitDoc: Undo Last Commit`
- [ ] **Two-step** confirm; step-2 message shows exact `git reset HEAD~1`
- [ ] After: Output logs `old -> new` HEAD; commit is undone, changes in working dir
- [ ] Edge: Cancel step 1 or step 2 → nothing runs (verify `git log` unchanged)

### #9 Force push (command, needs a remote + upstream)
Palette → `GitDoc: Force Push (safe)`
- [ ] **Two-step** confirm; message shows exact `git push --force-with-lease origin <branch>`
- [ ] After: Output logs the push result
- [ ] Edge: no upstream configured → clear error, no push

---

## Sidebar (v0.3.0)

- [ ] GitDoc icon appears in the activity bar (left rail); click → panel opens
- [ ] "Actions" section: Ask GitDoc, Explain a git error, Check repository now, Activity log
- [ ] "Status" section: clean repo → "No git problems detected"; broken repo → lists the
      detected state(s) with a warning icon; clicking one runs a check

## Ask GitDoc — NL router (v0.3.0)

Palette → `GitDoc: Ask` (or the sidebar).

- [ ] Type `undo my last commit` → maps to #5 → **two-step** destructive confirm with the
      plain-English explanation embedded
- [ ] Type `my branch is behind` → maps to #8 → pull-rebase flow
- [ ] Type `save this as a branch` (while detached) → maps to #1
- [ ] Paste an actual error (e.g. `fatal: not a git repository`) into the SAME box →
      routes to the explainer, not an action
- [ ] Type gibberish (`do the git thing`) → "couldn't match that to a safe action",
      no command run
- [ ] Confirm a destructive intent, then Cancel at step 1 or 2 → nothing runs

## Error Explainer (v0.2.0)

Palette → `GitDoc: Explain a Git Error`.

- [ ] Paste `error: Your local changes would be overwritten by merge` → Output shows
      plain-English "what it means / why"
- [ ] While repo IS in that state (dirty + failed pull) → info prompt offers "Do the
      safe fix" → runs handler #4
- [ ] While repo is clean → no fix offered; Output shows a suggested command as text
- [ ] Paste gibberish → "I don't recognize this git error yet" (and it's miss-logged)
- [ ] Paste `fatal: not a git repository` → explained, suggests `git init`
- [ ] Trigger a real detected state (e.g. detached HEAD) then undo via #4's discard path →
      the two-step confirm shows the embedded plain-English explanation

## Settings

- [ ] Set `gitdoc.autoDetect` = false → trigger a state → **no** auto prompt;
      `Check Repository Now` still works
- [ ] Add `"h8-branch-diverged"` to `gitdoc.disabledHandlers` → #8 never fires;
      others still do
- [ ] Set `gitdoc.confirmSafeFixes` = false → a safe fix applies without the Yes/Cancel
      prompt; **destructive fixes still two-step** (verify #5 still asks twice)
- [ ] Set `gitdoc.telemetry` = false → apply a fix → `View Activity Log` shows no new entry

---

## Activity log

- [ ] Apply a couple of fixes → `GitDoc: View Activity Log` lists them with timestamps
- [ ] `GitDoc: Clear Activity Log` → confirm → log empties

---

## Cursor-specific

- [ ] Extension installs & activates in Cursor (same VSIX)
- [ ] `getExtension('vscode.git')` resolves — if not, detection still works via
      the FSWatcher path (confirm a handler still fires)
- [ ] Status bar + commands present

---

## Edge cases to confirm across both editors

- [ ] Opening a **non-git** folder → no crash, status bar still shows, commands
      report "open a folder with a git repository first" where they need one
- [ ] Reload window mid-merge → handler re-fires on activation (on-activate resume)
- [ ] Branch name with a space (`git checkout -b "my branch"`) → destructive
      preview quotes it correctly
- [ ] Rapid git operations (fast merge/abort) → no duplicate dialogs (debounce +
      re-entrancy guard)

## Sign-off

- [ ] All flows pass in **VS Code**
- [ ] All flows pass in **Cursor**
- [ ] No unexpected errors in Output → GitDoc

When both are signed off, it's ready to tag `v0.1.0` and publish.
