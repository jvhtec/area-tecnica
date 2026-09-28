# Hoja de Ruta — Post-Roadmap Audit (2026-09-27)

> **Status: resolved in code.** Every finding below is fixed by
> `supabase/migrations/20260927150000_hoja_de_ruta_integrity.sql` and the
> accompanying client/edge changes; see [Resolution](#resolution). Two items
> need a human in production after merge: applying the migration and running
> the `data:` image migration script.

Re-audit of the Hoja de Ruta module after the roadmap closed with PRs #955, #957 and #958
(`docs/release/hoja-de-ruta-roadmap-completion.md`). Each claim in that completion report was
re-verified against the code at `main@5eaf466` and, read-only, against the production database.

## Verdict

The roadmap work holds. The aggregate RPC boundary, optimistic save, stable child IDs,
technician projection, DNI exclusion from general exports, grants and policy cleanup all behave
as documented, and the Hoja tests pass. The remaining problems are at the edges of that boundary:

1. **Several paths still write around the RPC boundary.** Some other writers bypass the
   version check and the `final` lock entirely.
2. **The realtime conflict detection never fires in production.** The table is not in the
   realtime publication.
3. **The production rollout is only partly done.** The migrations are applied, but the
   image migration and the staff-department backfill were never run.

## Verification snapshot

| Check | Result |
|---|---|
| Hoja unit/component tests (32 files) | 237 / 237 pass |
| ESLint on Hoja paths | 0 errors, 20 warnings (19 `no-explicit-any`, 1 `no-control-regex`) across 10 files |
| Production migrations `20260926103000`, `20260926144902` | Applied |
| Security advisor (Hoja-related) | Only expected items: 4 retired tables with RLS and no policy (intentional), and guarded `SECURITY DEFINER` RPCs executable by `authenticated` |
| Performance advisor (Hoja-related) | Duplicate-policy and init-plan findings are gone; one unused index remains |
| Dangling `published_document_id` pointers | 0 |
| Orphaned Hoja rows (no job) | 0 |

## Findings

Severity: **High** means data loss or a broken documented invariant. **Medium** means a
correctness or UX gap with a workaround. **Low** means hygiene.

### H1 — The `final` lock and document versioning only hold inside the RPCs

`save_hoja_de_ruta`, `set_hoja_de_ruta_status` and `publish_hoja_de_ruta_document` enforce
`final` immutability and `document_version`. Direct writes to the tables enforce neither. The
policies are `FOR ALL` for `can_manage_hoja`, and no trigger bumps the version or rejects writes
to a final document. These writers use that gap today:

- **Tour Ops** writes directly to `hoja_de_ruta.program_schedule_json`,
  `hoja_de_ruta_travel_arrangements`, `hoja_de_ruta_transport`, `hoja_de_ruta_staff`,
  `hoja_de_ruta_room_assignments` and `hoja_de_ruta_accommodations`
  (`src/features/tour-ops/tourSchedulingMutations.ts`).
- **Crew removal**: `remove_assignment_with_timesheets` deletes `hoja_de_ruta_staff` and
  `hoja_de_ruta_contacts` rows, including on final documents. Its fallback matches by first and
  last name, so it can also delete a different person who has the same name.
- **Any admin, management or logistics user** can update `status`, `document_version`,
  `approved_by` or `published_document_id` directly through PostgREST. That skips the state
  machine, for example turning a final document back into a draft.

**Consequence: silent lost updates.** `save_hoja_de_ruta` deletes every child row whose ID is
missing from the payload. So an editor opened before a Tour Ops change can save successfully,
because the version never moved, and wipe that change. The same applies to a technician removed
from staffing: the editor re-inserts them. The staffing-drift banner reduces this risk only for
staff.

The workflow doc (`docs/workflows/hoja-de-ruta.md`) says "A final document is immutable. Both UI
controls and the database RPC enforce the lock." That is only true for the RPC path.

**Fix:**
- Add a `BEFORE INSERT/UPDATE/DELETE` trigger on `hoja_de_ruta` and each child table. It should
  reject writes when the parent is `final`, and bump `hoja_de_ruta.document_version` on child
  writes, using a transaction-local GUC so the aggregate RPC bumps only once.
- Remove the direct `UPDATE` path to `status`, `approved_*`, `document_version` and
  `published_document_id`, either with a column-level revoke or with a trigger that allows those
  columns to change only inside the RPCs.
- Move Tour Ops onto a small version-aware RPC. Remove the name-match fallback in
  `remove_assignment_with_timesheets` (572 staff rows have no `technician_id`, so that fallback
  still matters today).

### H2 — The realtime conflict and power-drift listeners never fire in production

`useHojaDocument.ts` subscribes to `postgres_changes` on `hoja_de_ruta` (the "Cambios externos"
banner) and on `power_requirement_tables` (power drift). In production, **neither table is in the
`supabase_realtime` publication**; only `job_assignments` is. No migration adds them.

- A concurrent edit is discovered only when the user saves and gets a 40001 error. The RPC still
  protects the data, but the promised early warning ("Realtime version drift and stale saves
  surface the same conflict recovery controls") is dead code.
- Power drift is only checked once, when the editor is initialised.
- All three channels are raw `supabase.channel(...)` subscriptions. They bypass the unified
  subscription manager and multi-tab coordinator that CLAUDE.md requires for realtime features.

**Fix:** add both tables to the publication in a migration, or poll the version with
`refetchInterval` or on window focus. Then move the listeners onto
`unified-subscription-manager`.

### H3 — The production rollout is incomplete

These are the steps from the completion report, checked against the production database:

| Step | Expected | Production (2026-09-27) |
|---|---|---|
| 3–4 Apply migrations | Applied | ✅ Applied |
| 6–8 Migrate `data:` images | 0 `data:` rows | ❌ **16 `data:` rows** remain, 0 storage-path rows |
| 9 Recover `blob:` images | Manual | ❌ 57 `blob:` rows unchanged |
| Staff `department` persisted | Deterministic grouping | ❌ **1,950 / 1,950** staff rows have `department IS NULL`; there is no backfill, so grouping relies on the fallback until each Hoja is saved again |

Nothing has been saved since the rollout (latest `hoja_de_ruta.updated_at` is 2026-09-25), so no
Hoja has taken the new path yet.

**Fix:** run `npm run hoja:migrate-images` (dry run first, then `--apply`), and add a
department backfill from `profiles.department` joined on `technician_id`.

### M1 — The 57 legacy `blob:` image rows can never be removed from the UI

`hydratePersistedImages` drops `blob:` rows (`useHojaDeRutaImages.ts`). The editor never shows
them, so they can never go into `removedImageIds`. The completion report says rows are preserved
"unless the editor explicitly removes their IDs", but that path cannot be reached. The rows stay
forever unless someone recovers the originals.

**Fix:**
- If the originals won't be recovered, decide on and apply a one-off service-role cleanup.
- Otherwise, show an "imagen no recuperable" placeholder with a remove action.

### M2 — Approval does not track the content that was approved

- `save_hoja_de_ruta` blocks only `final`. An `approved` document can be edited freely and stays
  `approved`, still showing the original `approved_by` and `approved_at`. What gets published is
  therefore not what was approved.
- There is no reopen path. `final` is terminal, and a late change such as a new driver or a
  schedule shift can only be made through a direct table edit (see H1).
- One user can go `draft → review → approved` alone, so there is no second reviewer.

**Fix:** reset to `review` on any content save while the document is `approved`, and add a
management-only `final → draft` reopen that is logged in `activity_log`. Adoption so far: all 201
Hojas are `draft`, and 157 of them carry a legacy published pointer from before the workflow.

### M3 — Job deletion leaks Hoja storage objects

`background-job-deletion` removes storage objects from the bucket `job_documents` (underscore).
Hoja PDFs and images live in `job-documents` (hyphen). Both buckets exist, so the call succeeds
without removing anything. Hoja images (`hojas-de-ruta/<job>/images/*`) are not in
`job_documents` rows at all, so they are never collected. The function also still targets the
retired tables `hoja_de_ruta_rooms` and `hoja_de_ruta_travel`, and it swallows every error.

**Fix:** resolve the bucket per path (as `_shared/hojaAttachment.ts` already does), list and
remove the `hojas-de-ruta/<jobId>/` prefix, and drop the retired tables from the delete list.
Deleting the parent `hoja_de_ruta` row cascades to the child tables.

### M4 — DNI copies have no retention policy

`hoja_de_ruta_staff.dni` holds **1,855** DNI copies across 177 Hojas. **1,014** of them belong to
jobs that ended more than 90 days ago. They are copies of `profiles.dni`, readable by the
`logistics` role as well as admin and management, and never purged. The export-side privacy work
is solid. The at-rest copy is the remaining exposure.

**Fix:**
- Stop persisting DNI in the Hoja. Resolve it from `profiles` only when the accreditation export
  runs, through a guarded RPC.
- Or add a scheduled purge after the event ends plus N days.

### M5 — Legacy compatibility RPCs are still callable

`authenticated` can still execute `replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb)` and the
three-argument `save_hoja_de_ruta`. `replace_hoja_de_ruta_all` takes no expected version, so it
overwrites blindly. It also delete-and-reinserts transport, contacts and staff, which regenerates
child IDs, the opposite of the "stable child IDs" guarantee. No current frontend code calls
either one.

**Fix:** once cached clients have aged out (after one service-worker version cycle), revoke
`EXECUTE` from `authenticated` on both, then drop them.

### M6 — The version-aware wrappers check the version before checking authorization

The three-argument `set_hoja_de_ruta_status` and `publish_hoja_de_ruta_document` wrappers take
`SELECT … FOR UPDATE` on the Hoja row and compare versions before the core runs
`can_manage_hoja`. Any authenticated user can therefore probe whether a job has a Hoja and what
its version is, from the different errors: "No existe", "ha cambiado" or "permission denied".
They can also briefly take row locks. Impact is low, and so is the cost of the fix.

**Fix:** call `can_manage_hoja(p_job_id)` first in both wrappers, and in the four-argument save,
which reads legacy image rows before the core's check.

### L1 — Type erasure at the persistence boundary

`hojaDocumentApi.ts` uses `supabase as unknown as SupabaseClient`, which drops the generated
types for `get_hoja_de_ruta`, `save_hoja_de_ruta` and `set_hoja_de_ruta_status`, even though
`types.ts` includes them. `useHojaValidation` casts the whole document through `as unknown as`.
There are 11 `as unknown as` casts in Hoja and Tour Ops scheduling code. This is the pattern the
QLT-02 strict ratchet was meant to stop.

### L2 — Smaller items

- The `saveInProgress` value returned by `useHojaDocumentSave` is a ref read at render time, so it
  is always stale. It has no consumers; remove it.
- If a save fails after images were uploaded and the user then leaves, those uploads are orphaned.
  `pendingUploadPathsRef` is only cleaned on a forced re-hydration.
- `publishPdfToJobDocuments` inserts the `job_documents` row with `visible_to_tech: true` before
  the publish RPC confirms. If the tab dies between the two, a visible but unpublished document
  stays behind. There are none today (0 unpublished `visible_to_tech` Hoja documents, and 12
  unpublished Hoja documents in total).
- `hasStaffData` treats a staff row that has only a DNI as content. The PDF then renders an empty
  staff section.
- `get_hoja_de_ruta` uses the deprecated `auth.role()`, while `can_manage_hoja` was moved to
  `auth.jwt() ->> 'role'`.
- The technician projection returns draft content. Assigned technicians read work in progress,
  and the push `programaFeed` broadcasts `program_schedule_json` whatever the status. Decide
  whether crew-facing reads should require `approved` or `final`.
- One dry-hire job has a Hoja.
- There are 20 lint warnings in Hoja section components and PDF utilities.
- `useHojaDocument.ts` has 785 lines, the largest file in the module.

## Suggested next roadmap (priority order)

1. **Rollout completion (ops, no code):** run the image migration (H3) and backfill staff
   departments.
2. **Integrity triggers (H1):** a final lock and version bump on every Hoja table, column-level
   protection of the workflow fields, and a Tour Ops RPC.
3. **Realtime (H2):** a publication migration, then move the listeners to the unified
   subscription manager.
4. **Workflow semantics (M2):** send edits to approved documents back to review, plus a logged
   reopen.
5. **Storage and privacy hygiene (M3, M4, M1):** fix job-deletion cleanup, set a DNI retention
   policy, and decide what to do with the 57 `blob:` rows.
6. **Retire compatibility surface (M5, M6, L1):** revoke and drop the legacy RPCs, reorder the
   wrapper checks, and restore generated types.

## Method

- Code reviewed: `src/features/hoja-de-ruta/`, `src/components/hoja-de-ruta/`,
  `src/utils/hoja-de-ruta/`, `src/hooks/useHojaDeRutaImages.ts`, Tour Ops scheduling,
  job-card and production-WhatsApp consumers, `_shared/hojaAttachment.ts`,
  `push/programaFeed.ts`, `background-job-deletion`, and every Hoja migration including
  `20260926103000` and `20260926144902`.
- Production checks were read-only `SELECT` queries and the security and performance advisors.
  No data or schema was changed.

## Resolution

| Finding | Fix | Evidence |
|---|---|---|
| H1 | Parent and child guard triggers: the `final` lock applies to every top-level writer except the service role, and non-RPC writes bump `document_version` once per statement. Workflow columns can only change through the RPCs. `remove_assignment_with_timesheets` skips final Hojas and matches by `technician_id` only; the backfill links 160 legacy staff rows whose name matches exactly one assigned technician. | `hoja_de_ruta_integrity.sql` pgTAP (stale-editor conflict, Tour Ops multi-row bump, direct status/version update rejected, final lock on insert/update/delete, crew removal keeps namesakes and final lists) |
| H2 | `hoja_de_ruta` and `power_requirement_tables` added to `supabase_realtime`; the listeners moved to `useHojaDocumentRealtime` on the unified subscription manager. | publication assertion in pgTAP |
| H3 | Staff `technician_id`/`department` backfill in the migration (about 1,538 of 1,950 production rows get a department; the rest are manually typed names). The `data:` image migration stays an operator step (`npm run hoja:migrate-images`, see the completion report); the editor also re-uploads a `data:` image whenever that Hoja is saved. | migration backfill block |
| M1 | Legacy `blob:` rows are counted in the venue section with a "Quitarlas al guardar" action that sends their IDs as explicit removals. | `useHojaDeRutaImages.unavailableImageCount` |
| M2 | Saving approved content sends it back to `review` (logged as `edited_after_approval`) and records that editor as `review_requested_by`. Edits made while already in review transfer review ownership to the latest editor as well, so the person who last changed the reviewed content cannot approve it themselves (admins exempt). `reopen_hoja_de_ruta` offers an admin/management reopen with a required, logged reason; the UI is `HojaStatusControls`, now also on mobile. | pgTAP four-eyes, review-owner transfer, review reset and reopen tests |
| M3 | `background-job-deletion` resolves each path's bucket (`job-documents`, `job_documents`, `festival_artist_files`, `festival-logos`), removes the `hojas-de-ruta/<jobId>/` tree, and deletes only the Hoja parent (children cascade). | `_shared/jobDocumentStorage.ts` |
| M4 | `purge_expired_hoja_dni()` clears DNI copies 30 days after the job ends, scheduled daily by pg_cron. | pgTAP retention tests |
| M5 | `replace_hoja_de_ruta_all` and its three helpers are dropped; clients can no longer execute the three-argument save. | `hasnt_function` / privilege assertions |
| M6 | Status, publish and save wrappers, and `get_hoja_de_ruta`, authorize before locking or revealing anything. | pgTAP "authorizes before revealing" tests |
| L1 | The typed Supabase client is used at the Hoja API boundary with runtime guards (`isHojaAggregate`, `toHojaStatus`, `hojaJsonParsers`) and `toJsonValue`. The Hoja module has no `as unknown as` casts left. `logistics_events` generated types gained the six columns they were missing. | `hojaJsonParsers.test.ts`, `json.test.ts` |
| L2 | `saveInProgress` removed. Orphan uploads are cleaned on unmount. The publish upload is hidden until the RPC makes it crew-visible. `hasStaffData` ignores DNI-only rows. `get_hoja_de_ruta` reads the signed JWT role. The live crew projection and Programa pushes require the current Hoja to be approved/final; an older published PDF may remain visible while newer edits are reviewed. Dry-hire jobs cannot get a Hoja (the one existing row is left untouched). There are 0 lint warnings on Hoja paths, and `useHojaDocument.ts` is down from 785 to about 510 lines. | lint baseline, unit tests |
| Extra | Department grouping and exports mixed English enum keys (`sound`) with Spanish canonical keys, so ordering never matched and raw English labels were shown. Both now normalize to one key with a Spanish label. PDF tables no longer pass `undefined` cells. | `groupStaffByDepartment.test.ts` |

### Behaviour changes to announce

- Editing an approved Hoja returns it to review, and a different manager must approve it again.
- Assigned technicians no longer see draft or in-review live Hojas, even when an older PDF was already published; that issued PDF may remain visible while the edited aggregate is reviewed. Programa push reminders are sent only from approved/final content.
- DNI in Hoja staff rows is cleared 30 days after the job ends. Export accreditation lists before that.
