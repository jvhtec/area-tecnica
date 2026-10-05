# Job Assignment Matrix

> Multi-department matrix view for assigning technicians to jobs with conflict detection, virtualized rendering, and real-time updates.

## Overview

The Job Assignment Matrix is the primary interface for crew scheduling. It displays a grid of technicians (rows) vs. dates/jobs (columns) with color-coded cells showing assignment status. Supports bulk operations, conflict detection, and staffing campaign integration.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/JobAssignmentMatrix.tsx` |
| **Page controls/dialogs** | `src/pages/job-assignment-matrix/MatrixPageControls.tsx`, `StaffingReminderDialogs.tsx`, `useStaffingButtonPreferences.ts`, `useMatrixViewport.ts` |
| **Core component** | `src/components/matrix/OptimizedAssignmentMatrix.tsx` |
| **Matrix controller hooks** | `src/components/matrix/optimized-assignment-matrix/useMatrixScrollState.ts`, `useMatrixTechnicianOrdering.ts` |
| **Matrix view** | `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx`, `MatrixGridRow.tsx`, `useSelectionDerivations.ts` |
| **Interaction layer (cell inspector, keyboard, job focus, batch, staffing composer, undo)** | `src/features/matrix-v2/` |
| **Command runner** | `src/features/matrix-v2/commandRunner.ts` (predict → exact result → rollback; 8 s undo window) |
| **Cell components** | `src/components/matrix/MatrixCell.tsx`, `OptimizedMatrixCell.tsx`, `optimized-matrix-cell/` |
| **Data hook** | `src/hooks/useOptimizedMatrixData.ts` (21.3KB) |
| **Virtualization** | `src/components/matrix/optimized-assignment-matrix/useMatrixScrollState.ts` |
| **Memoization** | `src/hooks/useMemoizedMatrix.ts` |
| **Available techs** | `src/hooks/useAvailableTechnicians.ts` |
| **Conflict utils** | `src/utils/technicianAvailability.ts` (12.5KB) |
| **Staffing panels** | `src/components/matrix/StaffingOrchestratorPanel.tsx`, `StaffingCampaignPanel.tsx` |

## Data Model

### Key Interfaces

**MatrixTimesheetAssignment**: Each cell in the matrix
- `job_id`, `technician_id`, `date` (YYYY-MM-DD)
- `job`: MatrixJob (title, times, color, status, counts)
- `status`: assignment status (pending/accepted/declined/cancelled)
- `sound_role`, `lights_role`, `video_role`: department-specific roles
- `source`: sourcing method (campaign, direct)

### Tables Used

| Table | Purpose |
|-------|---------|
| `job_assignments` | Technician-to-job assignments with roles |
| `timesheets` | Time entries per technician per date |
| `jobs` | Job details (title, dates, status, type) |
| `profiles` | Technician data (name, department, role) |
| `availability_schedules` | Technician unavailability records |
| `job_date_types` | Date type overrides (off/travel days) |
| `v_job_staffing_summary` | Materialized view with assignment/cost rollups |

## Performance Architecture

### Data Fetching (`useOptimizedMatrixData`)
- Batches job ID fetches (50 at a time) to avoid N+1 queries
- Uses `get_job_staffing_summary` RPC for cost/count rollups
- Builds assignment date maps from timesheet data

### Virtualization (`useMatrixScrollState`)
- `useMatrixScrollState` tracks synchronized header, technician-column, and grid scroll positions
- `useMatrixScrollState` calculates the visible row/column window with desktop/mobile overscan
- `useMatrixScrollState` preserves scroll position when date ranges expand before or after the current window
- `useMatrixScrollState` keeps mobile date navigation and edge-triggered range expansion outside the render component
- `useMatrixScrollState` limits rendering to visible cells (critical for 100+ technicians x 30+ days)

### Technician Ordering (`useMatrixTechnicianOrdering`)
- Owns job-focused sort state and batched staffing status lookup for the selected sort job
- Loads residence data only when location sorting is active
- Loads current-year and last-year timesheet counts for per-department medal ranking
- Keeps sorting/ranking logic out of the virtualized layout component

### Memoization (`useMemoizedMatrix`)
- Pre-computes lookup maps: `technician_id:YYYY-MM-DD` → assignment
- Groups jobs by date for fast column filtering
- Pre-computes availability lookups

## Conflict Detection

Conflicts are enforced by the assignment commands under the technician lock
(`conflict` rejection), not by a client preflight:

- **Hard conflicts** (overlapping confirmed work): the command rejects; the inspector, focus bar or batch row shows the clash and offers **Forzar**, which is a second command with `conflictPolicy: 'allow'`.
- Known unavailability (`technician_availability`) is shown on the cell. As before the overhaul, it does not block an assignment on its own: the command lists it in the rejection only when there is also a schedule clash.
- Job date types `off`/`travel` are not assignable days (`getAssignableJobDateKeys`, `src/features/matrix-v2/jobDays.ts`).

## Interaction Model

There are no modes. A click on a cell opens the **inspector** (popover on desktop, bottom sheet on phones) and every action in it is one step.

```text
CELL CLICK → inspector for that technician/day
  empty cell   → pick a job (the one in focus, or the day's jobs) → Asignar   (role suggested from the job's open slots)
  invited      → Confirmar / Rechazar / Quitar            (✓ ✕ on the cell itself confirm/decline without opening it)
  assigned     → role, days, Quitar (asks inline, never a dialog)
  any cell     → Pedir disponibilidad u oferta (staffing composer), No disponible
