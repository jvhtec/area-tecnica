# Festival Management Workflow (System Reference)

> Multi-day event management with artists, riders, gear setup, scheduling, gear comparison, and Flex integration.

## Overview

Festival management is the event-operations subsystem used to:

- manage artists and rider requirements,
- configure technical gear globally and by stage,
- schedule and assign crews,
- compare artist demand versus configured inventory,
- and push validated setup information to Flex.

Festival execution is attached to a parent job (`jobs.id`) and orchestrated primarily through the festival management pages and view model.

## Entry points

| Type | Path |
|---|---|
| Main page | `src/pages/FestivalManagement.tsx` |
| Artist-focused view | `src/pages/FestivalArtistManagement.tsx` |
| Gear-focused view | `src/pages/FestivalGearManagement.tsx` |
| Listing/launcher | `src/pages/Festivals.tsx` |
| VM/orchestration | `src/pages/festival-management/useFestivalManagementVm.ts` |

## Architecture docs by section

For full section-specific architecture, use:

- [Festival system architecture index](../architecture/festival-system/README.md)
- [Artist tables & workflow architecture](../architecture/festival-system/artist-tables.md)
- [Gear setup & comparison architecture](../architecture/festival-system/gear-setup-and-comparison.md)
- [Scheduling architecture](../architecture/festival-system/scheduling.md)
- [Flex integration architecture](../architecture/festival-system/flex-integration.md)

## Core database tables

- Artist domain: `festival_artists`, `festival_artist_forms`, `festival_artist_form_submissions`, `festival_artist_files`
- Gear domain: `festival_gear_setups`, `festival_stage_gear_setups`
- Scheduling domain: `festival_shifts`, `festival_shift_assignments`
- Festival configuration domain: `festival_settings`, `festival_stages`

## End-to-end workflow

```text
1) Festival job context initialized
2) Artists created/imported and form links distributed
3) Artists submit requirements + rider files
4) Management reviews submissions and finalizes artist table
5) Gear setup configured globally and per stage
6) Gear comparison system flags conflicts/capacity gaps
7) Crew shifts are created and assignments filled
8) When mismatches block delivery, create Extras quote in Flex (artist-level action)
9) Setup data exported (PDF/tables) and/or pushed to Flex pullsheets
10) Team executes show using validated schedule + technical data
```

## Gear comparison system (operational summary)

- Compares artist requirements against effective setup (global + stage override rules).
- Produces mismatch items with severity (`error`, `warning`, `info`).
- Aggregates additional-needs suggestions by model/category.
- Renders status via table indicators and detailed tooltip summaries.

## Flex integration summary

- Festival UI resolves available Flex context for the current job.
- Pullsheet push supports selection mode or direct URL mode.
- Export can be narrowed by gear sections to reduce bad writes.
- Result summary reports succeeded/failed rows for troubleshooting.

## Create Extras Quote integration (Flex)

Festival artist rows include a **"Crear presupuesto extras en Flex"** action when the gear comparison detects at least one `error` mismatch.

Operational behavior:

- Triggered from desktop and mobile artist actions (`ArtistTable`, `MobileArtistCard`).
- Uses `useCreateExtrasPresupuesto` to create/resolve: 
  1. `comercial` department folder,
  2. `comercial_extras` sound subfolder,
  3. a new `comercial_presupuesto` document in Flex.
- Persists created elements in `flex_folders` for traceability.
- Uses per-job queueing to avoid duplicate document numbers under concurrent clicks.

This integration closes the loop between **gear mismatch detection** and **commercial remediation workflow**.


## Related docs

- [Public artist form workflow](./public-artist-form.md)
- [Flex folder workflows audit](../flex-folder-workflows.md)
- [Flex selector integration](../FLEX_SELECTOR_INTEGRATION.md)
