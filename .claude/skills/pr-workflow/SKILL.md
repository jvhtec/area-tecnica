---
name: pr-workflow
description: The standard PR workflow for this repo — taking work from ready-on-a-branch to merged into main. Use whenever creating, updating, or shepherding a pull request. Defines what an assistant does on its own (prepare + shepherd), what stays human (the merge), which PRs count as high-risk, the CodeRabbit protocol, the quality bar, and the mistakes to avoid.
---

Read and follow `docs/agents/pr-workflow.md` — it is the canonical, agent-agnostic definition of this repository's PR workflow (authority boundary, high-risk classification, CodeRabbit protocol, quality bar, mistakes to avoid, pre-handoff self-check). Do not duplicate or paraphrase it here; if it conflicts with anything you believe about the process, the doc wins.

## Claude-specific tool mappings

Where the canonical doc names a generic step, use these:

- "check for hardcoded English UI strings" → `/i18n-check` on the changed files
- "diagnose and fix CI failures" → `/ci-fix <job/error>`
- "subscribe to PR events" → `subscribe_pr_activity` (claude-code-remote MCP); react to `<github-webhook-activity>` events instead of polling
- "exhaustive pre-merge audit" → `/release-readiness` for production-bound PRs
- GitHub operations (PR creation, reviews, thread resolution, CI status) → the `mcp__github__*` tools via ToolSearch — `gh` CLI is not available in remote sessions
