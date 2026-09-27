# Hoja de Ruta (Route Sheets)

> Event logistics document builder for venue, crew, travel, accommodation, schedule, restaurants, and controlled document publication.

## Overview

Hoja de Ruta is modeled as one versioned document. The React feature owns a canonical in-memory model, while PostgreSQL aggregate RPCs load and save the main row and its child collections as one authorization and transaction boundary.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/HojaDeRuta.tsx` |
| **Orchestration UI** | `src/components/hoja-de-ruta/ModernHojaDeRuta.tsx` |
| **Document model** | `src/features/hoja-de-ruta/model/HojaDocument.ts` |
| **Document controller** | `src/features/hoja-de-ruta/model/useHojaDocument.ts` (+ `useHojaCollectionEditors.ts`, `useHojaDocumentRealtime.ts`) |
| **Status controls** | `src/components/hoja-de-ruta/components/HojaStatusControls.tsx` |
| **State / initialization / save** | `src/features/hoja-de-ruta/model/useHojaDocumentState.ts`, `useHojaDocumentInitialization.ts`, `useHojaDocumentSave.ts` |
| **API boundary** | `src/features/hoja-de-ruta/api/hojaDocumentApi.ts`, `useHojaDocumentPersistence.ts` |
| **Database mapper** | `src/features/hoja-de-ruta/mappers/hojaDocumentMapper.ts`, `hojaJsonParsers.ts` |
| **Section registry** | `src/features/hoja-de-ruta/model/sectionDefinitions.ts`, `src/features/hoja-de-ruta/sections/sectionRegistry.tsx` |
| **Export controller** | `src/features/hoja-de-ruta/exports/useHojaDocumentExports.ts` |
| **Images** | `src/hooks/useHojaDeRutaImages.ts` |
| **PDF export** | `src/utils/hoja-de-ruta/pdf/` |
| **Excel export** | `src/utils/hojaDeRutaExport.ts` |
| **Database hardening** | `supabase/migrations/20260926103000_hoja_de_ruta_hardening.sql` |
| **Roadmap completion migration** | `supabase/migrations/20260926144902_complete_hoja_roadmap.sql` |
| **Integrity migration** | `supabase/migrations/20260927150000_hoja_de_ruta_integrity.sql` |
| **Database tests** | `supabase/tests/database/hoja_de_ruta_hardening.sql`, `hoja_de_ruta_integrity.sql` |

## Document Boundary

The canonical database API is:

| RPC | Purpose |
|-----|---------|
| `get_hoja_de_ruta(job_id)` | Returns the authorized aggregate projection for a job. |
| `save_hoja_de_ruta(job_id, expected_version, document, removed_image_ids)` | Creates or updates the complete document in one transaction while preserving legacy images unless explicitly removed. |
| `set_hoja_de_ruta_status(job_id, status, expected_version)` | Applies the forward-only document status transition when the editor still owns the current version. |
| `reopen_hoja_de_ruta(job_id, expected_version, reason)` | Admin/management only: returns an approved or final document to draft and logs the reason. |
| `publish_hoja_de_ruta_document(job_id, file_id, expected_version)` | Publishes an approved/final PDF and makes it crew-visible in the same transaction. |
| `purge_expired_hoja_dni(retention)` | Service role / daily cron: clears Hoja DNI copies 30 days after the job ends. |

All four client RPCs authorize before touching or revealing the document. The retired compatibility RPCs (`replace_hoja_de_ruta_all` and its helpers) are dropped, and the three-argument `save_hoja_de_ruta` core is no longer executable by clients.

The document spans the `hoja_de_ruta` main row and its contacts, staff, transport, travel arrangements, accommodations, room assignments, and image child rows. Child arrays use stable IDs and diff semantics: rows absent from a saved aggregate are removed, while retained IDs are updated.

## Workflow

```text
1. SELECT JOB      Load the authorized aggregate, or initialize from job data.
2. EDIT SECTIONS   Evento, Lugar, Clima, Contactos, Personal, Viajes,
                   Alojamiento, Logistica, Programa, and Restaurantes.
3. SAVE            Map the document to one aggregate payload and call
                   save_hoja_de_ruta with the last document_version.
4. REVIEW          Advance draft -> review -> approved -> final.
5. EXPORT          Download/preview a full or partial PDF, or export XLS.
6. PUBLISH         Explicitly upload and publish a full PDF only when the
                   document is approved or final.
