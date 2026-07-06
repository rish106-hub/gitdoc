# Publishing GitRescue to the VS Code Marketplace

The CI workflow `.github/workflows/publish.yml` publishes automatically when you
push a `v*` tag. It needs one secret: `VSCE_PAT`. This is **not** a GitHub token —
it's an Azure DevOps Personal Access Token tied to a Marketplace publisher.

## One-time setup

### 1. Create the Marketplace publisher

- Go to https://marketplace.visualstudio.com/manage
- Sign in with a Microsoft account
- Create a publisher whose **ID is exactly `rish106-hub`** (must match the
  `publisher` field in `package.json`)

### 2. Create an Azure DevOps organization

- Go to https://dev.azure.com and sign in with the **same** Microsoft account
- If you have no org yet, create one (any name — it's just the token's home)

### 3. Generate the PAT

- In Azure DevOps: click your avatar (top right) → **Personal access tokens**
- **New Token**, then set:
  - **Organization:** `All accessible organizations` ← important, not a single org
  - **Expiration:** your call (max 1 year; you'll rotate it)
  - **Scopes:** click **Show all scopes** → **Marketplace** → check **Manage**
- Create it, copy the value **now** (shown once). It's a long alphanumeric
  string — **not** prefixed with `ghp_`.

### 4. Store it as a GitHub secret

Run this yourself so the token never lands in chat or a shell history file:

```bash
gh secret set VSCE_PAT --repo rish106-hub/gitrescue
```

It prompts for the value — paste there. Verify:

```bash
gh secret list --repo rish106-hub/gitrescue   # should list VSCE_PAT
```

## Releasing

Once the secret exists:

```bash
# bump version in package.json first (e.g. 0.1.0 -> 0.1.1), then:
git tag v0.1.0
git push origin v0.1.0
```

The `publish.yml` workflow runs: install → build → unit tests → package →
`vsce publish`. Watch it:

```bash
gh run watch --repo rish106-hub/gitrescue
```

## Local publish (alternative, no CI)

If you'd rather publish from your machine:

```bash
export VSCE_PAT=<the-azure-devops-token>
npm run package          # produces git-rescue-<version>.vsix
npx vsce publish         # uses $VSCE_PAT
```

## Before the first publish

The Marketplace listing needs a few assets not yet in the repo (tracked in
`docs/roadmap.md`):

- `icon` — 128×128 PNG, referenced from `package.json`
- `galleryBanner` color + theme in `package.json`
- At least one screenshot / short GIF in the README

## Rotating / revoking

- Revoke a PAT in Azure DevOps → Personal access tokens → Revoke
- Re-run `gh secret set VSCE_PAT` with a new one
- If a token ever leaks, revoke immediately — a Marketplace-Manage token can
  publish or unpublish extensions under your publisher
