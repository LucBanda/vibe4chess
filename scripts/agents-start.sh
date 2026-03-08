#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="$(dirname "$ROOT_DIR")"
PROJECT_NAME="$(basename "$ROOT_DIR")"

declare -a ROLES=(
  "meta-po"
  "dev"
  "test"
  "review"
  "network-security"
  "integration"
  "documentation"
)

declare -A ROLE_BRANCH=(
  ["meta-po"]="po/sprint-board"
  ["dev"]="dev/story-active"
  ["test"]="test/story-active"
  ["review"]="review/story-active"
  ["network-security"]="sec/story-active"
  ["integration"]="int/sprint-merge"
  ["documentation"]="doc/sprint-notes"
)

declare -A ROLE_PROMPT=(
  ["meta-po"]="agents/meta-po.md"
  ["dev"]="agents/development.md"
  ["test"]="agents/testing.md"
  ["review"]="agents/review.md"
  ["network-security"]="agents/network-security.md"
  ["integration"]="agents/integration.md"
  ["documentation"]="agents/documentation.md"
)

echo "== Agents setup for $PROJECT_NAME =="
echo "Project root: $ROOT_DIR"
echo

for role in "${ROLES[@]}"; do
  worktree_dir="$BASE_DIR/${PROJECT_NAME}-${role}"
  branch_name="${ROLE_BRANCH[$role]}"

  if [[ -d "$worktree_dir/.git" || -f "$worktree_dir/.git" ]]; then
    echo "[ok] worktree exists: $worktree_dir"
    continue
  fi

  if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$branch_name"; then
    git -C "$ROOT_DIR" worktree add "$worktree_dir" "$branch_name" >/dev/null
    echo "[ok] worktree created: $worktree_dir (branch $branch_name)"
  else
    git -C "$ROOT_DIR" worktree add -b "$branch_name" "$worktree_dir" >/dev/null
    echo "[ok] worktree created: $worktree_dir (new branch $branch_name)"
  fi
done

echo
echo "== How to run each agent =="
for role in "${ROLES[@]}"; do
  worktree_dir="$BASE_DIR/${PROJECT_NAME}-${role}"
  prompt_file="${ROLE_PROMPT[$role]}"
  echo "- $role"
  echo "  cd $worktree_dir"
  echo "  open $prompt_file"
done

echo
echo "Status board:"
echo "  $ROOT_DIR/agents/status.md"
