# Governance Gates

These scripts enforce the first CI governance slice from the deeper maintenance audit.

- `npm run governance:source` blocks new source-boundary violations while allowing the current legacy baseline to shrink over time.
- `npm run governance:functions` requires new Edge Functions to use `createHttpHandler`, unless a reviewed exemption is added to the baseline.
- `npm run governance:exposure` (Phase 2) requires every Supabase Edge Function to be classified by exposure class in `edge-function-exposure.json` and fails when `supabase/config.toml` `verify_jwt` drifts from the reviewed manifest. Any function with `verifyJwt: false` must document an `internalGuard`.
- `npm run governance:sql-grants` (Phase 2) replays every migration in order and fails when a SECURITY DEFINER (or any) function is newly executable by `anon`/`PUBLIC` unless it is on the reviewed `security-definer-grant-baseline.json` allowlist. Regenerate after review with `npm run governance:sql-grants -- --write-baseline`.
- `npm run audit:deps` blocks new npm advisory IDs or increased severity counts without forcing an unrelated dependency migration.

The JSON baseline files are generated snapshots of existing debt on `main`. Do not refresh them as a routine fix for a failing PR. Prefer removing the new violation; update a baseline only when the PR intentionally accepts a new reviewed exception.
