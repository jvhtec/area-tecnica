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
- Shift CRUD:
  - `src/components/festival/scheduling/CreateShiftDialog.tsx`
  - `src/components/festival/scheduling/EditShiftDialog.tsx`
  - `src/components/festival/scheduling/ShiftsTable.tsx`
  - `src/components/festival/scheduling/ShiftsList.tsx`
- Assignment operations:
  - `src/components/festival/scheduling/ManageAssignmentsDialog.tsx`
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
