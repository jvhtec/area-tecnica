# Replaying and comparing the application schema

DB-06 requires actual Postgres catalogs, not a static count of CREATE POLICY statements. The migration-apply CI job now exports a versioned `schema-catalog.json` artifact after replaying the complete migration chain. Production is never contacted by pull-request CI.

The read-only query in `scripts/ci/schema-catalog.sql` records policies, relation RLS flags, view fingerprints, function fingerprints/owners, and table/sequence/function/column grants under stable object identities. It excludes extension-owned relations and functions. It exports no application records or function bodies. `pg_get_functiondef` fingerprints include quoted search paths, unlike the old audit's regex. The comparator refuses empty/duplicate catalogs and different Postgres majors, and reports added, removed and changed objects individually.

To compare:

1. Download the `schema-catalog-<commit>` artifact from the migration-apply check for the reviewed commit.
2. Execute the same SQL through a trusted production connection, read-only. Save its `catalog` object as `production-schema-catalog.json`. With psql, use `psql -XqAt -v ON_ERROR_STOP=1 -f scripts/ci/schema-catalog.sql` and redirect the result to that file.
3. Run `node scripts/ci/compare-schema-catalog.mjs replayed/schema-catalog.json production-schema-catalog.json`. Exit 0 means the measured objects match; exit 1 includes every difference.
4. Inspect any changed definition by object identity before proposing a reconciliation migration. A formatting/owner/platform difference is evidence to investigate, not authorization to replace production objects.

An initial production export on 2026-09-05 succeeded on Postgres 15: 553 policies, 209 relations, 230 application functions, 17 column ACL entries and the corresponding relation/function ACLs. This supersedes the audit's stale 552-policy count. Comparison with the actual replay artifact is pending; matching counts alone will not close the finding.

The comparison does not test application row visibility or replace pgTAP. It does not claim to compare storage/auth schemas, extension internals, arbitrary application rows, or Edge Function deployment contents. Existing database authorization CI continues independently.