```

- **Deshacer**: every assignment, confirmation and role change can be taken back for 8 seconds. Flex and notification side effects are held until the window closes; an undo supersedes them, so nobody is told. Removals are not undoable.
- **Keyboard**: arrows move an active-cell ring, `Intro` opens the inspector, `C` confirm, `X` decline, `N` mark unavailable, `F` focus the cell's job (or leave focus), `Supr` remove (asks first), `Esc` back, `?` lists the shortcuts. Registered in `useShortcutStore` (Stream Deck).
- **Job focus** (`?trabajo=<job id>`): the job bar shows role slots and the next open slot, the job's days are highlighted, each technician gets a fit chip, and rows are ordered once on entry. A click on a day assigns that day; a click on a name assigns every free day. Status for new assignments is Invitado or Confirmado (bar toggle). Dry-hire jobs cannot be focused.
- **Selection and batch**: drag, shift-click or ctrl-click; one action bar (Asignar a…, Confirmar, No disponible, Quitar, Pedir disponibilidad / Enviar oferta). One command per technician/day pair, three at a time; each failed row keeps **Forzar** or **Reintentar**; one **Deshacer** reverts the batch.
- **Staffing composer** lives inside the inspector: intent first, job and days prefilled, suggested role, message collapsed, remembered channel, in-flight requests can be resent or cancelled, a clash shows inline with "Enviar igualmente".

Every write goes through `@/features/assignments/commands` (see `docs/staffing/ASSIGNMENT_COMMANDS.md`); `tests/assignments/matrix-direct-write-guard.test.ts` pins this for the matrix files.

## Cell Color Coding

| Status | Color | Meaning |
|--------|-------|---------|
| pending | Yellow | Assignment not yet accepted |
| accepted | Green | Technician accepted |
| declined | Red | Technician declined |
| cancelled | Gray | Assignment cancelled |
| unavailable | Dark gray | Technician marked unavailable |

## Integration Points

- **Staffing Orchestrator**: Campaign-based automated assignment via StaffingOrchestratorPanel
- **Flex Integration**: Crew assignments synced to Flex via edge function
- **Timesheet System**: Assignments auto-create timesheets
- **Tour System**: Tour assignments visible in matrix as multi-day ranges
- **Stream Deck**: Selected cell state exposed via `useSelectedCellStore`

## Refactor Boundary Notes

- `JobAssignmentMatrix.tsx` is now the route composition shell; control rendering, mobile filter UI, reminder dialogs, viewport detection, and staffing button preference persistence live in `src/pages/job-assignment-matrix/`.
- `OptimizedAssignmentMatrix.tsx` composes data, ordering, scroll state, and cell actions. Virtualized layout rendering remains in `OptimizedAssignmentMatrixView.tsx`.
- `OptimizedMatrixCell.tsx` owns the visible cell content, while the staffing badges, tooltip and display helpers live under `src/components/matrix/optimized-matrix-cell/`.
- Focused regression coverage for this boundary is in `src/pages/__tests__/JobAssignmentMatrix.test.tsx`, `src/components/matrix/__tests__/OptimizedAssignmentMatrix.test.tsx`, `src/components/matrix/__tests__/OptimizedMatrixCell.test.tsx`, `src/components/matrix/optimized-assignment-matrix/__tests__/OptimizedAssignmentMatrixView.test.tsx`, and the matrix Playwright smoke tests.
