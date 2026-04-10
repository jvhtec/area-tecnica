# Matrix tooltip audit fields

Updated on: 2026-04-10

## What was added

The assignment matrix tooltip now includes actor + timestamp audit details for:

- Direct assignments (`job_assignments.assigned_by`, `job_assignments.assigned_at`).
- Staffing availability requests (`staffing_requests.requested_by`, `staffing_requests.created_at`).
- Staffing offers (`staffing_requests.requested_by`, `staffing_requests.created_at`).

## Data flow summary

1. `send-staffing-email` stores `requested_by` on every `staffing_requests` insert.
2. `useOptimizedMatrixData` now selects `assigned_by` and `assigned_at` from `job_assignments`.
3. `useStaffingMatrixStatuses` now selects and propagates `requested_by` and `created_at` for the latest availability/offer status shown per cell/date.
4. `OptimizedAssignmentMatrix` resolves actor IDs into display names from `profiles`.
5. `OptimizedMatrixCell` displays:
   - Assignment tooltip: `Estado`, `Asignado por`, `Fecha`.
   - Staffing tooltip (empty cell): `Disponibilidad/Oferta`, `Enviado por`, `Fecha`.

## Backwards compatibility

- `staffing_requests.requested_by` is nullable.
- Existing historical rows with `NULL requested_by` or assignments with `NULL assigned_by` gracefully omit actor lines in the tooltip.
