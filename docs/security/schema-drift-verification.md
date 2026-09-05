# Replaying and comparing the application schema

DB-06 requires actual Postgres catalogs, not a static count of CREATE POLICY statements. The migration-apply CI job now exports a versioned `schema-catalog.json` artifact after replaying the complete migration chain. Production is never contacted by pull-request CI.

The read-only query in `scripts/ci/schema-catalog.sql` records policies, relation RLS flags, view fingerprints, function fingerprints/owners, and table/sequence/function/column grants under stable object identities. It excludes extension-owned relations and functions. It exports no application records or function bodies. `pg_get_functiondef` fingerprints include quoted search paths, unlike the old audit's regex. The comparator refuses empty/duplicate catalogs and different Postgres majors, and reports added, removed and changed objects individually.

To compare:

1. Download the `schema-catalog-<commit>` artifact from the migration-apply check for the reviewed commit.
2. Execute the same SQL through a trusted production connection, read-only. Save its `catalog` object as `production-schema-catalog.json`. With psql, use `psql -XqAt -v ON_ERROR_STOP=1 -f scripts/ci/schema-catalog.sql` and redirect the result to that file.
3. Run `node scripts/ci/compare-schema-catalog.mjs replayed/schema-catalog.json production-schema-catalog.json`. Exit 0 means the measured objects match; exit 1 includes every difference.
4. Inspect any changed definition by object identity before proposing a reconciliation migration. A formatting/owner/platform difference is evidence to investigate, not authorization to replace production objects.

An initial production export on 2026-09-05 succeeded on Postgres 15: 553 policies, 209 relations, 230 application functions, 17 column ACL entries and the corresponding relation/function ACLs. This supersedes the audit's stale 552-policy count. Comparison against migration-apply run `33963900503` found **199 object differences, zero policy differences**:

- 195 relation ACLs: production removed client `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges (167 for both roles, 28 for authenticated only). CRUD grants were identical. The reconciliation preserves production's narrower access; it never restores these privileges.
- One view: production already uses `security_invoker=true` for technician published truck plans, with identical view body. The migration preserves that option on fresh installs.
- `set_job_created_by()` and its ACL were absent on production, as was the jobs trigger. The migration restores attribution without SECURITY DEFINER, without public RPC access, and without backfilling old jobs or overwriting explicit creators.
- The achievement-completion function differs only in whitespace/comments. The migration canonicalizes the definition with unchanged logic and pinned search path.

Noninternal trigger definitions/enabled flags and global/public-schema default ACLs are now also exported, so missing-trigger and future-object privilege drift are detected directly. Review found the historical schema-scoped function revoke did not remove PostgreSQL's global PUBLIC EXECUTE default. The new migration revokes that global default for application migrations owned by postgres; it leaves platform-owned defaults untouched. New-function/new-table fixtures guard defaults as well as existing ACLs. The pgTAP suite also exercises attribution with authenticated, explicit-creator and no-user cases. This is catalog coverage, not exhaustive row-policy coverage.

Production reconciliation and a new replay/live comparison remain release verification steps; the pre-reconciliation export must not be represented as a clean result. Apply only the reviewed new migration, never replay/reset production. If regression occurs, forward-fix the specific trigger/view behavior; do not restore broad client privileges.

The comparison does not test application row visibility or replace pgTAP. It does not claim to compare storage/auth schemas, extension internals, arbitrary application rows, or Edge Function deployment contents. Existing database authorization CI continues independently.
