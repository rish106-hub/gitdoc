# GitRescue Launch Checklist

## Launch Blockers

- [ ] Marketplace install works from `rish106-hub.git-rescue`.
- [ ] Fresh VS Code install shows `GitRescue` and `gitrescue.*` commands.
- [ ] Cursor install path is documented or VSIX fallback is ready.
- [ ] GitHub README renders with banner image.
- [ ] Marketplace link works: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
- [ ] GitHub repo link works: https://github.com/rish106-hub/gitdoc
- [ ] Icon, banner, logo, and Product Hunt card are final.
- [ ] Demo repo script runs: `scripts/setup-launch-demo-repo.sh`.
- [ ] Manual QA passes in VS Code and Cursor.
- [ ] Product Hunt maker comment is ready.
- [ ] Product Hunt gallery is ready in this order: hero, detection, explanation, safety, Ask GitRescue, sidebar.
- [ ] Demo video is recorded or linked.
- [ ] LinkedIn launch posts are drafted.
- [ ] Supporter list is ready.

## Final QA Commands

```bash
npm run test:unit
npm run test:realgit
npm run build
npm run package
```

## Marketplace Verification

```bash
code --uninstall-extension rish106-hub.git-rescue || true
code --install-extension rish106-hub.git-rescue --force
code --list-extensions --show-versions | rg 'rish106-hub.git-rescue'
```

Expected:

```text
rish106-hub.git-rescue@<latest>
```

Then confirm in VS Code:

- Extension name is `GitRescue`.
- Commands are prefixed `GitRescue:`.
- Command IDs use `gitrescue.*`.
- Status bar shows GitRescue in a git repo.

## Product Hunt Readiness

- [ ] Launch scheduled for `12:01am Pacific Time`.
- [ ] Name: `GitRescue`.
- [ ] Tagline: `Plain-English Git rescue for VS Code and Cursor.`
- [ ] CTA: `Try it in VS Code or Cursor, then tell me which Git error should be rescued next.`
- [ ] Product Hunt card: `media/png/gitrescue-product-hunt-card.png`.
- [ ] Demo video link added.
- [ ] Marketplace, GitHub, and feedback links added.

## LinkedIn Readiness

- [ ] Day -7 pain/story post ready.
- [ ] Day -5 safety/no-AI-generated-commands post ready.
- [ ] Day -3 demo teaser ready.
- [ ] Launch-day announcement ready.
- [ ] Day +2 learnings post ready.

## Launch-Day Operating Rules

- Ask for feedback/support, not upvotes.
- Reply to every Product Hunt comment quickly.
- Drive traffic to Product Hunt during launch day.
- Drive traffic to Marketplace after launch day.
- Open GitHub issues for repeated product feedback.
