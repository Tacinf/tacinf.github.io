#!/usr/bin/env bash
# Push the site and try to enable GitHub Pages.
# Run after creating the public repo tacinf/tacinf.github.io.
set -euo pipefail

ORG="tacinf"
REPO="tacinf.github.io"
REMOTE="git@github.com:${ORG}/${REPO}.git"

cd "$(dirname "$0")/.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: not a git repository" >&2
  exit 1
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh repo view "${ORG}/${REPO}" >/dev/null 2>&1; then
    echo "error: repository ${ORG}/${REPO} was not found."
    echo "Create it first as a public, empty repository:"
    echo "  https://github.com/organizations/${ORG}/repositories/new"
    exit 1
  fi
fi

if git remote get-url origin >/dev/null 2>&1; then
  current="$(git remote get-url origin)"
  if [ "$current" != "$REMOTE" ]; then
    echo "origin is $current"
    echo "expected $REMOTE"
    echo "Update it with: git remote set-url origin $REMOTE"
    exit 1
  fi
else
  git remote add origin "$REMOTE"
fi

git push -u origin main

if command -v gh >/dev/null 2>&1; then
  if gh api --method POST "repos/${ORG}/${REPO}/pages" \
      -H "Accept: application/vnd.github+json" \
      -f 'source[branch]=main' \
      -f 'source[path]=/' >/dev/null 2>&1; then
    echo "GitHub Pages enabled."
  else
    echo "Could not enable Pages via API (it may already be on)."
    echo "Enable it at: https://github.com/${ORG}/${REPO}/settings/pages"
  fi
fi

echo "Site: https://${ORG}.github.io/"
