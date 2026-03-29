# Hoja de Ruta (Route Sheets)

> Event logistics documentation builder — captures venue, staff, travel, accommodation, schedule, and exports to PDF/Excel.

## Overview

The Hoja de Ruta is a comprehensive event documentation system for capturing all logistics and operational details for a job. It's one of the most complex form systems in the app, with 4 dedicated hooks totaling 50KB+.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/components/hoja-de-ruta/ModernHojaDeRuta.tsx` (29KB) |
| **Form state** | `src/hooks/useHojaDeRutaForm.ts` |
| **Persistence** | `src/hooks/useHojaDeRutaPersistence.ts` (28.9KB) |
| **Images** | `src/hooks/useHojaDeRutaImages.ts` |
| **Templates** | `src/hooks/useHojaDeRutaTemplates.ts` |
| **Sub-hooks** | `src/hooks/hoja-de-ruta/useHojaDeRutaState.ts`, `useHojaDeRutaInitialization.ts`, `useHojaDeRutaSave.ts` |
| **Types** | `src/types/hoja-de-ruta.ts` (285 lines) |
| **PDF export** | `src/utils/hoja-de-ruta/pdf/` (engine, sections, services) |
| **Excel export** | `src/utils/hojaDeRutaExport.ts` (648 lines) |
| **Components** | `src/components/hoja-de-ruta/` (10 section components + dialogs) |

## Database Tables

| Table | Purpose |
|-------|---------|
| `hoja_de_ruta` | Main record (event name, venue, schedule, power, auxiliary needs, status) |
| `hoja_de_ruta_contacts` | Event contacts (name, role, phone) |
| `hoja_de_ruta_staff` | Staff assignments (name, surname, position, DNI) |
| `hoja_de_ruta_logistics` | Loading/unloading details |
| `hoja_de_ruta_transport` | Individual transport vehicles |
| `hoja_de_ruta_travel_arrangements` | Travel itineraries (flights, trains, buses) |
| `hoja_de_ruta_accommodations` | Hotels with coordinates |
| `hoja_de_ruta_room_assignments` | Room allocations per accommodation |
| `hoja_de_ruta_images` | Venue images and maps |
| `hoja_de_ruta_templates` | Saved templates for reuse |

**RPC**: `replace_hoja_de_ruta_all` — atomic multi-table replacement for contacts, staff, transport.

## Workflow

```text
1. SELECT JOB → dropdown with available jobs
2. AUTO-POPULATE → loads job location, assignments, power requirements
3. FILL FORM (10 tabs):
   - Evento: name, dates, type, client
   - Recinto: venue, capacity, contact, images, map
   - Meteorología: weather forecast (from API)
   - Contactos: key contacts
   - Personal: staff (import from job assignments)
   - Viajes: flight/transport details
   - Alojamiento: hotels + room assignments
   - Logística: vehicles + transport categories
   - Programa: schedule/program rows
   - Restaurantes: search + select nearby
4. SAVE → parallel saves for main data, travel, accommodations, images
5. EXPORT → PDF (full document or driver certificate) or Excel
```

## Form Sections

Each tab maps to a `Modern*Section` component:
- `ModernEventSection`, `ModernVenueSection`, `ModernWeatherSection`, `ModernContactsSection`, `ModernStaffSection`, `ModernTravelSection`, `ModernAccommodationSection`, `ModernLogisticsSection`, `ModernScheduleSection`, `ModernRestaurantSection`

Status tracking: Draft → Review → Approved → Final. Completion percentage tracked across all sections.

## PDF Generation

Uses a modular PDF engine in `src/utils/hoja-de-ruta/pdf/`:
- **Sections**: Cover, event details, weather, contacts, staff, travel, accommodations, logistics, schedule, auxiliary needs, power requirements, restaurants, delivery certificate, QR codes
- **Services**: LogoService, HeaderService, FooterService, QRService, MapService, StampService, PlacesImageService
- PDF uploaded to job storage after generation

## Excel Export

Generates a 10-sheet workbook via ExcelJS: Evento, Recinto, Contactos, Personal, Viajes, Alojamiento, Logística, Programa, Meteorología, Restaurantes.

## Key Technical Details

- **Timezone**: All datetimes stored as UTC, displayed in Europe/Madrid
- **Images**: Supports direct upload + URL-based loading with CORS handling + Google Places photos
- **Atomic updates**: Uses `replace_hoja_de_ruta_all` RPC for consistent multi-table saves
- **Templates**: Save current form as reusable template (event_type categories: corporate, festival, tour, conference, wedding, other)
- **Dirty state**: Tracks unsaved changes, warns before navigation

## Integration Points

- **Job Management**: Auto-populates from job data (location, assignments, dates)
- **Google Places API**: Restaurant search, place photos, venue coordinates
- **Weather API**: Forecast data for event dates
- **Technician Profiles**: Links staff to profiles via technician_id
