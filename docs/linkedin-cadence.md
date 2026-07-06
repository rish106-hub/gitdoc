# GitRescue LinkedIn Cadence

Founder profile: https://www.linkedin.com/in/rishav-dewan/

## Story Arc

The launch story should not sound like a generic tool announcement. It should
show the journey:

1. You kept seeing smart builders get blocked by Git's language.
2. You considered the obvious AI chat interface.
3. You rejected AI-generated Git commands because safety matters.
4. You built GitRescue around fixed, audited rescue paths.
5. You are launching it for students, junior developers, designers who code, and
   builders using VS Code or Cursor.

Expected pushback:

- "Why not just learn Git?"
- "Why not ask ChatGPT?"
- "Won't this hide fundamentals?"

Response:

> GitRescue is not trying to replace learning Git. It is trying to make the scary
> recovery moments understandable and safe. The product explains the state before
> it offers an action, and it never generates arbitrary commands.

## Day -7: Pain / Origin Story

```text
Git errors are written like they are trying to win an argument.

I have seen smart people lose 30 minutes to messages like:

"You are in detached HEAD state"
"fatal: refusing to merge unrelated histories"
"Your local changes would be overwritten by merge"

The problem is not that developers are lazy.

The problem is that Git explains internal machinery when the user needs three
things:

1. What happened?
2. Am I going to lose work?
3. What should I do next?

That is what led me to build GitRescue.

It is a VS Code/Cursor extension that detects common Git trouble states and
turns them into plain-English explanations plus safe next steps.

The target user is not the Git power user.

It is the student, junior developer, designer who codes, or builder who knows
what they want to make but does not want to memorize every Git failure mode.

Launching soon.
```

Suggested asset: `media/launch/linkedin-01-story.png`

## Day -5: Safety / Anti-Magic

```text
I refused to let GitRescue generate arbitrary Git commands.

That sounds like a small product decision.

It is not.

Git is one of those domains where a confident wrong command can destroy trust
instantly.

So GitRescue is deliberately boring in the places where boring is good:

- fixed handler whitelist
- deterministic routing
- execFile instead of shell interpolation
- no AI-generated Git commands
- two-step confirmation for destructive actions
- exact command preview before anything risky runs

The goal is not to make Git magical.

The goal is to make Git recovery safe enough that a beginner can understand what
is happening before they click anything.
```

Suggested asset: `media/launch/linkedin-02-safety.png`

## Day -3: Demo Teaser

```text
"Detached HEAD" sounds like a medical emergency.

In Git, it usually means you checked out a commit directly instead of being on a
branch.

The scary part for beginners is this:

"If I commit here, will I lose my work?"

One of the first GitRescue flows I built handles exactly that.

1. It detects the detached HEAD state.
2. It explains why the work may become hard to find.
3. It offers to create a branch.
4. The work becomes reachable again.

No shame.
No terminal archaeology.
No AI-generated command.

Just the repo state, explained clearly.
```

Suggested asset: `media/launch/product-hunt-02-detection.png`

## Launch Day

```text
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

The most important product decision:

GitRescue does not generate Git commands with AI.

Every fix is a fixed, audited handler.
Safe actions ask once.
Destructive actions ask twice and show the exact command before anything runs.

I built it for students, junior developers, designers who code, and builders who
want Git to feel less like a trapdoor.

Product Hunt: <add Product Hunt launch link>
Marketplace: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
GitHub: https://github.com/rish106-hub/gitdoc

Would love feedback, especially on which Git error GitRescue should rescue next.
```

Suggested asset: `media/launch/linkedin-03-launch.png`

## Day +2: Learnings

```text
The strongest feedback on GitRescue so far is not "add more AI."

It is almost the opposite:

- show me what state my repo is in
- explain it without jargon
- do not run anything destructive without making it obvious
- give me the smallest safe next step

That has been a useful reminder.

For developer tools, trust often beats magic.

GitRescue will keep moving in that direction: fixed rescue paths, clearer
explanations, and more coverage for the Git errors that beginners actually hit.
```

Suggested asset: `media/launch/linkedin-04-feedback.png`

## DM Template

```text
Hey <name> — I launched GitRescue today.

It is a VS Code/Cursor extension that turns confusing Git states into
plain-English fixes.

The trust angle: it does not generate Git commands with AI. It uses fixed,
audited handlers and two-step confirmation for risky actions.

Would love your feedback on whether this would have helped when you were
learning Git:

<Product Hunt link>
```
