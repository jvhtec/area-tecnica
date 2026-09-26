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
| **Document controller** | `src/features/hoja-de-ruta/model/useHojaDocument.ts` |
| **State / initialization / save** | `src/features/hoja-de-ruta/model/useHojaDocumentState.ts`, `useHojaDocumentInitialization.ts`, `useHojaDocumentSave.ts` |
| **API boundary** | `src/features/hoja-de-ruta/api/hojaDocumentApi.ts`, `useHojaDocumentPersistence.ts` |
| **Database mapper** | `src/features/hoja-de-ruta/mappers/hojaDocumentMapper.ts` |
| **Section registry** | `src/features/hoja-de-ruta/model/sectionDefinitions.ts`, `src/features/hoja-de-ruta/sections/sectionRegistry.tsx` |
| **Export controller** | `src/features/hoja-de-ruta/exports/useHojaDocumentExports.ts` |
| **Images** | `src/hooks/useHojaDeRutaImages.ts` |
| **PDF export** | `src/utils/hoja-de-ruta/pdf/` |
| **Excel export** | `src/utils/hojaDeRutaExport.ts` |
| **Database hardening** | `supabase/migrations/20260926103000_hoja_de_ruta_hardening.sql` |
| **Roadmap completion migration** | `supabase/migrations/20260926144902_complete_hoja_roadmap.sql` |
| **Authorization tests** | `supabase/tests/database/hoja_de_ruta_hardening.sql` |

## Document Boundary

The canonical database API is:

| RPC | Purpose |
|-----|---------|
| `get_hoja_de_ruta(job_id)` | Returns the authorized aggregate projection for a job. |
| `save_hoja_de_ruta(job_id, expected_version, document, removed_image_ids)` | Creates or updates the complete document in one transaction while preserving legacy images unless explicitly removed. |
| `set_hoja_de_ruta_status(job_id, status, expected_version)` | Applies the forward-only document status transition when the editor still owns the current version. |
| `publish_hoja_de_ruta_document(job_id, file_id, expected_version)` | Publishes an approved/final PDF to job participants when its source version is still current. |

`replace_hoja_de_ruta_all` remains only as a hardened compatibility RPC for older deployed clients. New code must use `save_hoja_de_ruta`.

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
- A stale `expected_version` is rejected with SQLSTATE `40001`. The conflict banner offers either a confirmed reload or a deliberate retry against the latest version; the retry never bypasses optimistic concurrency.
- Status transitions are forward only: `draft -> review -> approved -> final`.
- A final document is immutable. Both UI controls and the database RPC enforce the lock.
- PDF download and preview are local export actions. They do not publish a file.
- Publication is a separate explicit action and is accepted only for `approved` or `final` documents.

## Authorization

- `admin`, `management`, and `logistics` can read and manage the full aggregate.
- An assigned `technician` or `house_tech` can read the job document through a restricted projection.
- The restricted projection omits staff rows and sensitive identity data. Room assignments retain only the operationally necessary occupant name.
- Unassigned technicians cannot read the document.
- Anonymous callers cannot execute the aggregate, status, or publication RPCs.

Keep authorization in the RPCs and database policies. Do not replace aggregate reads with direct client table queries, which can change the projection and expose child-table details.

## Images And Exports

Image rows persist storage paths, not expiring signed URLs. Initialization hydrates paths to signed URLs for display; saves map them back to their stable storage representation.

Legacy `data:` rows can be migrated to the private `job-documents` bucket with `npm run hoja:migrate-images -- --apply` after the completion migration is deployed. The script is dry-run by default, validates MIME type and size, uploads to a deterministic path, and swaps the row through a compare-and-set RPC. A `blob:` URL is scoped to the browser session that created it and cannot be recovered server-side. Such rows are preserved during unrelated saves. Once an original file is recovered, name it `<image-uuid>.jpg` (or `.jpeg`, `.png`, `.webp`) and supply its directory with `--blob-dir <path>`; the same dry-run/apply workflow replaces that exact row.

`useHojaDocumentExports` builds PDF, print-preview, and XLS data from the current document and merges production claims into contacts without duplicating an existing staff/contact identity. Section exports use the same document model but never invoke publication. Only the explicit full-document publish action calls `publish_hoja_de_ruta_document`.

The general PDF and XLS exports exclude DNI. The separate accreditation XLS includes DNI, is labeled as internal personal data, and requires an explicit confirmation before local download. It is never uploaded or published by the Hoja workflow.

## Editor Safety And Validation

- The editor validates required event/venue fields, contact formats, DNI/NIE formats, non-negative quantities, and travel/accommodation chronology before save, status changes, preview, publication, or export.
- Validation moves the editor to the first affected section and exposes field-level errors for required event data.
- Browser refresh, SPA navigation, job switching, dialog close, Escape, and overlay dismissal all guard unsaved changes.
- Staff rows persist their department, render in deterministic department groups, and mask DNI until the user explicitly reveals it.
- Realtime version drift and stale saves surface the same conflict recovery controls.

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
```
