# GitRescue Launch Video Script

Goal: a 60-90 second product demo that shows one scary Git moment becoming safe
and understandable.

## Video structure

### 0-5s: Hook

Screen: VS Code/Cursor with a repo open.

Voiceover:

> Git errors should not send you to five browser tabs. This is GitRescue.

On-screen action:

- Open Command Palette or sidebar briefly.
- Show GitRescue in the activity bar.

### 5-25s: Auto-detection

Screen: terminal in the demo repo.

Action:

```bash
git checkout $(git rev-parse HEAD)
```

Expected result:

- GitRescue detects detached HEAD.
- Notification explains the state.
- Choose the safe branch creation flow.

Voiceover:

> Here I have accidentally checked out a commit directly. Git calls this
> detached HEAD, which sounds terrifying. GitRescue notices the state, explains why
> it matters, and offers the safe next step: create a branch so my work is not
> stranded.

### 25-45s: Ask GitRescue

Action:

- Run `GitRescue: Ask`.
- Type `undo my last commit`.
- Show two-step confirmation.
- Cancel before executing, or execute only in a throwaway repo.

Voiceover:

> You can also describe what you want in plain English. For risky actions like
> undoing a commit, GitRescue asks twice and shows the exact command before
> anything runs.

### 45-65s: Error Explainer

Action:

- Run `GitRescue: Explain a Git Error`.
- Paste:

```text
fatal: refusing to merge unrelated histories
```

Expected result:

- Output channel shows what it means, why it happened, and suggested command.

Voiceover:

> If you already have an error, paste it. GitRescue explains what happened and what
> to do next in plain English.

### 65-80s: Safety close

Screen:

- Show README or Marketplace page with safety model.

Voiceover:

> GitRescue does not generate random Git commands with AI. It uses fixed, audited
> handlers for the Git states beginners actually hit.

### 80-90s: CTA

Voiceover:

> Try GitRescue in VS Code or Cursor, and tell me which Git error it should rescue
> next.

On-screen:

- Marketplace URL
- GitHub URL
- Product Hunt URL

## Recording setup

- Use a clean desktop and close notification-heavy apps.
- Use VS Code or Cursor at 14-16px font size.
- Use a 16:9 window, ideally 1920x1080.
- Use the demo repo created by `scripts/setup-launch-demo-repo.sh`.
- Keep the terminal prompt simple.
- Keep the Output panel visible for GitRescue explanations.
- Do not execute destructive actions in a real repo.

## Demo beats to rehearse

1. Open extension development host.
2. Open the launch demo repo.
3. Trigger detached HEAD.
4. Create `recovery/demo-branch`.
5. Run Ask GitRescue with `undo my last commit`.
6. Show the two-step confirmation and cancel at step two.
7. Paste one error into Error Explainer.

## Screen text overlays

Use these as simple captions if editing:

- "Git state detected automatically"
- "Plain-English explanation"
- "Safe fix offered"
- "Destructive actions require two confirmations"
- "No AI-generated Git commands"

## Thumbnail concept

Left side:

```text
fatal: not possible to fast-forward, aborting
```

Right side:

```text
Your branch and remote both changed.
GitRescue can help you rebase safely.
```

Title:

> Git without the panic
