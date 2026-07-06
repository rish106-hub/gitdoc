#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/tmp/gitrescue-launch-demo}"

rm -rf "$ROOT"
mkdir -p "$ROOT"
cd "$ROOT"

git init -b main >/dev/null
git config user.email "demo@gitrescue.local"
git config user.name "GitRescue Demo"

cat > README.md <<'EOF'
# Launch Demo App

A tiny repo used to demonstrate GitRescue flows.
EOF

cat > app.js <<'EOF'
function greeting(name) {
  return `Hello, ${name}!`;
}

console.log(greeting("GitRescue"));
EOF

git add README.md app.js
git commit -m "Initial demo app" >/dev/null

cat > app.js <<'EOF'
function greeting(name) {
  return `Hello, ${name}!`;
}

function status() {
  return "ready for launch";
}

console.log(greeting("GitRescue"));
console.log(status());
EOF

git add app.js
git commit -m "Add launch status" >/dev/null

git checkout -b feature/homepage >/dev/null
cat > app.js <<'EOF'
function greeting(name) {
  return `Welcome, ${name}!`;
}

function status() {
  return "ready for launch";
}

console.log(greeting("GitRescue"));
console.log(status());
EOF
git commit -am "Update homepage greeting" >/dev/null

git checkout main >/dev/null
cat > app.js <<'EOF'
function greeting(name) {
  return `Hello from main, ${name}!`;
}

function status() {
  return "ready for launch";
}

console.log(greeting("GitRescue"));
console.log(status());
EOF
git commit -am "Update main greeting" >/dev/null

cat <<EOF
Created demo repo at:
  $ROOT

Useful demo commands:
  cd "$ROOT"

Detached HEAD:
  git checkout \$(git rev-parse HEAD)

Merge conflict:
  git switch main
  git merge feature/homepage

Ask GitRescue:
  Use "GitRescue: Ask" and type: undo my last commit

Error Explainer paste:
  fatal: refusing to merge unrelated histories

To reset the demo repo:
  scripts/setup-launch-demo-repo.sh
EOF
