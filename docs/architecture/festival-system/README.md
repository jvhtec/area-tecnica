# Festival System Architecture

This section documents the full Festival subsystem in **Area Técnica**, split by architecture domain so each team (ops, product, engineering) can work with a focused reference.

## Scope

The festival system includes:

- Artist lifecycle (roster, rider requests, public forms, submissions, rider files).
- Gear setup and validation (global setup, per-stage setup, mismatch detection).
- Staffing schedule (shifts, assignments, stage/day-level planning).
- Flex integration (pullsheet push, folder/document integration, navigation/opening, and extras quote creation for mismatch remediation).

## Reading order (recommended)

1. [Artist data model & workflows](./artist-tables.md)
2. [Gear setup & comparison architecture](./gear-setup-and-comparison.md)
3. [Festival scheduling architecture](./scheduling.md)
4. [Flex integration architecture](./flex-integration.md)

## Core UI and orchestration entry points

- Route pages: `src/pages/FestivalManagement.tsx`, `src/pages/FestivalArtistManagement.tsx`, `src/pages/FestivalGearManagement.tsx`, `src/pages/Festivals.tsx`.
- Festival VM/orchestration: `src/pages/festival-management/useFestivalManagementVm.ts`.
- Domain UI modules: `src/components/festival/` (`form`, `gear-setup`, `mobile`, `pdf`, `scheduling`).

## Core database entities

Festival behavior primarily reads/writes these entities:

- `festival_artists`
- `festival_artist_forms`
- `festival_artist_form_submissions`
- `festival_artist_files`
- `festival_gear_setups`
- `festival_stage_gear_setups`
- `festival_shifts`
- `festival_shift_assignments`
- `festival_settings`
- `festival_stages`

(See typed schema details in `src/integrations/supabase/types.ts`.)

## Workflow map

```text
Festival Job Created
  ├─ Artist roster loaded
  │   ├─ Form links generated
  │   ├─ Public form submitted
  │   └─ Rider files uploaded/reviewed
  ├─ Gear setup configured
  │   ├─ Global setup
  │   ├─ Stage overrides
  │   └─ Comparison/mismatch analysis
  ├─ Scheduling configured
  │   ├─ Shifts created
  │   ├─ Technicians assigned
  │   └─ Assignment copied/rebalanced
  └─ Flex integration
      ├─ Open related folders/elements
      ├─ Push pullsheet items
      └─ Track sync status/logs
```
