# Festival Scheduling Architecture

This document covers festival shift planning and assignment architecture.

## 1) Data model

### `festival_shifts`

Represents schedule blocks by festival day:

- Identity: `id`, `job_id`, `name`.
- Time: `date`, `start_time`, `end_time`.
- Context: `department`, `stage`, `notes`.
- Audit: `created_at`, `updated_at`.

### `festival_shift_assignments`

Represents staffing allocations per shift:

- `shift_id` (FK to `festival_shifts`).
- `technician_id` (internal profile assignment).
- `external_technician_name` (external staffing).
- `role`.

Internal technicians must have a `job_assignments` row for the shift's job,
regardless of assignment status or source. Database triggers enforce this when
crew or a shift's job changes. Removing or moving a technician's job assignment
also removes that technician from the old job's shifts. External technicians are exempt from job membership.
An internal technician can appear only once per shift.

## 2) Main UI modules

- Scheduling container:
  - `src/components/festival/scheduling/FestivalScheduling.tsx`
- Shift sheet (one place for a shift's details and crew; it stays open after creating a shift):
  - `src/components/festival/scheduling/ShiftSheet.tsx` (times, stage, department, notes; create and edit)
  - `src/components/festival/scheduling/ShiftCrewSection.tsx` (assigned crew with in-place role change and undoable removal; multi-select picker with search, external suggestions)
- Views of the day (the planner opens on the board; the choice and the grouping are remembered per browser):
  - `src/components/festival/scheduling/ShiftBoard.tsx`: desktop timeline, one column per stage or department, hours from the festival day start, overnight shifts as one block; a lane's add button or a click on an empty spot starts a shift there
  - `src/components/festival/scheduling/ShiftAgenda.tsx`: the same lanes as sections on a phone
  - `src/components/festival/scheduling/ShiftsTable.tsx`: table for print and PDF export
  - `src/components/festival/scheduling/boardModel.ts`: pure lane, position and overlap rules
- Other operations:
  - `src/components/festival/scheduling/CopyShiftsDialog.tsx`
  - `src/components/festival/scheduling/ShiftTimeCalculator.tsx`
- Scheduling data commands:
  - `src/features/festival-scheduling/api.ts`

## 3) Scheduling workflow

```text
Create shifts per day/stage/department
  → Assign technicians/internal-external roles
    → Validate overlaps and day boundaries
      → Copy/reuse shifts for similar dates
        → Publish/use for execution and reporting
```

## 4) System integration points

- Festival stage definitions (`festival_stages`) help constrain stage targeting.
- Festival settings (`festival_settings.day_start_time`) support day-boundary behavior.
- Assignment decisions feed downstream staffing and operational visibility.

## 5) Practical architecture principles

- Keep shift entity small and declarative; assignments are separate join records.
- Support both internal and external staffing in the same assignment model.
- Preserve day/stage segmentation to avoid cross-stage ambiguity.
- Copy a complete day through `copy_festival_shifts`, which copies shifts and
  crew atomically and requires an empty target day.
