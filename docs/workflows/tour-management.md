# Tour Management

> Series of shows/dates with crew assignments, documents, rates, logistics, and Flex folder sync.

## Overview

Tours group multiple job dates under a single entity. Tour-level assignments auto-sync to all job dates. Tours share the `tours` table with festivals but use a distinct workflow focused on dates, itineraries, and rate management.

## Key Files

| Category | Path |
|----------|------|
| **Pages** | `src/pages/Tours.tsx`, `src/pages/TourManagement.tsx` |
| **Components** | `src/components/tours/` (30+ components) |
| **Core hooks** | `src/hooks/useMyTours.ts`, `src/hooks/useTourAssignments.ts`, `src/hooks/useTourCreation.ts`, `src/hooks/useTourDocuments.ts` |
| **Flex hooks** | `src/hooks/useTourDateFlexFolders.ts` |
| **Rate hooks** | `src/hooks/useTourRatesApproval.ts`, `src/hooks/useTourBaseRates.ts`, `src/hooks/useTourJobRateQuotes.ts` |
| **Default hooks** | `src/hooks/useTourDefaultSets.ts`, `src/hooks/useTourPowerDefaults.ts`, `src/hooks/useTourWeightDefaults.ts` |
| **Override hooks** | `src/hooks/useTourDateOverrides.ts`, `src/hooks/useTourOverrideMode.ts` |
| **Scheduling** | `src/components/tours/scheduling/` (itinerary builder, travel planner, accommodations, map view) |

## Database Tables

| Table | Purpose |
|-------|---------|
| `tours` | Tour master (name, description, color, dates, invoicing_company, rates_approved, status) |
| `tour_dates` | Individual dates (tour_id, date, location_id, job_id) |
| `tour_assignments` | Technician assignments to entire tour (auto-syncs to job_assignments) |
| `tour_documents` | Tour-level documents with `visible_to_tech` flag |
| `tour_logos` | Tour logo storage |
| `tour_default_sets` | Saved rate/config presets |
| `tour_default_tables` | Default rate tables per tour |
| `tour_power_defaults` | Power requirement defaults |
| `tour_weight_defaults` | Weight/load defaults |
| `tour_date_power_overrides` | Per-date power overrides |
| `tour_date_weight_overrides` | Per-date weight overrides |
| `rate_cards_tour_2025` | Rate cards for tours |

## Tour → Job Relationship

```text
Tour (1) → Tour Dates (many) → Jobs (1 per date)
```

- 1 tour has many tour dates
- Each tour date creates 1 job (via `TourDateManagementDialog`)
- `jobs.tour_date_id` links to `tour_dates`
- Tour-level assignments cascade to all related jobs

### Auto-Sync Mechanism

When a technician is assigned to a tour via `tour_assignments`:
- They are automatically assigned to **all** tour's jobs
- When removed from tour, removed from all jobs
- Timesheets cascade accordingly

## Workflows

### Tour Creation

```text
1. CREATE TOUR → name, description, color, departments
2. ADD DATES → via TourDateManagementDialog
3. EACH DATE CREATES A JOB → jobs.tour_date_id links back
4. SET DEFAULTS → rates, power, weight via TourDefaultsManager
```

### Crew Assignment

```text
1. OPEN TourAssignmentDialog
2. SELECT department, role, technician
3. CREATE tour_assignments record
4. AUTO-SYNC to all job_assignments for tour's jobs
5. TIMESHEETS auto-generated
```

### Document Management

```text
1. UPLOAD via TourDocumentsDialog
2. STORED in tour-documents bucket
3. SET visible_to_tech flag (controls technician access)
4. TECHNICIANS see only visible docs
```

### Rates & Defaults

```text
1. SET tour defaults (base rates from rate_cards_tour_2025)
2. CONFIGURE power/weight requirements
3. PER-DATE OVERRIDES via tour_date_*_overrides tables
4. APPROVE rates via TourRatesManagerDialog
5. PDF EXPORT of rate summaries
```

### Flex Folder Creation

```text
1. CLICK "Create Flex Folders" in TourCard
2. useTourDateFlexFolders creates folders for each date's job
3. SETS jobs.flex_folders_created = true per date
```

## Component Structure

- `hooks/` — Tour-specific hooks (useTourCreation, useTourDates, useTourManagement, useTourDepartments)
- `scheduling/` — EnhancedTourTravelPlanner, TourAccommodationsManager, TourItineraryBuilder, TourMapView
- `tour-date-management/` — Date-specific utilities

## Integration Points

- **Job System**: Each tour date creates a job; tour assignments cascade to jobs
- **Timesheet System**: Timesheets auto-generated from assignments
- **Rates System**: Tour-level rate approval controls payout visibility
- **Flex Integration**: Folder creation for all tour dates
- **Hoja de Ruta**: Tour dates can generate route sheets
