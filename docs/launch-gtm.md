# GitRescue Launch Control

## Positioning

GitRescue is the VS Code/Cursor extension for developers who know what they want
to do, but do not want to memorize Git's failure modes.

Core story:

> Git without the panic. GitRescue detects confusing Git states, explains them in
> plain English, and offers audited fixes. No AI-generated Git commands.

Primary audience:

- Students and junior developers who freeze when Git prints a wall of text.
- Designers, PMs, and builders who code in VS Code or Cursor.
- Experienced developers who want guardrails around risky Git operations.

## Launch Links

- Marketplace: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
- GitHub: https://github.com/rish106-hub/gitdoc (private until launch-ready)
- Founder LinkedIn: https://www.linkedin.com/in/rishav-dewan/
- Product Hunt profile: https://www.producthunt.com/@rishav_dewan
- Product Hunt: `<add launch URL>`
- Demo video: `<add video URL>`
- Feedback/issues: https://github.com/rish106-hub/gitdoc/issues

## 7-Day Timeline

### T-7: Story + Pain

- Publish LinkedIn pain/story post.
- Ask 10-20 developer friends what Git error confused them most.
- Start a private supporter list with name, channel, timezone, and relationship.
- Confirm Marketplace install works from `rish106-hub.git-rescue`.

### T-5: Safety Principle

- Publish LinkedIn "no AI-generated Git commands" post.
- Share the safety model: audited handlers, `execFile`, two-step confirmation.
- Ask early users whether "no AI-generated commands" increases trust.

### T-3: Demo Teaser

- Publish detached HEAD demo teaser.
- Record or finalize the 60-90 second demo video.
- Confirm Product Hunt gallery images and card are ready.

### T-2: Product Hunt Setup

- Schedule Product Hunt launch.
- Add maker comment, gallery, thumbnail, demo video, and links.
- Prepare launch-day replies for common questions.
- Re-run manual QA in VS Code and Cursor.

### T-1: Dry Run

- Install from Marketplace in a fresh VS Code profile.
- Run `scripts/setup-launch-demo-repo.sh` and rehearse the demo flow.
- Pin launch copy drafts.
- Confirm README, Marketplace page, and GitHub links render correctly.

### T Day: Launch

- Product Hunt goes live at `12:01am Pacific Time`.
- Post maker comment immediately.
- Reply to every Product Hunt comment quickly.
- Publish LinkedIn launch post after Product Hunt is live.
- Send personal supporter pings asking for feedback/support, not upvotes.
- Drive traffic to Product Hunt during launch day; drive traffic to Marketplace after launch day.

### T+1: Follow-Up

- Thank supporters.
- Collect Git errors requested by users.
- Open GitHub issues for repeated feedback.

### T+2: Learnings

- Publish LinkedIn learnings/feedback post.
- Mention what users responded to: clarity, safety, local deterministic fixes.

### T+3: Ship Response

- Ship or announce one small improvement from launch feedback.
- Update README/Product Hunt comment with any major FAQ answers.

## LinkedIn Sequence

### Day -7: Pain

Hook:

> Git errors are written like they are trying to win an argument.

Body:

I have watched smart people lose 30 minutes to messages like "fatal: refusing to
merge unrelated histories" or "You are in detached HEAD state."

The problem is not that developers are lazy. It is that Git explains internal
machinery when the user needs an answer:

- What happened?
- Am I going to lose work?
- What should I do next?

I am launching GitRescue this week: a VS Code/Cursor extension that detects the
common Git states beginners hit and turns them into plain-English fixes.

No AI-generated commands. Just fixed, audited handlers for the situations that
actually hurt.

### Day -5: Safety

Hook:

> I refused to let GitRescue generate arbitrary Git commands.

Body:

It would have been easy to make a chat box that says "ask anything about Git."

But Git is one of those domains where a confident wrong command can destroy
trust instantly.

So GitRescue is deliberately boring in the right places:

- deterministic classifier
- fixed handler whitelist
- `execFile` instead of shell interpolation
- two-step confirmation for destructive actions
- exact command preview before anything risky runs

The product idea is simple: make common Git recovery feel safe, not magical.

### Day -3: Demo Teaser

Hook:

> Detached HEAD sounds like a medical problem. GitRescue treats it like a normal workflow state.

Body:

This is one of the first flows I built:

1. You accidentally check out a commit.
2. GitRescue detects the detached HEAD state.
3. It explains that new commits may be hard to find later.
4. It offers to create a branch and preserve the work.

That is the product philosophy: do not shame the user, explain the state, make
the safe next action obvious.

### Launch Day

Hook:

> I built GitRescue: Git without the panic.

Body:

GitRescue is live.

It is a VS Code/Cursor extension for the Git moments that break your flow:

