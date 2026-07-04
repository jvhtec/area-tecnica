---
name: release-readiness
description: Checks the current branch/PR against docs/release/production-release-checklist.md — pending migrations, local validation commands, CI status across all 3 workflows, CodeRabbit resolution — and reports exactly what's left before it's mergeable to main.
disable-model-invocation: true
context: fork
agent: general-purpose
---

You are auditing whether the current work is ready to merge to `main` per this repo's production release process. Do not fix anything — only investigate and report.

Task: $ARGUMENTS (a PR number/URL, branch name, or blank to use the current branch/most recent PR)

## Steps

1. Read `docs/release/production-release-checklist.md` in full — it is the source of truth for what's required. Also skim `AGENTS.md`'s "Production PR workflow" section for the process this repo expects.
2. Determine the diff scope: `git fetch origin main && git diff origin/main...HEAD --stat` (or the equivalent for the named branch).
3. Check whether the diff touches `supabase/migrations/*.sql`. If so, note explicitly that a production `supabase db push --linked --dry-run` is required before merge, and that `migration_apply`, `db_lint`, and `rls_rpc_security_tests` must be green — these are easy to forget since they don't run on every push.
4. If a PR exists for this branch, use the GitHub MCP tools (search for them via ToolSearch if not already loaded — `pull_request_read`, `actions_list`/`actions_get`, review-related tools) to fetch:
   - CI status for all 3 workflows: `tests.yml` (11 jobs — lint, typecheck, governance, test_critical, test_run, build, e2e_smoke, migration_ordering, migration_apply, db_lint, rls_rpc_security_tests), `codeql.yml`, `security.yml` (dependency_review, sbom)
   - CodeRabbit review status and any unresolved inline comments
   - Mergeable/merge-conflict state
5. If no PR exists yet, run the local validation checklist instead and report pass/fail per command:
   ```bash
   npm run lint
   npm run typecheck
   npm run governance
   npm run test:critical
   npm run test:run
   npm run build
   npm run budget:bundle
   ```
6. Cross-reference every item in `production-release-checklist.md` against what you found and mark each one.

## Output

A checklist-style report, one line per required item: ✅ / ❌ / ⏳ (pending, e.g. CI still running), with the specific failing job or unresolved comment named — not a vague "some checks failed." Where something is broken, give a one-line diagnosis, not a fix (point to `/ci-fix` for that). End with a single verdict:

- **READY TO MERGE**
- **BLOCKED** — enumerate the specific blockers
- **NOT YET A PR** — if step 4 didn't apply, list what local validation still needs to run

Do not merge, push, resolve threads, or open a PR yourself. This is a report only.
