#!/usr/bin/env bash
# worktree.sh — Manage git worktrees for parallel Claude Code sessions
#
# Usage:
#   ./scripts/worktree.sh create <name> [base-branch]   Create a new worktree
#   ./scripts/worktree.sh list                           List all worktrees
#   ./scripts/worktree.sh remove <name>                  Remove a worktree
#   ./scripts/worktree.sh status                         Show status of all worktrees
#   ./scripts/worktree.sh clean                          Remove all worktrees except main
#
# Examples:
#   ./scripts/worktree.sh create feature-auth            # branch from current HEAD
#   ./scripts/worktree.sh create bugfix-123 main         # branch from main
#   ./scripts/worktree.sh remove feature-auth
#
# Worktrees are created as siblings: ../area-tecnica-<name>/
# Each worktree gets its own node_modules via npm install --legacy-peer-deps

set -euo pipefail

REPO_NAME="area-tecnica"
PARENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$PARENT_DIR"

create_worktree() {
    local name="$1"
    local base="${2:-HEAD}"
    local worktree_dir="$(dirname "$REPO_ROOT")/${REPO_NAME}-${name}"
    local branch_name="wt/${name}"

    if [ -d "$worktree_dir" ]; then
        echo "Error: Worktree directory already exists: $worktree_dir"
        exit 1
    fi

    echo "Creating worktree: $worktree_dir (branch: $branch_name from $base)"
    git -C "$REPO_ROOT" worktree add -b "$branch_name" "$worktree_dir" "$base"

    echo "Installing dependencies..."
    (cd "$worktree_dir" && npm install --legacy-peer-deps)

    echo ""
    echo "Worktree ready. To start working:"
    echo "  cd $worktree_dir"
    echo "  claude"
    echo ""
    echo "Shell alias (add to ~/.bashrc or ~/.zshrc):"
    echo "  alias z${name:0:1}='cd $worktree_dir && claude'"
}

list_worktrees() {
    echo "Active worktrees:"
    echo ""
    git -C "$REPO_ROOT" worktree list
}

remove_worktree() {
    local name="$1"
    local worktree_dir="$(dirname "$REPO_ROOT")/${REPO_NAME}-${name}"
    local branch_name="wt/${name}"

    if [ ! -d "$worktree_dir" ]; then
        echo "Error: Worktree not found: $worktree_dir"
        exit 1
    fi

    echo "Removing worktree: $worktree_dir"
    git -C "$REPO_ROOT" worktree remove "$worktree_dir" --force

    # Optionally delete the branch
    read -p "Delete branch $branch_name? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git -C "$REPO_ROOT" branch -D "$branch_name" 2>/dev/null || true
    fi

    echo "Worktree removed."
}

status_worktrees() {
    echo "Worktree status:"
    echo ""
    git -C "$REPO_ROOT" worktree list --porcelain | while IFS= read -r line; do
        if [[ "$line" == worktree* ]]; then
            dir="${line#worktree }"
            echo "--- $dir ---"
            if [ -d "$dir" ]; then
                (cd "$dir" && git status --short 2>/dev/null || echo "  (unable to read)")
            fi
            echo ""
        fi
    done
}

clean_worktrees() {
    echo "This will remove ALL worktrees except the main one."
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi

    git -C "$REPO_ROOT" worktree list --porcelain | while IFS= read -r line; do
        if [[ "$line" == worktree* ]]; then
            dir="${line#worktree }"
            if [ "$dir" != "$REPO_ROOT" ]; then
                echo "Removing: $dir"
                git -C "$REPO_ROOT" worktree remove "$dir" --force 2>/dev/null || true
            fi
        fi
    done

    git -C "$REPO_ROOT" worktree prune
    echo "All worktrees cleaned."
}

# --- Main ---
case "${1:-help}" in
    create)
        [ -z "${2:-}" ] && { echo "Usage: $0 create <name> [base-branch]"; exit 1; }
        create_worktree "$2" "${3:-HEAD}"
        ;;
    list)
        list_worktrees
        ;;
    remove)
        [ -z "${2:-}" ] && { echo "Usage: $0 remove <name>"; exit 1; }
        remove_worktree "$2"
        ;;
    status)
        status_worktrees
        ;;
    clean)
        clean_worktrees
        ;;
    help|*)
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create <name> [base]   Create worktree (default base: HEAD)"
        echo "  list                   List all worktrees"
        echo "  remove <name>          Remove a worktree"
        echo "  status                 Show status of all worktrees"
        echo "  clean                  Remove all worktrees except main"
        echo ""
        echo "Worktrees are created at: ../area-tecnica-<name>/"
        echo "Branches are named: wt/<name>"
        ;;
esac
