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
- `technician_id` (internal user assignment).
- `external_technician_name` (external staffing).
- `role`.

## 2) Main UI modules

- Scheduling container:
  - `src/components/festival/scheduling/FestivalScheduling.tsx`
- Shift CRUD:
  - `CreateShiftDialog.tsx`
  - `EditShiftDialog.tsx`
  - `ShiftsTable.tsx`
  - `ShiftsList.tsx`
- Assignment operations:
  - `ManageAssignmentsDialog.tsx`
  - `CopyShiftsDialog.tsx`
  - `ShiftTimeCalculator.tsx`

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
- Make copy operations explicit/auditable to reduce accidental propagation.
