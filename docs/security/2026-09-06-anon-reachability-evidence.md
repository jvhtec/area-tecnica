# Anonymous reachability — evidence and reproduction (2026-09-06)

Supporting evidence for **SEC-17** and **SEC-18** in
[`docs/CODEBASE_AUDIT_2026-09-04.md`](../CODEBASE_AUDIT_2026-09-04.md). Everything here is
reproducible read-only, so the findings can be re-checked before and after remediation without
taking the audit's word for anything.

Two things to know before running any of it:

- The `anon` key is **not a secret**. It ships in the client bundle and is meant to be public; RLS
  is what protects the data behind it. That is the whole point of these findings — the checks below
  need no credential a visitor to the site does not already have.
- Every command here is a read, except the one explicitly marked as rolled back. Nothing in this
  document modifies production.

---

## SEC-17 — private Storage buckets readable by `anon`

### 1. Which buckets are private, and which does `anon` read anyway

```sql
-- What exists, and what each bucket claims about itself.
select b.id, b.public, count(o.id) as objects
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public
order by objects desc;

-- What `anon` can actually see. The difference between this and the above is the finding.
begin;
  set local role anon;
  select bucket_id, count(*) as anon_readable
  from storage.objects
  group by bucket_id
  order by anon_readable desc;
rollback;
```

Result on 2026-09-06: seven buckets with `public = false` returned rows — `memoria-tecnica` (596),
`festival_artist_files` (519), `tour-documents` (89), `festival-logos` (36), `tour-logos` (21),
`lights-memoria-tecnica` (10), `company-assets` (2). **1,273 objects.**

### 2. The policies that permit it

```sql
select policyname, roles::text, cmd, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and cmd in ('SELECT', 'ALL')
  and roles::text like '%public%'
order by policyname;
```

The exposing policies are the ones whose `qual` is a bare `bucket_id = '...'` with no `auth.uid()`
or `auth.role()` term. Compare them against the neighbours that get it right — for example
`Authenticated users can view job documents` carries `auth.role() = 'authenticated'`, which is why
`job-documents` does **not** appear in the anon-readable set.

`roles = {public}` is the Postgres `PUBLIC` role, meaning *every* role including `anon` — not "this
bucket is public". Reviewing these policies without that distinction in mind is how the finding
survived.

### 3. End-to-end proof over HTTP

```bash
KEY="<the project's public anon key>"
U="https://<project-ref>.supabase.co"

# Enumerate a private bucket, unauthenticated.
curl -s -X POST "$U/storage/v1/object/list/festival_artist_files" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"prefix":"","limit":5}'

# Download the first 64 bytes of one of the objects it returned.
curl -s -o /dev/null -w "http=%{http_code} type=%{content_type}\n" -r 0-64 \
  "$U/storage/v1/object/festival_artist_files/<folder-uuid>/<object-uuid>.pdf" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Observed: list → `HTTP 200` with object names; download → `HTTP 206`,
`content-type: application/pdf`. Because the list call works, the UUID paths do not need guessing.

**After remediation both calls should return 403.**

### 4. The unauthenticated write

```sql
select policyname, roles::text, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
  and roles::text like '%public%';
```

`Enable insert access for all users` has `WITH CHECK (bucket_id = 'lights-memoria-tecnica')` and no
auth term. Confirmed by executing the insert as `anon` **inside a rolled-back transaction** — it
succeeded and returned the row, so RLS permits it; nothing was written:

```sql
begin;
  set local role anon;
  insert into storage.objects (bucket_id, name, owner)
  values ('lights-memoria-tecnica', '__probe.txt', null)
  returning bucket_id, name;
