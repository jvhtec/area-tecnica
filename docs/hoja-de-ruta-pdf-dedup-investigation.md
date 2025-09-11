# Hoja de Ruta PDF – Duplication Investigation & Remediation Plan

This document captures concrete duplication issues found in the Hoja de Ruta PDF generation and proposes precise fixes with code references. It complements the broader consistency plan (docs/hoja-de-ruta-pdf-consistency-plan.md).

## Summary of Confirmed Duplications

1) Viajes (Travel) section: duplicated “Tipo”
- Where
  - File: `src/utils/hoja-de-ruta/pdf/sections/travel.ts`
  - Method: `addTravelSection`
- Behavior
  - For each arrangement, it prints a header line: `Viaje: <transportation_type>` and also includes a row in the details table: `['Tipo', <transportation_type>]`.
- Impact
  - The transport type appears twice per arrangement (header + table).
- Proposed Fix
  - Remove the `['Tipo', …]` row from the `travelData` table OR keep the table row and change the arrangement header to a generic label (e.g., “Viaje”).
  - Recommendation: keep the header “Viaje: …” (visually stronger) and remove the `Tipo` table row to avoid duplication.

2) Rooming duplication: per-hotel rooming vs aggregated rooming section
- Where
  - Per-hotel rooming inside: `src/utils/hoja-de-ruta/pdf/sections/accommodation.ts` under label “Asignación de habitaciones”.
  - Aggregated rooming: `src/utils/hoja-de-ruta/pdf/sections/rooming.ts` (“Rooming”).
  - Engine calls both sections in sequence: `pdf-engine.ts`.
- Behavior
  - Room assignments are printed twice: once under each hotel, and again as an aggregated table.
- Proposed Fix
  - Add options to `PDFGenerationOptions`:
    - `includeAccommodationRooming?: boolean` (default: true)
    - `includeAggregatedRooming?: boolean` (default: false)
  - In `pdf-engine.ts`, render according to options (never both by default). If both are true, let `AccommodationSection` skip the per-hotel rooming table and display a note referencing the aggregated section.

3) Programa (Schedule) duplication risk
- Where
  - `src/utils/hoja-de-ruta/pdf/sections/schedule.ts` (combined “Programa y Requerimientos”).
  - `src/utils/hoja-de-ruta/pdf/sections/program.ts` (separate “Programa”).
  - Engine currently calls only `addProgramSection` if `hasProgramData`. `ScheduleSection` is not invoked.
- Behavior
  - No duplication in current engine flow, but `schedule.ts` is redundant and could cause confusion.
- Proposed Fix
  - Keep engine as-is (use `ProgramSection` + separate Power/Aux sections). Optionally remove unused `schedule.ts` in a cleanup PR to avoid future drift.

4) Travel map/QR duplication when pickup address equals venue
- Where
  - Venue map/QR: `src/utils/hoja-de-ruta/pdf/sections/venue.ts`.
  - Travel pickup map/QR per arrangement: `travel.ts`.
- Behavior
  - If `arrangement.pickup_address` equals `eventData.venue.address`, maps/QR are printed in both sections (visually similar output).
- Proposed Fix
  - Compare addresses and suppress duplicate map/QR in the travel section when the pickup address matches the venue address (or add a small note: “Igual que el venue”).
  - Implementation detail: Update `ContentSections.addTravelSection` and `TravelSection.addTravelSection` to accept `eventVenueAddress?: string` and perform a case-insensitive, trimmed equality check.

5) Logistics vs Travel overlap
- Where
  - Logistics table: `src/utils/hoja-de-ruta/pdf/sections/logistics.ts` (vehicles, drivers, license plates, times).
  - Travel arrangements: `travel.ts` (driver name, plate, company also appear).
- Behavior
  - If end-users enter both people-transport in Travel and vehicle-transport in Logistics with overlapping data (e.g., same driver/plate), both sections may show similar rows.
- Proposed Fix
  - Introduce options to `PDFGenerationOptions` to control inclusion:
    - `includeTravelArrangements?: boolean` (default: true)
    - `includeLogisticsTransport?: boolean` (default: true)
  - Optional deduplication heuristic: when both are enabled, skip travel entries whose `driver_name`+`plate_number` match logistics entries, or vice versa. Make this opt-in via `dedupeTransportAcrossSections?: boolean` (default: false) to avoid surprising users.

6) Contacts overlap (potential)
- Where
  - Contacts: `contacts.ts` prints general contacts.
  - Venue contact fields exist on `eventData.venueContact`, but currently not printed.
