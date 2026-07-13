# Production release checklist

Use this checklist for production-bound PRs targeting `main`.

## Before merge

- [ ] The full diff has been deliberately reviewed by the maintainer in the GitHub PR UI (solo project: you are the reviewer of record — read the diff there, not just in your editor).
- [ ] High-risk PRs (Supabase migrations, RLS policies, grants, or RPC/SQL functions — or timesheet/rates/payroll logic) get compensating scrutiny instead of extra approvers: CodeRabbit review complete with every comment resolved, plus a second deliberate pass over the diff after time away from it. Database-touching PRs additionally need pgTAP coverage (or documented manual verification) and the production dry-run below — a money-only PR with no schema/RLS/RPC change needs neither.
- [ ] All required checks are passing:
  - [ ] `npm run lint`
  - [ ] `npm run typecheck`
  - [ ] `Governance gates`
  - [ ] `npm run test:critical`
  - [ ] `npm run test:run`
  - [ ] `npm run build`
  - [ ] `npm run test:e2e (smoke)`
  - [ ] `Supabase migration ordering`
  - [ ] `Supabase migration apply`
  - [ ] `Supabase db lint`
  - [ ] `RLS/RPC security tests`
  - [ ] `CodeQL analysis`
  - [ ] `Dependency review`
  - [ ] `SBOM generation`
- [ ] CodeRabbit and inline review comments are resolved — no deferral; a comment that doesn't warrant a code change gets a written reason and the thread is resolved, not left open.
- [ ] The PR description includes test evidence and rollback steps.
- [ ] Release artifacts are retained by CI:
  - [ ] Build artifact from `npm run build`
  - [ ] CycloneDX SBOM artifact

## Database changes

If the PR includes Supabase migrations:

- [ ] Run `supabase db push --linked --dry-run` against production.
- [ ] Review the planned SQL.
- [ ] Apply pending migrations to the linked production project.
- [ ] Run a second `supabase db push --linked --dry-run` and confirm the remote database is up to date.
- [ ] Confirm any RLS/RPC behavior changes have pgTAP coverage or documented manual verification.

If the PR has no database migration, no production Supabase push is required.

## Deployment verification

After merge to `main`:

- [ ] Confirm Cloudflare production deployment succeeded.
- [ ] Open `https://sector-pro.work`.
- [ ] Verify sign-in and role-based routing.
- [ ] Verify a management route and a technician route.
- [ ] Verify one Supabase read path and one mutation path relevant to the change.
- [ ] Check browser console for CSP report-only violations caused by the change.
- [ ] Confirm no new critical errors in Supabase function logs for touched functions.

## Rollback

Code-only rollback:

1. Revert the merge commit or deploy the previous known-good commit.
2. Confirm Cloudflare redeploys the rollback commit.
3. Repeat deployment verification.

Database rollback:

1. Prefer forward-fix migrations for production data changes.
2. If a destructive rollback is unavoidable, stop and get explicit approval for the rollback SQL.
3. Back up affected tables before running rollback SQL.
4. Run post-rollback verification against the affected feature path.

Security-control rollback:

1. Do not disable branch protection, secret scanning, push protection, CodeQL, or required checks for convenience.
2. If a required check is broken by infrastructure failure, document the incident and restore the control immediately after the emergency release.
