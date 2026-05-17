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
| **Matrix view/dialogs** | `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx`, `MatrixDialogs.tsx` |
| **Assignment dialog** | `src/components/matrix/AssignJobDialog.tsx` |
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

Located in `src/utils/technicianAvailability.ts`:

- **Hard conflicts**: Overlapping job times → prompts confirmation dialog; user can proceed via "Forzar asignación" (force assignment) override in `AssignJobDialog.tsx`
- **Soft conflicts**: Cautionary flags → shows warning, allows assignment
- Checks against:
  - Existing timesheets for overlapping dates
  - Unavailability records from `availability_schedules`
  - Job date types (filters out 'off'/'travel' dates)

## Assignment Workflow

```text
1. CLICK CELL → opens AssignJobDialog
2. SELECT JOB → from available jobs for that date
3. SELECT ROLE → department-specific (FOH/Monitors/Systems for Sound, etc.)
4. SELECT COVERAGE:
   - 'full' = entire job duration
   - 'single' = single day only
   - 'multi' = multiple selected dates
5. CONFLICT CHECK → checkForConflicts()
   - Hard conflict → dialog, requires user override
   - Soft conflict → warning, allows assignment
6. EXECUTE ASSIGNMENT:
   - Creates/updates job_assignments record
   - Creates timesheets via toggleTimesheetDay
   - Syncs category via syncTimesheetCategoriesForAssignment
   - Calls manage-flex-crew-assignments edge function
   - Sets assigned_by manager ID and timestamp
```

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
- `OptimizedMatrixCell.tsx` owns the visible cell content, while assignment removal side effects, retry/cancel dialogs, and tooltip formatting live under `src/components/matrix/optimized-matrix-cell/`.
- Focused regression coverage for this boundary is in `src/pages/__tests__/JobAssignmentMatrix.test.tsx`, `src/components/matrix/__tests__/OptimizedAssignmentMatrix.test.tsx`, `src/components/matrix/__tests__/OptimizedMatrixCell.test.tsx`, `src/components/matrix/optimized-assignment-matrix/__tests__/OptimizedAssignmentMatrixView.test.tsx`, and the matrix Playwright smoke tests.