- Behavior
  - If venue contacts get added to the general contacts list upstream, they may appear twice (venue and contacts). Not currently duplicated by the PDF code directly, but worth guarding.
- Proposed Fix
  - (Optional) Accept a `dedupeContacts?: boolean` flag. When true, dedupe by normalized (role+phone/email+name) keys.

## Supporting Consistency Remediations

- Header/Footer consistency: see `docs/hoja-de-ruta-pdf-consistency-plan.md`. Header has been implemented via `HeaderService`; footer needs caching/retry to avoid missing logo.
- Media reliability: map/QR fetching should use a reusable `ImageService` with caching + retries and fallbacks; this also stabilizes layout when media fails.

## Implementation Plan (Concrete Steps)

1. Travel section – remove duplicated “Tipo” row
   - File: `src/utils/hoja-de-ruta/pdf/sections/travel.ts`
   - Change: Remove `['Tipo', …]` from `travelData` as the “Viaje: …” header already conveys transport type.

2. Travel/Venue dedupe for map/QR
   - Files: `src/utils/hoja-de-ruta/pdf/sections/travel.ts`, `src/utils/hoja-de-ruta/pdf/sections/content-sections.ts`
   - Change API:
     - `ContentSections.addTravelSection(travelArrangements, yPosition)` → `addTravelSection(travelArrangements, eventVenueAddress: string | undefined, yPosition)`
     - `TravelSection.addTravelSection(travelArrangements, eventVenueAddress?: string, yPosition)`
   - Logic: If `pickup_address` and `eventVenueAddress` match (case-insensitive, trimmed), skip map/QR in travel and render a small note.

3. Rooming duplication options
   - File: `src/utils/hoja-de-ruta/pdf/core/pdf-types.ts`
     - Add options: `includeAccommodationRooming?: boolean = true`, `includeAggregatedRooming?: boolean = false`.
   - File: `src/utils/hoja-de-ruta/pdf/pdf-engine.ts`
     - Conditionally call Accommodation/Rooming based on options; if both true, instruct AccommodationSection to omit its room table.
   - File: `src/utils/hoja-de-ruta/pdf/sections/accommodation.ts`
     - Accept a flag to suppress “Asignación de habitaciones” table rendering when in aggregated mode.

4. Logistics vs Travel overlap controls
   - File: `src/utils/hoja-de-ruta/pdf/core/pdf-types.ts`
     - Add: `includeTravelArrangements?: boolean = true`, `includeLogisticsTransport?: boolean = true`, `dedupeTransportAcrossSections?: boolean = false`.
   - File: `src/utils/hoja-de-ruta/pdf/pdf-engine.ts`
     - Respect inclusion flags; if `dedupeTransportAcrossSections` is enabled, implement a local pre-filter comparing `(driver_name, plate)` tuples.

5. Contacts de-dup (optional)
   - File: `src/utils/hoja-de-ruta/pdf/sections/contacts.ts`
     - If `dedupeContacts` option is true, dedupe rows by normalized keys (name+phone/email).

6. Remove the unused combined schedule section (optional cleanup)
   - File: `src/utils/hoja-de-ruta/pdf/sections/schedule.ts`
     - Either remove file or clearly comment it as deprecated to avoid future accidental use.

7. Testing (unit)
   - Travel: assert no `Tipo` duplication and that map/QR is skipped when pickup equals venue.
   - Engine: assert rendering toggles for rooming and transport sections.

## Acceptance Criteria

- Travel section no longer shows transport type twice.
- If pickup address equals venue address, only one map/QR appears (and a note if desired).
- Rooming information appears only once by default (per-hotel), with the ability to switch to aggregated.
- Logistics and Travel sections can be independently toggled, with optional de-duplication.
- No regressions in other sections; header/footer remain consistent.

## Code Pointers

- Travel: `src/utils/hoja-de-ruta/pdf/sections/travel.ts`
- Accommodation: `src/utils/hoja-de-ruta/pdf/sections/accommodation.ts`
- Rooming: `src/utils/hoja-de-ruta/pdf/sections/rooming.ts`
- Logistics: `src/utils/hoja-de-ruta/pdf/sections/logistics.ts`
- Engine: `src/utils/hoja-de-ruta/pdf/pdf-engine.ts`
- Types: `src/utils/hoja-de-ruta/pdf/core/pdf-types.ts`
- Content sections aggregator: `src/utils/hoja-de-ruta/pdf/sections/content-sections.ts`

