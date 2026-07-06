# Product Hunt Listing

Maker profile: https://www.producthunt.com/@rishav_dewan

## Listing Fields

- Product name: `GitRescue`
- Tagline: `Plain-English Git rescue for VS Code and Cursor.`
- Website/primary link: https://marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue
- GitHub link: https://github.com/rish106-hub/gitdoc
- CTA: `Try it in VS Code or Cursor, then tell me which Git error should be rescued next.`
- Thumbnail/card: `media/png/gitrescue-product-hunt-card.png`

## Gallery Upload Order

1. `media/launch/product-hunt-01-hero.png`
2. `media/launch/product-hunt-02-detection.png`
3. `media/launch/product-hunt-03-explanation.png`
4. `media/launch/product-hunt-04-safety.png`
5. `media/launch/product-hunt-05-ask.png`
6. `media/launch/product-hunt-06-sidebar.png`

## Short Description

GitRescue watches your repo for the Git states that trip developers up:
detached HEAD, merge conflicts, paused rebases, diverged branches, and more. It
explains what happened and offers safe, audited fixes. No AI-generated commands.
No terminal guesswork.

## Maker Comment

Hey Product Hunt,

I built GitRescue because Git errors are one of the fastest ways to break a
beginner's flow.

The interesting part is that Git problems are not infinite. Most scary moments
cluster around a small set of states: detached HEAD, merge conflicts, paused
rebases, branches diverging from remote, local changes blocking a pull, and a
few others.

GitRescue does not ask an AI to invent commands. It ships with fixed, audited
handlers. It watches your repo, explains the current state in plain English, and
only then offers a fix. Destructive actions always require a two-step
confirmation that shows the exact command.

It is built for students, junior developers, designers who code, and anyone
using VS Code or Cursor who wants Git to feel less like a trapdoor.

Would love feedback on:

- Which Git state confused you most when you were learning?
- Is "no AI-generated commands" a trust signal for you?
- Which next handler would make this useful in your daily workflow?

## Expected Pushback

### "Why not just learn Git?"

GitRescue does not replace learning Git. It explains the repo state before it
offers an action, so users learn what happened while staying safe.

### "Why not ask ChatGPT?"

GitRescue is intentionally not an arbitrary Git command generator. It uses fixed,
audited handlers and two-step confirmation for risky actions.

### "Will this make beginners dependent?"

The product is for recovery moments, not hiding fundamentals. The explanation is
the core feature: what happened, why it happened, and what the safe next step is.

### "What if it runs the wrong command?"

Handlers are fixed and tested. Destructive handlers require two confirmations and
show the exact command before execution.

## Launch-Day Reply Snippets

```text
Thanks for checking it out. The main design choice is that GitRescue never
generates arbitrary Git commands. It only routes to fixed, audited handlers.
```

```text
That error is exactly the kind of thing I want to add to the map. If you can
share the exact Git message with private details removed, I can turn it into a
plain-English explanation.
```

```text
Totally fair point. GitRescue is not aimed at Git power users. It is for people
who understand what they want to do but get blocked by Git's failure language.
```
