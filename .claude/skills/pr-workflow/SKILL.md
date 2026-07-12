---
name: pr-workflow
description: The standard PR workflow for this repo — taking work from ready-on-a-branch to merged into main. Use whenever creating, updating, or shepherding a pull request. Defines what an assistant does on its own (prepare + shepherd), what stays human (the merge), which PRs count as high-risk, the CodeRabbit protocol, the quality bar, and the mistakes to avoid.
---

# Standard PR Workflow

## Sources of truth

This skill tells you how to *execute* the documented process; it does not replace it. If this file ever conflicts with the docs below, the docs win — and the conflict is a finding to report, not silently resolve:

- `CLAUDE.md` → "Git Workflow" (branching model: cut from `main`, PR into `main`, no dev branch)
- `.github/GIT_HYGIENE.md` (branch naming, rebase-before-PR, post-merge cleanup)
- `AGENTS.md` → "Production PR workflow" (local validation commands, CI/CodeRabbit loop)
- `docs/release/production-release-checklist.md` (the pre-merge gate list — every required check)

## Authority boundary — read this first

Your role is **prepare + shepherd**. You take a PR all the way to *mergeable* — CI green across all three workflows, every review comment addressed, rebased on `main` — and then you stop and report. Specifically:

**You do on your own:** branch, commit, push, open the PR, fix CI failures, respond to and resolve CodeRabbit/review threads, keep the branch rebased, re-run validation after every round of fixes.

**You never do:** merge the PR, approve it, run the production `supabase db push` steps, or perform post-merge deployment verification unless explicitly asked. The final merge is always human. (`AGENTS.md` step 8 describes merging — for Claude assistants, that step is the human's; your job ends at "verified mergeable, handed off.")

## The workflow

### 1. Preflight (before the PR exists)

- Branch from current remote `main` with a category prefix: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` (or `claude/...` when the harness assigns one). One task per branch — adjacent findings go in your report, not the diff.
- Rebase on `origin/main` before pushing.
- Run the local gates relevant to the diff. For broad or shared UI/data changes, run the full set from `AGENTS.md`: `lint`, `typecheck`, `governance`, `test:critical`, `test:run`, `build`, `budget:bundle`. Always `npm run typecheck` — never bare `tsc --noEmit`, which is looser than CI.
- UI changes: run `/i18n-check` on the changed files (Spanish-only UI is a live, recurring slip).
- Run `./scripts/check-staged-secrets.sh` before committing.

### 2. Open the PR

- Target `main`. Conventional-commit-style title (`feat: …`, `fix: …`).
- The description must include, per the release checklist: what changed and why, **test evidence** (which commands/checks you ran and their results — real output, not "tests pass"), and **rollback steps**.
- If the PR is high-risk (below), say so explicitly in the description, in the first line.

### 3. Classify: is it high-risk?

A PR is **high-risk** when it touches either of:

1. **Database:** anything under `supabase/migrations/`, or any RLS policy, grant, or RPC/SQL function change.
2. **Money:** timesheet calculation (`compute_timesheet_hours` and callers), rates/rate overrides, payroll/payout logic or notifications.

High-risk consequences you must surface in the PR description: it needs **two independent approvals** and CODEOWNER review; migrations additionally need pgTAP coverage (or documented manual verification) and a human-run production `supabase db push --linked --dry-run` before merge. You flag and prepare all of this; the production push itself is human.

Everything else (including plain UI work, edge-function tweaks without DB impact) follows the standard single-approval path.

### 4. Shepherd to mergeable

- Watch CI across **all three** workflows: `tests.yml` (11 jobs), `codeql.yml`, `security.yml`. When available, use `subscribe_pr_activity` and react to events — never poll with sleep loops.
- CI failure → diagnose and fix (`/ci-fix`), push, wait again. One round is not the job; the loop ends at green.
- **CodeRabbit protocol: address or answer every comment.** Fix what's valid; reply with a reasoned rebuttal to what isn't; resolve the thread either way. Nothing is left dangling for the human to triage. The same applies to human review comments — except where a comment is genuinely ambiguous or architecturally significant, in which case ask rather than guess.
- Keep the branch rebased on `main` while it waits; after a rebase, push with `--force-with-lease` (never bare `--force`).
- Re-run the relevant local gates after each round of fixes before pushing — don't use CI as your first test runner.

### 5. Hand off

When every required check is green, every thread resolved, and the branch is current with `main`, report: a short summary of the final state (checks, approvals still needed, high-risk steps outstanding such as the prod migration dry-run) and a clear "ready for your merge." Use `/release-readiness` for the exhaustive audit when the PR is production-bound.

After the human merges: branches auto-delete on GitHub; clean up any local branch/worktree if you created one.

## Quality bar

A PR meets the bar when a reviewer can approve it from the description alone and only reads the diff to confirm. Concretely:

- The diff contains exactly one task — nothing a reviewer would ask "why is this here?" about.
- Test evidence is verifiable: commands named, results stated, and for bug fixes, evidence the test fails without the fix.
- Rollback is stated and real (revert path for code; forward-fix stance for data).
- Zero unresolved review threads; every CodeRabbit resolution is either a commit or a written reason.
- All 14 required checks green (11 `tests.yml` jobs + CodeQL + dependency review + SBOM).

## Mistakes to avoid

Each of these has actually bitten this repo or is structurally likely to:

- **Merging, or implying you will.** Your verb is "ready to merge," never "merging."
- **Scope creep in the diff.** Drive-by refactors and bundled second fixes — the governance ratchets (file-size, source-boundary) will often bounce them anyway.
- **Validating with the wrong commands.** Bare `tsc` instead of `npm run typecheck`; `npm install` without `--legacy-peer-deps`; skipping `npm run governance` when the diff touches edge functions, migrations, or workflows.
- **English UI strings** slipping in via new components or Zod messages.
- **Hand-editing generated or historical files:** `src/integrations/supabase/types.ts`, anything in `archive/` or `src/legacy/`, existing migration files (new behavior = new migration).
- **Leaving CodeRabbit threads unresolved** because they seemed minor — "address or answer every comment" has no minor-comment exemption.
- **Stacking commits on a merged PR's branch.** Merged is finished; follow-up work restarts from `origin/main` on a fresh (or reset) branch.
- **Force-pushing without `--force-with-lease`**, or rebasing away commits a reviewer already commented on without saying so.
- **Treating CI as the test runner.** Push-and-pray wastes review cycles; run the gates locally first.

## Self-check before declaring a PR ready

1. Would the reviewer find anything in the diff that isn't the task?
2. Could someone reproduce my test evidence from the description alone?
3. If this is high-risk (DB or money), does the description say so, and are the extra gates (two approvals, pgTAP, prod dry-run) explicitly listed as outstanding?
4. Is every review thread either fixed-and-resolved or answered-and-resolved?
5. Is the branch current with `main`, and are all three workflows green *right now* — not "were green before my last push"?
