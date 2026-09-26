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
| **Authorization tests** | `supabase/tests/database/hoja_de_ruta_hardening.sql` |

## Document Boundary

The canonical database API is:

| RPC | Purpose |
|-----|---------|
| `get_hoja_de_ruta(job_id)` | Returns the authorized aggregate projection for a job. |
| `save_hoja_de_ruta(job_id, expected_version, document)` | Creates or updates the complete document in one transaction. |
| `set_hoja_de_ruta_status(job_id, status)` | Applies the forward-only document status transition. |
| `publish_hoja_de_ruta_document(job_id, file_id)` | Publishes an approved/final PDF to job participants. |

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
- A stale `expected_version` is rejected with SQLSTATE `40001`; the client must reload instead of overwriting newer work.
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

`useHojaDocumentExports` builds PDF, print-preview, and XLS data from the current document and merges production claims into contacts without duplicating an existing staff/contact identity. Section exports use the same document model but never invoke publication. Only the explicit full-document publish action calls `publish_hoja_de_ruta_document`.

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
npx supabase db reset --local --no-seed
npx supabase db lint --local --fail-on error --schema public,auth
npx supabase test db supabase/tests/database/hoja_de_ruta_hardening.sql
```