```

The section registry is the source of truth for tabs, completion checks, export rows, and PDF part ownership. Add or remove a section there rather than maintaining separate lists in the page and export code.

## Concurrency And Status

- Every successful save increments `document_version`.
- **Every other writer does too.** Triggers on `hoja_de_ruta` and each child table bump `document_version` once per statement for any write that does not come from the aggregate/workflow RPCs (Tour Ops, crew removal, service scripts). An editor loaded before such a write gets a conflict instead of silently deleting it. The RPCs mark their own writes with the transaction-local `app.hoja_trusted_write` flag.
- `status`, `approved_*`, `review_requested_by`, `document_version` and `published_document_id` only change through the workflow RPCs; a direct update is rejected with `42501`.
- A stale `expected_version` is rejected with SQLSTATE `40001`. The conflict banner offers either a confirmed reload or a deliberate retry against the latest version; the retry never bypasses optimistic concurrency.
- Status transitions are forward only: `draft -> review -> approved -> final`. The person who sent a document to review cannot approve it (admins exempt).
- Any content change to an `approved` document (aggregate save or direct write) sends it back to `review`, clears the approval and records the editor as the new review requester. While a document is already in `review`, every further content edit transfers `review_requested_by` to the latest editor. The person who last changed the reviewed content cannot approve those changes themselves (admins exempt). Approval resets are logged.
- A final document is immutable for every writer, enforced by the table triggers rather than only the RPCs. Crew removal leaves a final document's staff list as issued. Referential actions (a deleted PDF or user, a deleted tour date) and the service role are not blocked.
- `reopen_hoja_de_ruta` is the only way back: admin/management, required reason, logged as `hoja.status.reopened`.
- PDF download and preview are local export actions. They do not publish a file.
- Publication is a separate explicit action and is accepted only for `approved` or `final` documents.

## Authorization

- `admin`, `management`, and `logistics` can read and manage the full aggregate.
- An assigned `technician` or `house_tech` can read the live job document through a restricted projection only while it is `approved` or `final`; drafts and documents in review return `null`. A previously published PDF can remain visible as the last issued document while newer edits are reviewed. Programa push reminders use only the currently approved/final live document.
- The restricted projection omits staff rows and sensitive identity data. Room assignments retain only the operationally necessary occupant name.
- Unassigned technicians cannot read the document.
- Anonymous callers cannot execute the aggregate, status, or publication RPCs.

Keep authorization in the RPCs and database policies. Do not replace aggregate reads with direct client table queries, which can change the projection and expose child-table details.

## Images And Exports

Image rows persist storage paths, not expiring signed URLs. Initialization hydrates paths to signed URLs for display; saves map them back to their stable storage representation.

Legacy `blob:` rows cannot be previewed. The venue section lists how many exist and lets the editor remove them on the next save.

Legacy `data:` rows can be migrated to the private `job-documents` bucket with `npm run hoja:migrate-images -- --apply` after the completion migration is deployed. The script is dry-run by default, validates MIME type and size, uploads to a deterministic path, and swaps the row through a compare-and-set RPC. A `blob:` URL is scoped to the browser session that created it and cannot be recovered server-side. Such rows are preserved during unrelated saves. Once an original file is recovered, name it `<image-uuid>.jpg` (or `.jpeg`, `.png`, `.webp`) and supply its directory with `--blob-dir <path>`; the same dry-run/apply workflow replaces that exact row.

`useHojaDocumentExports` builds PDF, print-preview, and XLS data from the current document and merges production claims into contacts without duplicating an existing staff/contact identity. Section exports use the same document model but never invoke publication. Only the explicit full-document publish action calls `publish_hoja_de_ruta_document`.

The general PDF and XLS exports exclude DNI, and the Hoja keeps its DNI copies only until 30 days after the job ends (`purge_expired_hoja_dni`, scheduled daily with pg_cron). The separate accreditation XLS includes DNI, is labeled as internal personal data, and requires an explicit confirmation before local download. It is never uploaded or published by the Hoja workflow.

## Editor Safety And Validation

- The editor validates required event/venue fields, contact formats, DNI/NIE formats, non-negative quantities, and travel/accommodation chronology before save, status changes, preview, publication, or export.
- Validation moves the editor to the first affected section and exposes field-level errors for required event data.
- Browser refresh, SPA navigation, job switching, dialog close, Escape, and overlay dismissal all guard unsaved changes.
- Staff rows persist their department, render in deterministic department groups (profile enum keys and Spanish free text merge into one Spanish-labelled group), and mask DNI until the user explicitly reveals it.
- Realtime version drift and stale saves surface the same conflict recovery controls. The listeners (`hoja_de_ruta`, `job_assignments`, `power_requirement_tables`, all in the `supabase_realtime` publication) go through the unified subscription manager.

## Integration Points

- **Jobs**: initialization can populate dates, location, assignments, power, and producer contacts.
- **Mapbox**: venue autocomplete, geocoding, maps, and coordinates.
- **Google Places**: restaurant search and details through the cached Edge Function.
- **Wikimedia**: venue/accommodation image suggestions through the cached Edge Function.
- **Weather**: forecast data for event dates.
- **Technician profiles**: staff rows may link to `technician_id`.

## Validation

For changes to this feature, run the focused client contracts and database authorization tests in addition to the normal project gates:

```bash
npm run test:critical
npm run test:e2e:hoja
npx supabase db reset --local --no-seed
npx supabase db lint --local --fail-on error --schema public,auth
npx supabase test db supabase/tests/database/hoja_de_ruta_hardening.sql
npx supabase test db supabase/tests/database/hoja_de_ruta_integrity.sql
```
