# GitRescue Launch GTM

## Positioning

GitRescue is the VS Code/Cursor extension for developers who know what they want to
do, but do not want to memorize Git's failure modes.

The launch story:

> Git should not make beginners feel stupid. Most Git disasters are the same ten
> situations repeating. GitRescue detects them, explains them in plain English, and
> offers audited one-click fixes.

The wedge is not "AI for Git." The wedge is safer:

- No AI-generated commands.
- No terminal archaeology.
- Fixed, audited handlers for the Git states people actually hit.
- Two-step confirmation for destructive actions.
- Works locally, without tokens or internet.

## Primary audience

- Students and junior developers who freeze when Git prints a wall of text.
- Designers, PMs, and "vibe coders" working in VS Code or Cursor.
- Experienced developers who want a safety net for destructive Git operations.

Avoid pitching to Git power users first. They will ask why they need it. The
launch should target people who already feel the pain.

## One-line options

Use one of these consistently across Marketplace, Product Hunt, and posts:

1. GitRescue turns confusing Git states into plain-English fixes inside VS Code.
2. Git that does not make you Google everything.
3. A local Git rescue extension for VS Code and Cursor.
4. One-click fixes for the Git problems beginners hit every week.

Recommended:

> GitRescue turns confusing Git states into plain-English fixes inside VS Code.

## Product Hunt assets

### Name

GitRescue

Use this exact name across the package display name, README, activity bar,
Product Hunt listing, and launch posts.

### Tagline

Plain-English Git rescue for VS Code and Cursor.

### Short description

GitRescue watches your repo for the Git states that trip developers up: detached
HEAD, merge conflicts, paused rebases, diverged branches, and more. When it
finds one, it explains what happened and offers a safe, audited fix. No
AI-generated commands. No terminal guesswork.

### Maker comment

Hey Product Hunt,

I built GitRescue because Git errors are one of the fastest ways to break a
beginner's flow.

The interesting part is that Git problems are not infinite. Most scary moments
cluster around a small set of states: detached HEAD, merge conflicts, paused
rebases, branches diverging from remote, local changes blocking a pull, and a
few others.

So GitRescue does not ask an AI to invent commands. It ships with fixed, audited
handlers. It watches your repo, explains the current state in plain English, and
only then offers a fix. Destructive actions always require a two-step
confirmation that shows the exact command.

It is built for students, junior developers, designers who code, and anyone
using VS Code or Cursor who wants Git to feel less like a trapdoor.

Would love feedback on:

- Which Git state confused you most when you were learning?
- Is "no AI-generated commands" a trust signal for you?
- Which next handler would make this useful in your daily workflow?

### Product Hunt gallery sequence

1. Hero: "Git that does not make you Google everything."
2. Detection: show a detached HEAD or conflict notification.
3. Explanation: show the plain-English "what happened / why / what to do."
4. Safety: show the two-step destructive confirmation with exact command.
5. Ask GitRescue: show natural language input, e.g. "undo my last commit."
6. Sidebar: show Actions and Status.

### Launch-day CTA

Try it in VS Code or Cursor, then paste the Git error that last annoyed you.

## LinkedIn launch campaign

Do not make launch day the first post. Run a 7-day runway with founder-led
posts. The content should feel like a real build story, not a polished ad.

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

### Day -5: Build principle

Hook:

> I refused to let GitRescue generate arbitrary Git commands.

Body:

It would have been easy to make a chat box that says "ask anything about Git."

But Git is one of those domains where a confident wrong command can destroy
trust instantly.

So GitRescue is deliberately boring in the right places:

- deterministic classifier
- fixed handler whitelist
- execFile instead of shell interpolation
- two-step confirmation for destructive actions
- exact command preview before anything risky runs

The product idea is simple: make common Git recovery feel safe, not magical.

### Day -3: Demo teaser

Hook:

> Detached HEAD sounds like a medical problem. GitRescue treats it like a normal
> workflow state.

Body:

This is one of the first flows I built:

1. You accidentally check out a commit.
2. GitRescue detects the detached HEAD state.
3. It explains that new commits may be hard to find later.
4. It offers to create a branch and preserve the work.

That is the whole product philosophy: do not shame the user, explain the state,
make the safe next action obvious.

Launch video soon.

### Launch day post

Hook:

> I built GitRescue: Git that does not make you Google everything.

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

Would love for you to try it and tell me the Git error that still annoys you.

Product Hunt: <link>
Marketplace: <link>
GitHub: <link>

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

## Product Hunt timing

Product Hunt's official launch guide says the homepage runs on a 24-hour cycle
based on Pacific time and recommends scheduling at 12:01am PST when there is no
other constraint. Schedule the launch in advance and have the first comment,
gallery, demo video, and outreach list ready before launch day.

Launch day operating rhythm:

- T-7 days: start LinkedIn runway; ask friends/users for feedback, not upvotes.
- T-2 days: schedule Product Hunt launch; final QA; prepare links.
- T-1 day: record final demo; pin launch post drafts; test install flow.
- T day 12:01am PST: Product Hunt goes live.
- T day first 4 hours: answer every comment quickly.
- T day India morning/evening: LinkedIn launch post + personal DMs to relevant
  people who already know the product.
- T+1: publish learnings and thank users.
- T+3: ship or announce one small improvement from feedback.

Important: ask people to "support and give feedback", not to blindly upvote.

## Readiness checklist

- [ ] One brand name everywhere: package displayName, README, sidebar, PH.
- [ ] Marketplace listing live and installable.
- [ ] README has at least one screenshot or GIF.
- [ ] GitHub repo has clean "what it does / who it is for / safety model".
- [ ] Product Hunt thumbnail and gallery images prepared.
- [ ] 60-90 second demo video prepared.
- [ ] Demo repo setup script tested.
- [ ] Manual QA run in VS Code and Cursor.
- [ ] Links ready: Marketplace, GitHub, Product Hunt, feedback form/issues.

## Sources checked

- Product Hunt launch guide: https://www.producthunt.com/launch
- Product Hunt timing guidance: https://www.producthunt.com/launch/preparing-for-launch
- LinkedIn product launch framework: https://www.linkedin.com/business/marketing/blog/linkedin-ads/how-to-launch-a-product-on-linkedin