- detached HEAD
- merge conflicts
- paused rebases
- stash pop conflicts
- diverged branches
- undo last commit
- force push with guardrails
- pasted Git errors you do not want to decode manually

The important part: GitRescue does not generate Git commands with AI.

Every fix is a fixed, audited handler. Safe actions ask once. Destructive actions
ask twice and show the exact command before anything runs.

I built it for students, junior developers, designers who code, and anyone who
has ever copied a Git command from Stack Overflow while quietly praying.

Product Hunt: `<link>`
Marketplace: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
GitHub: https://github.com/rish106-hub/gitdoc

### Day +2: Learnings

Hook:

> The strongest feedback on GitRescue so far is not "add more AI."

Body:

People are responding to the opposite:

- show me what state my repo is in
- explain it without jargon
- do not run anything destructive without making it obvious
- give me the smallest safe next step

That is a useful reminder for developer tools. Sometimes trust beats magic.

## Product Hunt Assets

- Name: `GitRescue`
- Tagline: `Plain-English Git rescue for VS Code and Cursor.`
- CTA: `Try it in VS Code or Cursor, then tell me which Git error should be rescued next.`
- Thumbnail/card: `media/png/gitrescue-product-hunt-card.png`
- Demo video script: `docs/launch-video-script.md`
- Generated gallery assets: `media/launch/product-hunt-01-hero.png` through `media/launch/product-hunt-06-sidebar.png`

Short description:

> GitRescue watches your repo for the Git states that trip developers up:
> detached HEAD, merge conflicts, paused rebases, diverged branches, and more.
> When it finds one, it explains what happened and offers a safe, audited fix.
> No AI-generated commands. No terminal guesswork.

Gallery order:

1. Hero: "Git without the panic."
2. Detection: detached HEAD or conflict notification.
3. Explanation: plain-English "what happened / why / what to do."
4. Safety: two-step destructive confirmation with exact command.
5. Ask GitRescue: natural language input such as `undo my last commit`.
6. Sidebar: Actions and Status.

Maker comment:

> Hey Product Hunt,
>
> I built GitRescue because Git errors are one of the fastest ways to break a
> beginner's flow.
>
> The interesting part is that Git problems are not infinite. Most scary moments
> cluster around a small set of states: detached HEAD, merge conflicts, paused
> rebases, branches diverging from remote, local changes blocking a pull, and a
> few others.
>
> GitRescue does not ask an AI to invent commands. It ships with fixed, audited
> handlers. It watches your repo, explains the current state in plain English,
> and only then offers a fix. Destructive actions always require a two-step
> confirmation that shows the exact command.
>
> It is built for students, junior developers, designers who code, and anyone
> using VS Code or Cursor who wants Git to feel less like a trapdoor.
>
> Would love feedback on which Git state confused you most when you were
> learning, whether "no AI-generated commands" is a trust signal, and which next
> handler would make this useful in your daily workflow.

## Launch-Day Hour-By-Hour

- `12:01am PT`: launch goes live; post maker comment.
- `12:15am PT`: verify links, images, video, install CTA.
- `12:30am PT`: send first personal supporter messages.
- `1:00am-4:00am PT`: reply to comments; collect repeated questions.
- `6:00am PT`: second supporter wave for US/EU mornings.
- `9:00am PT`: publish LinkedIn launch post.
- `9:00am-6:00pm PT`: check Product Hunt comments every 15-30 minutes.
- `6:00pm PT`: final supporter reminder and founder update.
- `11:00pm PT`: close day with thank-you comment and next-step note.

## Supporter Outreach

Rules:

- Ask for feedback/support, not upvotes.
- Send personal messages, not a bulk blast.
- Mention why the recipient might care.
- Include the Product Hunt link on launch day and Marketplace link afterward.

Template:

```text
Hey <name> — I launched GitRescue today, a VS Code/Cursor extension that turns
confusing Git states into plain-English fixes.

The key trust bit: it does not generate Git commands with AI. It uses audited
handlers and two-step confirmation for risky actions.

Would love your feedback, especially on whether this would have helped when you
were learning Git: <Product Hunt link>
```

## Sources

- Product Hunt launch guide: https://www.producthunt.com/launch
- Product Hunt timing guidance: https://www.producthunt.com/launch/preparing-for-launch
- LinkedIn product launch framework: https://www.linkedin.com/business/marketing/blog/linkedin-ads/how-to-launch-a-product-on-linkedin

## Generated Assets

Run:

```bash
npm run gen:launch-assets
```

Outputs:

- Product Hunt gallery: `media/launch/product-hunt-*.png`
- LinkedIn post images: `media/launch/linkedin-*.png`
- Manifest: `media/launch/manifest.json`
