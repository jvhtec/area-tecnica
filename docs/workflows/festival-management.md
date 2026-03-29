# Festival Management

> Multi-day event management with artists, riders, gear setup, shift scheduling, and Flex integration.

## Overview

Festival management handles multi-day events with complex artist rosters, technical rider requirements, gear allocation, and crew shift scheduling. Festivals are linked to jobs in the `tours` table with festival-specific workflows.

## Key Files

| Category | Path |
|----------|------|
| **Pages** | `src/pages/FestivalManagement.tsx`, `FestivalArtistManagement.tsx`, `FestivalGearManagement.tsx`, `Festivals.tsx` |
| **View model** | `src/pages/festival-management/useFestivalManagementVm.ts` |
| **Components** | `src/components/festival/` (30+ components in subdirectories) |
| **Hooks** | `src/hooks/useFestival.ts`, `useFestivalArtists.ts`, `useCombinedGearSetup.ts` |
| **Shift hooks** | `src/hooks/festival/useFestivalShifts.ts` |
| **PDF export** | `src/utils/artistPdfExport.ts`, `artistTablePdfExport.ts`, `gearSetupPdfExport.ts`, `shiftsTablePdfExport.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `festival_artists` | Artist roster (name, stage, date, show times, soundcheck info) |
| `festival_artist_forms` | Tokenized form templates for artist requirements |
| `festival_artist_form_submissions` | Submitted artist requirement forms |
| `festival_artist_files` | Uploaded rider PDFs and files |
| `festival_gear_setups` | Global gear config (consoles, wireless, mics, infrastructure) |
| `festival_stage_gear_setups` | Per-stage gear overrides |
| `festival_shifts` | Shift time blocks (date, start/end, department, stage) |
| `festival_shift_assignments` | Technician-to-shift assignments |
| `festival_settings` | Festival-wide settings (day_start_time) |
| `festival_stages` | Stage definitions (number, name) |

## Workflows

### Artist & Rider Workflow

```text
1. CREATE FESTIVAL → linked to a job
2. ADD ARTISTS → name, stage, date, show times
3. SEND FORM LINKS → tokenized URL (7-day expiry) via email/QR code
4. ARTIST FILLS FORM → consoles, wireless, IEM, mics, infrastructure
5. ARTIST UPLOADS RIDER → PDF/images stored in festival_artist_files
6. MANAGEMENT REVIEWS → approval in ArtistManagementDialog
7. SYSTEM CALCULATES → MicrophoneNeedsCalculator aggregates all artist needs
8. GENERATE PDF → artist requirements, rider tables
```

### Gear Setup Workflow

```text
1. SET GLOBAL GEAR → festival_gear_setups: max stages, consoles, wireless, mics
2. STAGE OVERRIDES → festival_stage_gear_setups for per-stage differences
3. COMBINED VIEW → useCombinedGearSetup merges global + stage-specific
4. MISMATCH DETECTION → GearMismatchIndicator flags conflicts
5. PDF EXPORT → gear setup documentation
```

### Shift Scheduling Workflow

```text
1. CREATE SHIFTS → date, time range, department, stage
2. ASSIGN TECHNICIANS → via ManageAssignmentsDialog
3. REALTIME UPDATES → useFestivalShifts hook
4. VIEW → ShiftsTable with color-coded assignments
5. EXPORT → shifts PDF
```

## Component Structure

- `form/sections/` — Form input sections (BasicInfoSection, ConsoleSetupSection, WirelessSetupSection, etc.)
- `gear-setup/` — Gear configuration (ConsoleConfig, MicrophoneNeedsCalculator, WiredMicConfig, etc.)
- `scheduling/` — Shift scheduling (CreateShiftDialog, EditShiftDialog, ShiftsTable, etc.)
- `pdf/` — PDF generation dialogs
- `mobile/` — Mobile-specific UI

## Integration Points

- **Public Artist Form**: Tokenized public routes (`/festival/artist-form/{token}`) for artists to submit requirements without authentication
- **Flex Integration**: Push gear data to Flex via `PushToFlexPullsheetDialog`
- **Activity Logging**: Artist form submissions trigger `festival.public_form.submitted` events
- **Job System**: Each festival is linked to a parent job record
