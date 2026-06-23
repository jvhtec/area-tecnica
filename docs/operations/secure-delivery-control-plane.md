# Secure delivery control plane

This document defines the production-bound delivery controls for Area Tecnica.

## Branch protection and review policy

The `main` and `dev` branches must be protected by an active GitHub branch ruleset.

Required pull request controls:

- At least one independent approval before merge.
- CODEOWNER review for high-risk paths.
- Stale approvals dismissed after new commits.
- Review-thread resolution required.
- Strict required status checks.
- No force-pushes or branch deletion.

High-risk changes require two independent approvals before merge. GitHub branch rules can enforce the first approval and CODEOWNER review; the second high-risk approval is enforced through the PR checklist and release review process.

High-risk path classes:

- Database and Supabase runtime: `supabase/**`
- Auth, data access, realtime, global state, and security libraries: `src/integrations/**`, `src/hooks/**`, `src/lib/**`, `src/stores/**`
- CI/CD and governance: `.github/**`, `scripts/ci/**`, `scripts/governance/**`
- Dependency graph: `package.json`, `package-lock.json`
- Production security headers: `public/_headers`
- Operational policy/docs: `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/operations/**`, `docs/release/**`

## Required checks

The branch ruleset must require these status checks on production-bound PRs:

- `npm run lint`
- `npm run typecheck`
- `Governance gates`
- `npm run test:critical`
- `npm run test:run`
- `npm run build`
- `npm run test:e2e (smoke)`
- `Supabase migration ordering`
- `Supabase migration apply`
- `Supabase db lint`
- `RLS/RPC security tests`
- `CodeQL analysis`
- `Dependency review`
- `SBOM generation`

## Dependency policy

The repository now commits `package-lock.json`.

Use:

```bash
npm ci --legacy-peer-deps
```

for clean deterministic installs in CI and release verification.

Use:

```bash
npm install --legacy-peer-deps
```

only when intentionally updating the dependency graph, then commit both `package.json` and `package-lock.json`.

Do not migrate package managers or remove `--legacy-peer-deps` without an approved dependency migration plan.

## GitHub security settings

These repository settings must remain enabled:

- Secret scanning.
- Secret scanning push protection.
- Dependabot alerts.
- Dependabot security updates.
- Code scanning via CodeQL.
- GitHub Actions SHA pinning requirement.

Dependabot version updates are configured in `.github/dependabot.yml`.

## GitHub Actions policy

All external GitHub Actions must be pinned to a full 40-character commit SHA. The `Governance gates` job enforces this with:

```bash
npm run governance:actions
```

When updating an action, resolve the intended release tag to a commit SHA and keep the human-readable version in a trailing comment.

## Database CI policy

Database changes are validated by required jobs that:

- Check migration filename ordering and duplicate timestamps.
- Apply all migrations to an ephemeral local Supabase database.
- Run Supabase database lint with `--fail-on error`.
- Run pgTAP authorization tests under `supabase/tests/database`.

New RLS-sensitive migrations should add or update pgTAP tests in the same PR.

## Security headers policy

Cloudflare Pages serves production headers from `public/_headers`.

The CSP starts in `Content-Security-Policy-Report-Only` mode. Before switching CSP to enforcement:

1. Confirm report-only violations for critical routes.
2. Add required source allowlists deliberately.
3. Verify auth, dashboard, maps, PDF, feedback screenshot, and public staffing response routes.
4. Roll out enforcement in a dedicated PR.
