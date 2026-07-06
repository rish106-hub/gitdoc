# Security Policy

## Supported Versions

Security fixes target the latest Marketplace version of GitRescue.

## Reporting a Vulnerability

Please do not open a public GitHub issue for exploitable security problems.

Report privately by emailing the maintainer or opening a minimal GitHub issue
that says you have a private security report to share, without exploit details.

Security-sensitive areas include:

- command injection
- shell interpolation
- unsafe Git command execution
- destructive actions that bypass confirmation
- repo data loss
- Marketplace token leakage
- extension activation paths that can run unexpected code

## Project Security Rules

- Git commands must use `execFile` with an args array.
- Destructive actions must require two-step confirmation.
- GitRescue must not generate Git commands with AI.
- Tokens and Marketplace credentials must never be committed.
