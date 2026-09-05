# Governance Gates

These scripts enforce the first CI governance slice from the deeper maintenance audit.

- `npm run governance:source` blocks new source-boundary violations while allowing the current legacy baseline to shrink over time.
- `npm run governance:lint-warnings` enforces total, rule, file/rule and separate app/function domain ceilings. App reductions cannot mask function growth. Lint errors prevent both checking and baseline generation. Reductions remain allowed; regenerate only to ratchet down or accept a reviewed exception.
- `npm run governance:filesize` checks authored app and Edge Function code separately at 800 lines, with independent `file-size-baseline.json` and `function-file-size-baseline.json` ceilings. New oversized files or growth fail; 760–800-line files are reported before they cross the threshold. For an intentional function-only snapshot use `node scripts/governance/check-file-size-budget.mjs --functions --write-baseline`.
- `npm run test:critical` already chained enforced coverage before the September audit. Its protected set now additionally includes shared authentication, rate limits, signed hoja tokens, email HTML policy and Memoria context/output handling. The Memoria input tests alone did not execute the context wrapper; dedicated wrapper tests now cover its authorization, bounded body, upload fallback, signed output and failures. Thresholds are executable in `vitest.config.ts`, not documentation-only targets.
- `npm run governance:functions` requires new Edge Functions to use `createHttpHandler`, unless a reviewed exemption is added to the baseline.
- `npm run governance:exposure` (Phase 2) requires every Supabase Edge Function to be classified by exposure class in `edge-function-exposure.json`, fails when `supabase/config.toml` `verify_jwt` drifts from the reviewed manifest, and scans source for the runtime guard expected by each sensitive class. `public-token` and `service-only` functions must document an `internalGuard`; `privileged-role` functions must reference a recognizable role guard.
- `npm run governance:sql-grants` (Phase 2) replays every migration in order and fails when a SECURITY DEFINER (or any) function is newly executable by `anon`/`PUBLIC` unless it is on the reviewed `security-definer-grant-baseline.json` allowlist. Regenerate after review with `npm run governance:sql-grants -- --write-baseline`.
- `npm run governance:csp` requires an enforced Cloudflare CSP, rejects unsafe script execution, disables inline event handlers, and verifies the SHA-256 source for every inline public script.
- `npm run audit:deps` blocks new npm advisory IDs or increased severity counts without forcing an unrelated dependency migration.

The JSON baseline files are generated snapshots of existing debt on `main`. Do not refresh them as a routine fix for a failing PR. Prefer removing the new violation; update a baseline only when the PR intentionally accepts a new reviewed exception.
