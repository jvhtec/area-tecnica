# Hoja de Ruta PDF – Consistency & Quality Plan

Goal: Align the Hoja de Ruta PDFs with the quality and consistency of the other PDFs (e.g., PesosTool), fixing header/footer consistency, reliable QR/map rendering, and eliminating duplicated or missing data, while preserving current functionality.

## Current State (Context)

- Header
  - Cover page has a bold red background with title, event, date, and (optional) job logo.
  - Section pages previously lacked a consistent header; now use a Pesos-style header bar (implemented via `HeaderService`).
- Footer
  - `FooterService` adds company logo to every page using public paths:
    - `/sector pro logo.png`, `/sector%20pro%20logo.png`, `/lovable-uploads/...`, `/sector-pro-logo.png`.
  - Fallback text `[LOGO MISSING]` appears if images fail to load.
- Maps/QR
  - Venue/Accommodation sections fetch maps from OpenStreetMap Static Map + Nominatim geocoding and add a Google Maps route QR (via `QRService`).
  - Network failures or CORS can cause inconsistent rendering.
- Sections
  - Accommodation shows room assignments per hotel and map/QR per address.
  - A separate Rooming section aggregates all rooms again (potential duplication).
- Implementation spread
  - Key files under `src/utils/hoja-de-ruta/pdf/` (engine, sections, services, core).
  - PesosTool PDFs (`src/utils/pdfExport.ts`) set a visual baseline for header style.

## Problems Observed

- Header/Footer
  - Not always uniform between cover vs. section pages; footer logo may fail to load on some pages.
- Media reliability
  - Map images and QR codes aren’t always added (network or provider issues) -> results in missing visuals.
- Data duplication / omissions
  - Rooming data appears both in Accommodation and Rooming sections.
  - Some fields are skipped due to strict validators or optional nulls.
- Visual consistency
  - Mixed image formats, inconsistent spacing/margins, and inconsistent fallback messaging.

## Plan – Phased Improvements

### Phase 1 — Consistent Header & Footer

- Header
  - Keep the cover page as-is.
  - Ensure all subsequent pages render a Pesos-style header via `HeaderService` (DONE for sections, verify all entry points).
  - Add `jobDate` normalization to `PDFEngine` (string → localized date) to avoid raw ISO strings.
- Footer
  - Strengthen `FooterService.loadSectorProLogo()` with:
    - Caching in-memory once per generation.
    - Retry logic with short backoff across the existing candidate paths.
    - Deterministic placement (same y, centered) with measured max width.
  - Add a tiny “Generated: DD/MM/YYYY” on the left or right margin for traceability (matches PesosTool style where applicable).

### Phase 2 — Media Reliability (Maps and QR)

- Image pipeline facade
  - Add `ImageService` with:
    - in-memory caching by URL/data-key (Map URL, QR text).
    - `fetchAsDataURL(url)` helper with `Accept` headers and error handling.
    - retries: up to 2 attempts with 250ms backoff.
- MapService
  - Use the new `ImageService` for static map fetch; include a tight timeout.
  - Accept alternate static providers via options/env for future resiliency.
  - If geocoding or static map fails, render a neutral placeholder box with label `[MAPA NO DISPONIBLE]` to preserve layout.
- QRService
  - Wrap QR generation in try/catch; render a neutral placeholder `[QR NO DISPONIBLE]` on errors.
- Deterministic layout
  - Reserve the same rectangle space for map + QR regardless of success/failure to avoid layout jumps.

### Phase 3 — Data De-duplication & Completeness

- Rooming duplication
  - Provide PDF options to choose rooming presentation:
    - `includeAccommodationRooming` (default true): Room assignments under each hotel.
    - `includeAggregatedRooming` (default false): The separate “Rooming” section.
  - If both are true, ensure Accommodation omits room table headers and references the aggregated section instead (no double tables).
- Validators
  - Relax/extend validators to include partially provided meaningful values (e.g., if venue name or address present, show row).
- Formatters
  - Normalize date/time formatting (ES locale) and phone formatting.
  - Ensure long strings wrap in tables (autoTable columnStyles with `cellWidth: 'wrap', overflow: 'linebreak'`).

### Phase 4 — Visual Consistency

- Typography/colors
  - Centralize fonts, sizes, and colors in a `theme` object; use consistent red `[125,1,1]` and gray palette.
- Spacing/margins
  - Define standard margins/top offsets for cover, headers, and section content.
  - Ensure all tables use consistent `styles`, `headStyles`, and alternating row colors.
- Images
  - Standardize image formats (prefer PNG for logos/QR; JPEG for maps) and sizes.

### Phase 5 — Options & Backward Compatibility

- Extend `PDFGenerationOptions` with:
  - `jobDate?: string;`
  - `includeAccommodationRooming?: boolean;`
  - `includeAggregatedRooming?: boolean;`
  - `preferStaticMapProvider?: 'osm' | 'google' | 'none';` (for future)
- Maintain default behavior to avoid breaking callers; migrate ModernHojaDeRuta to pass explicit flags if needed.

### Phase 6 — Testing & Diagnostics

- Unit tests (Vitest)
  - `FooterService` (logo path fallback & placeholder).
  - `MapService` with mocked fetch (success/failure paths, placeholder rendering path returns a sentinel string or flag).
  - `QRService` error handling.
  - `HeaderService` simple render call (no exceptions, stable API).
- Snapshot tests (optional)
  - Validate that calling sections renders without throwing and measures expected y-advances when images fail.
- Logging
  - Use a small logger to downgrade error noise in production; surface warnings for media failures once per section.

## Tasks – Concrete Steps

1. Add `ImageService` with caching + retries (`src/utils/hoja-de-ruta/pdf/services/image-service.ts`).
2. Update `FooterService` to cache logo and retry across paths; add create-date text.
3. Enhance `MapService` and `QRService` to use `ImageService` and consistent placeholder rendering.
4. Add PDF options (`includeAccommodationRooming`, `includeAggregatedRooming`) to `PDFGenerationOptions` and propagate usage in:
   - `pdf-engine.ts`: conditionally render accommodation rooming vs. aggregated rooming.
   - `accommodation.ts` & `rooming.ts`: respect options to avoid duplicate output.
5. Normalize date string for header (`jobDate`) inside `PDFEngine` if provided.
6. Centralize theme constants (colors/sizes) for consistent look.
7. Add unit tests for services and critical paths (no regressions on failures).
8. Wire ModernHojaDeRuta to pass explicit options (e.g., include accommodation rooming = true, aggregated = false).

## Acceptance Criteria

- Every PDF page (post-cover) has a consistent header with job name and date.
- Footer company logo appears on all pages; if unavailable, a clear placeholder appears; created date is present.
- Maps and QR codes either render correctly or show a consistent placeholder without breaking layout.
- No duplicated rooming tables unless explicitly requested via options.
- Tables and typography use consistent theme; long text wraps without overflow.
- Tests cover core media and layout fallbacks; CI green.

## References (Code Pointers)

- Engine: `src/utils/hoja-de-ruta/pdf/pdf-engine.ts`
- Sections: `src/utils/hoja-de-ruta/pdf/sections/*`
- Services: `src/utils/hoja-de-ruta/pdf/services/*`
- Core: `src/utils/hoja-de-ruta/pdf/core/*`
- Pesos header baseline: `src/utils/pdfExport.ts`

## Rollout

- Implement services + options behind defaults to avoid behavior changes.
- Test against several jobs (with/without images, maps, rooming) to validate fallbacks.
- Iterate visual tweaks with quick trial PDFs.

