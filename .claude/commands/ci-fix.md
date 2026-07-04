---
description: Diagnose and fix a failing CI check — lint/typecheck/build, any governance sub-gate, tests, migrations, or the security workflows. Paste the failing job name or log and let Claude route to the right fix.
disable-model-invocation: true
---

A CI check is failing: $ARGUMENTS

CI runs three workflows (see `docs/release/production-release-checklist.md` for the full list): `.github/workflows/tests.yml` (11 jobs), `codeql.yml`, `security.yml`. Identify which job failed from the pasted log/name, then use the matching path below. If the job isn't stated, run the local equivalents in order (lint → typecheck → governance → test_run → build) until one reproduces the failure.

## lint / typecheck / test_run / build
Standard: `npm run lint`, `npm run typecheck` (not bare `tsc`), `npm run test:run`, `npm run build`. Fix root causes; never `@ts-ignore` or skip a failing test to make it pass.

## governance (7 sub-gates chained by `npm run governance`)
Run the specific sub-gate to isolate the failure, then fix per gate:

- **`governance:source`** (`scripts/governance/check-source-boundaries.mjs`) — new code violates a source-boundary rule (e.g. a page importing the Supabase client directly, `new Date()` in scheduling code instead of the approved date utils, inline `ProtectedRoute allowedRoles` outside the route manifest). Fix the violation in your code. Only run `npm run governance:source -- --write-baseline` to accept a *reviewed, intentional* exception — never to silence a bug.
- **`governance:filesize`** (`scripts/governance/file-size-baseline.json`, threshold 800 lines) — a file crossed 800 lines (new file) or a baselined file grew past its recorded ceiling. Split the file; don't just regenerate the baseline to hide growth. `--write-baseline` is for accepted, reviewed increases only.
- **`governance:functions`** (`scripts/governance/edge-function-baseline.json`) — a new Edge Function doesn't use the `createHttpHandler` pattern from `supabase/functions/_shared/http.ts`. Wrap the handler in `Deno.serve(createHttpHandler(...))` (see `/new-edge-function`) rather than adding it to the legacy-manual baseline.
- **`governance:exposure`** (`scripts/governance/edge-function-exposure.json` vs `supabase/config.toml`) — a function is unclassified, or its declared `verifyJwt` doesn't match `[functions.<name>] verify_jwt` in `config.toml`. Add/fix the manifest entry (`class`, `verifyJwt`, `internalGuard` if `verifyJwt=false` or `class` is `public-token`/`service-only`) AND update `config.toml` together — they must agree.
- **`governance:sql-grants`** (`scripts/governance/security-definer-grant-baseline.json`) — a migration newly grants `EXECUTE` on a function to `anon`/`PUBLIC`. Prefer revoking the grant and granting to `authenticated`/`service_role` instead. Only add to the baseline (`-- --write-baseline`) if the anon exposure is genuinely reviewed and intended.
- **`governance:actions`** — a workflow's `uses:` isn't pinned to a full 40-char commit SHA. Resolve the tag to its commit SHA and pin it (`uses: owner/action@<40-char-sha> # vX.Y.Z` comment for readability).
- **`audit:deps`** (`scripts/governance/check-dependency-audit.mjs`) — a new dependency vulnerability isn't in the reviewed baseline. Upgrade the vulnerable package if a fix exists; only baseline an accepted risk with justification.

## migration_ordering / db_lint / migration_apply / rls_rpc_security_tests
- **Filename/ordering** (`scripts/ci/check-supabase-migrations.mjs`): migrations must match `<14-digit-timestamp>_<slug>.sql`, be non-empty, have a unique timestamp, and sort lexicographically. Rename the file with a later timestamp than the most recent existing migration.
- **`db_lint`**: run `supabase db lint --local --fail-on error --schema public,auth` locally and fix the reported schema issue.
- **`migration_apply`**: run `supabase db reset --local` locally to reproduce; usually a SQL syntax/ordering error or a missing dependency between migrations.
- **`rls_rpc_security_tests`**: run `supabase test db supabase/tests/database` locally; a pgTAP test in that directory is failing — fix the RLS policy/RPC behavior, or the test if the intended behavior changed (see `/new-migration` for adding coverage on new tables).

## codeql / dependency_review / sbom (security.yml, codeql.yml)
These aren't locally reproducible the same way — read the GitHub check output for the specific CodeQL alert or advisory ID, fix the flagged code pattern or bump the flagged dependency. Don't suppress with an inline CodeQL ignore comment unless the finding is a confirmed false positive, and say so explicitly when you do.

## After any fix
Re-run the specific local command that maps to the failing job to confirm before declaring it fixed — don't assume from reading the diff.
