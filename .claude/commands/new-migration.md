---
description: Scaffold a new Supabase migration with correct naming/ordering, RLS policies, and matching pgTAP coverage — this repo gates all three in CI.
---

Create a new migration for: $ARGUMENTS

1. **Pick the timestamp**: run `ls supabase/migrations | tail -5` to find the latest existing timestamp, then use a later 14-digit UTC timestamp (`YYYYMMDDHHMMSS`). `scripts/ci/check-supabase-migrations.mjs` fails the build on duplicate timestamps or out-of-lexicographic-order filenames — never reuse or backdate one.
2. **Create the file**: `supabase/migrations/<timestamp>_<slug>.sql` (slug: lowercase, `snake_case`, no leading digit-only segment).
3. **Write the schema change**:
   - New tables need RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and explicit policies — this codebase does not ship tables without RLS.
   - If you add a `SECURITY DEFINER` function and grant `EXECUTE` to `anon` or `PUBLIC`, know that `governance:sql-grants` (`scripts/governance/security-definer-grant-baseline.json`) will fail CI unless that grant is intentionally allowlisted. Prefer granting to `authenticated`/`service_role` instead; only grant to `anon`/`PUBLIC` if the function is meant to be publicly callable and you can justify it.
   - Follow existing patterns for indexes on new foreign keys and updated_at triggers if adjacent tables have them.
4. **Add authorization test coverage** if the change touches RLS or a security-relevant RPC: add or extend a pgTAP file under `supabase/tests/database/` (see existing files there for the plan/test style) — this is what the CI `rls_rpc_security_tests` job runs.
5. **Verify locally** before considering this done:
   ```bash
   npm run ci:db:migrations   # filename/ordering check
   supabase db reset --local  # applies all migrations against an ephemeral local DB
   supabase db lint --local --fail-on error --schema public,auth
   supabase test db supabase/tests/database
   ```
6. **Never manually edit** `src/integrations/supabase/types.ts` — it's regenerated from the schema after the migration is applied.
7. If the change affects existing `job_assignments`/`tour_assignments`/`timesheets` cascade behavior or the staffing campaign state machine, call that out explicitly — those are load-bearing invariants elsewhere in the app.

Report which of steps 3–5 you completed and which are blocked by the lack of a local Supabase instance, if any.