rollback;   -- never commit this
```

---

## SEC-18 — unguarded `SECURITY DEFINER` functions callable by `anon`

### 1. What `anon` can actually call

```sql
-- Non-trigger functions only: PostgREST does not expose functions returning `trigger`,
-- so including them (as the Supabase advisor does) overstates the surface.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)             as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and pg_get_function_result(p.oid) <> 'trigger'
order by p.proname;
```

75 `SECURITY DEFINER` functions carry the `anon` EXECUTE grant; **47** are non-trigger and
therefore genuinely callable over `/rest/v1/rpc/`.

### 2. Which of them guard themselves

`SECURITY DEFINER` bypasses RLS, so the function body is the only remaining control. A first pass
that separates the two groups:

```sql
select p.proname,
       pg_get_functiondef(p.oid) ~* 'not\s+authorized|raise\s+exception|is_admin|current_user_role|auth\.uid\(\)\s+is\s+null'
         as looks_guarded
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and pg_get_function_result(p.oid) <> 'trigger'
order by looks_guarded, p.proname;
```

Treat this as a filter, not a verdict — read the bodies of anything it flags. Doing so found five
functions whose bodies are a bare `UPDATE` / `DELETE` / `SELECT` with no authorization at all:
`mark_timesheet_auto_reminder_sent`, `update_tour_dates`, `evaluate_user_achievements`,
`evaluate_daily_achievements`, `prune_place_api_cache`, plus `extras_total_for_job_tech` (reads pay
extras) and `find_policies_to_optimize` (returns policy names).

Read-only confirmation over HTTP, unauthenticated:

```bash
curl -s -X POST "$U/rest/v1/rpc/extras_total_for_job_tech" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"_job_id":"00000000-0000-0000-0000-000000000000","_technician_id":"00000000-0000-0000-0000-000000000000"}'
# → 200 {"items": [], "total_eur": 0}   — executes; returns no authorization error
```

Contrast with a correctly guarded one, which is what the fixed state looks like:

```bash
curl -s -X POST "$U/rest/v1/rpc/rank_staffing_candidates" ... 
# → 400 {"code":"P0001","message":"Not authorized to rank candidates"}
```

The mutating functions were **not** invoked. Their exposure is established from the grant plus the
body, which together are sufficient: a `SECURITY DEFINER` function whose body contains no
authorization predicate has none.

### 3. The gate/production divergence

```sql
select 'public.' || p.proname || '/' || p.pronargs
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;
```

Diff that against `allowedAnonExecutable` in
`scripts/governance/security-definer-grant-baseline.json`:

| | Count |
| --- | ---: |
| Live on production | 75 |
| Baseline (migration replay) | 82 |
| **Live but not baselined** | **37** |
| **Baselined but not live** | **44** |

All five unguarded functions fall in the live-but-not-baselined set. The gate is green because it
replays migrations; production was never consulted.

### 4. The latent re-introduction path

```sql
select pg_get_userbyid(defaclrole) as grantor,
       nspname as schema, defaclobjtype as objtype, defaclacl::text as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1, 2, 3;
```

The `postgres`-granted defaults for `public` functions were correctly tightened to
`{postgres=X, service_role=X}`. The **`supabase_admin`**-granted defaults were not: `public`
functions default to `{anon=X, authenticated=X, ...}` and `public` tables to `anon=arwdDxt`.

Nothing in `public` is currently owned by `supabase_admin`, so this is latent rather than active.
It matters because objects created through the Supabase dashboard can be created as that role, and
would then be granted to `anon` with no migration recording it — which is the shape of the 37-entry
drift set above.

---

## What "fixed" looks like

Re-run and expect:

| Check | Now | After |
| --- | --- | --- |
| `anon` row count on `storage.objects` for `public = false` buckets | 1,273 | 0 |
| Unauthenticated `POST /storage/v1/object/list/<private bucket>` | 200 | 403 |
| Unauthenticated `GET /storage/v1/object/<private bucket>/<path>` | 206 | 403 |
| `anon` insert into `lights-memoria-tecnica` (rolled back) | permitted | denied |
| Unauthenticated `POST /rest/v1/rpc/extras_total_for_job_tech` | 200 | 401/403 |
| Live vs baselined `anon` EXECUTE grants | differ by 81 | identical, and the baseline is derived from production |
