# Repository Governance

GitRescue uses balanced open-source governance: easy to contribute, strict where
Git safety matters.

## Main Branch Rules

Source of truth: `.github/rulesets/main.json`.

Expected GitHub ruleset for `main`:

- Require pull requests before merge.
- Require 1 approving review.
- Dismiss stale approvals on new commits.
- Require conversation resolution.
- Require status checks:
  - `check`
  - `integration`
- Block force pushes.
- Block branch deletion.
- Require linear history.
- Allow admin bypass for emergency Marketplace fixes.
- Do not require signed commits yet.

## Contributor Flow

1. Open an issue or discussion for larger behavior changes.
2. Open a PR using the PR template.
3. Keep changes focused.
4. Run relevant tests before requesting review.
5. Wait for CI and review before merge.

## Safety-Sensitive Areas

Maintainer review is expected for:

- Git command execution
- handler behavior
- destructive confirmation flows
- natural-language routing
- Git error mapping
- Marketplace publishing workflows

## Automation

- `CI`: lint, typecheck, tests, build, package smoke.
- `Labeler`: applies labels from changed paths.
- `PR Title`: enforces conventional PR titles.
- `Markdown Links`: checks README/docs links.
- `Draft GitHub Release`: creates draft releases on `v*` tags.
