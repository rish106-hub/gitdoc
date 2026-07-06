# GitRescue Launch Checklist

## Launch Blockers

- [ ] Marketplace install works from `rish106-hub.git-rescue`.
- [ ] Fresh VS Code install shows `GitRescue` and `gitrescue.*` commands.
- [ ] Cursor install path is documented or VSIX fallback is ready.
- [ ] GitHub README renders with banner image.
- [ ] GitHub repo is private until the launch-ready decision.
- [ ] Marketplace link works: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
- [ ] GitHub repo link works: https://github.com/rish106-hub/gitdoc
- [ ] Icon, banner, logo, and Product Hunt card are final.
- [ ] Demo repo script runs: `scripts/setup-launch-demo-repo.sh`.
- [ ] Manual QA passes in VS Code and Cursor.
- [ ] Product Hunt maker comment is ready.
- [ ] Product Hunt gallery is ready in this order: hero, detection, explanation, safety, Ask GitRescue, sidebar.
- [ ] Generated launch assets exist in `media/launch/`.
- [ ] Demo video is recorded or linked.
- [ ] LinkedIn launch posts are drafted.
- [ ] LinkedIn cadence is ready in `docs/linkedin-cadence.md`.
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
- [ ] Gallery image 1: `media/launch/product-hunt-01-hero.png`.
- [ ] Gallery image 2: `media/launch/product-hunt-02-detection.png`.
- [ ] Gallery image 3: `media/launch/product-hunt-03-explanation.png`.
- [ ] Gallery image 4: `media/launch/product-hunt-04-safety.png`.
- [ ] Gallery image 5: `media/launch/product-hunt-05-ask.png`.
- [ ] Gallery image 6: `media/launch/product-hunt-06-sidebar.png`.
- [ ] Demo video link added.
- [ ] Marketplace, GitHub, and feedback links added.

## LinkedIn Readiness

- [ ] Day -7 pain/story post ready.
- [ ] Day -5 safety/no-AI-generated-commands post ready.
- [ ] Day -3 demo teaser ready.
- [ ] Launch-day announcement ready.
- [ ] Day +2 learnings post ready.
- [ ] LinkedIn image 1: `media/launch/linkedin-01-story.png`.
- [ ] LinkedIn image 2: `media/launch/linkedin-02-safety.png`.
- [ ] LinkedIn image 3: `media/launch/linkedin-03-launch.png`.
- [ ] LinkedIn image 4: `media/launch/linkedin-04-feedback.png`.

## Launch-Day Operating Rules

- Ask for feedback/support, not upvotes.
- Reply to every Product Hunt comment quickly.
- Drive traffic to Product Hunt during launch day.
- Drive traffic to Marketplace after launch day.
- Open GitHub issues for repeated product feedback.
