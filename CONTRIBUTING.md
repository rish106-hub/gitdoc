# Contributing to GitRescue

Thanks for helping make Git less scary. GitRescue is intentionally conservative:
it helps users recover from common Git states through fixed, audited handlers.

## Local Setup

```bash
npm install
npm run dev
```

Press F5 in VS Code to open the Extension Development Host.

## Before Opening a PR

Run the checks that match your change:

```bash
npm run test:unit
npm run test:realgit
npm run build
npm run package
```

For UI, command, activation, or contribution changes, also run:

```bash
npm run test:integration
```

## Commit Messages

Use short conventional prefixes:

- `fix: ...`
- `feat: ...`
- `docs: ...`
- `test: ...`
- `ci: ...`
- `chore: ...`

## Safety Rules

These are product invariants, not style preferences:

- No AI-generated Git commands.
- No arbitrary command execution.
- All Git commands must go through `child_process.execFile` with an args array.
- Never use shell string interpolation for Git commands.
- Destructive flows must use two-step confirmation.
- Destructive confirmations must show the exact command before execution.
- New handlers must be fixed, reviewed, tested, and registered deliberately.
- Natural-language routing may only route to registered handler IDs.

## Adding a Handler

When adding or changing a handler:

- Add or update unit tests.
- Add or update real-git tests when detection depends on actual `.git` state.
- Update error-map integrity tests if a pasted error maps to the handler.
- Update README/docs if user-facing behavior changes.
- Explain the safety tier in the PR.

## Pull Request Expectations

Each PR should include:

- What changed and why.
- Screenshots or video for UI/Marketplace/README changes.
- Tests run.
- Whether the change affects Marketplace publishing.
- Whether the change touches a safety-sensitive area.

Maintainers may ask for smaller PRs if a change mixes unrelated work.
