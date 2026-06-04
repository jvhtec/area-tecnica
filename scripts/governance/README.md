# Governance Gates

These scripts enforce the first CI governance slice from the deeper maintenance audit.

- `npm run governance:source` blocks new source-boundary violations while allowing the current legacy baseline to shrink over time.
- `npm run governance:functions` requires new Edge Functions to use `createHttpHandler`, unless a reviewed exemption is added to the baseline.
- `npm run audit:deps` blocks new npm advisory IDs or increased severity counts without forcing an unrelated dependency migration.

The JSON baseline files are generated snapshots of existing debt on `main`. Do not refresh them as a routine fix for a failing PR. Prefer removing the new violation; update a baseline only when the PR intentionally accepts a new reviewed exception.
