# Job Assignment Matrix

> Multi-department matrix view for assigning technicians to jobs with conflict detection, virtualized rendering, and real-time updates.

## Overview

The Job Assignment Matrix is the primary interface for crew scheduling. It displays a grid of technicians (rows) vs. dates/jobs (columns) with color-coded cells showing assignment status. Supports bulk operations, conflict detection, and staffing campaign integration.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/JobAssignmentMatrix.tsx` |
| **Core component** | `src/components/matrix/OptimizedAssignmentMatrix.tsx` |
| **Assignment dialog** | `src/components/matrix/AssignJobDialog.tsx` |
| **Cell components** | `src/components/matrix/MatrixCell.tsx`, `OptimizedMatrixCell.tsx` |
| **Data hook** | `src/hooks/useOptimizedMatrixData.ts` (21.3KB) |
| **Virtualization** | `src/hooks/useVirtualizedMatrix.ts` |
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

### Virtualization (`useVirtualizedMatrix`)
- Tracks scroll position (scrollLeft, scrollTop)
- Calculates visible range with 5-row/column overscan
- Only renders visible cells (critical for 100+ technicians x 30+ days)

### Memoization (`useMemoizedMatrix`)
- Pre-computes lookup maps: `technician_id:YYYY-MM-DD` → assignment
- Groups jobs by date for fast column filtering
- Pre-computes availability lookups

## Conflict Detection

Located in `src/utils/technicianAvailability.ts`:

- **Hard conflicts**: Overlapping job times → prompts confirmation dialog; user can proceed via "Forzar asignación" (force assignment) override in `AssignJobDialog.tsx`
- **Soft conflicts**: Cautionary flags → shows warning, allows assignment
- **Unavailability-only conflicts**: Availability/vacation conflicts without overlapping jobs still surface in the same review dialog as independent warnings for `full`, `single`, and `multi` coverage modes
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
   - Unavailability-only conflict → warning, allows explicit override
6. EXECUTE ASSIGNMENT:
   - Creates/updates job_assignments record
   - Creates timesheets via toggleTimesheetDay
   - Syncs category via syncTimesheetCategoriesForAssignment
   - Calls manage-flex-crew-assignments edge function
   - Sets assigned_by manager ID and timestamp

## Assignment Operations

- **Create assignment**: empty cell → select job → choose role → assign across full span, one day, or multiple selected dates
- **Modify same job**: existing assignment for the same job can add dates or replace the current date set without creating a duplicate assignment row
- **Reassign to another job**: removes the previous assignment/timesheets first, then creates the new assignment and recreates coverage on the selected job
- **Remove assignment**: uses `remove_assignment_with_timesheets` first, then falls back to direct `job_assignments` deletion if needed

## Realtime + Timezone Guarantees

- `useAvailableTechnicians` invalidates the current availability cache on every `job_assignments` `INSERT`, `DELETE`, and `UPDATE`, even when the change belongs to another job, so overlapping assignments cannot leave stale availability in the dialog.
- `useMemoizedMatrix` normalizes matrix day keys in `Europe/Madrid` and deduplicates repeated date entries before sorting and bucketing jobs/assignments.
- User-facing assignment dialog dates are formatted in Spanish locale for the dialog body, conflict review, and coverage selector.

## Test Coverage

- Unit/component coverage:
  - `src/components/matrix/__tests__/AssignJobDialog.test.tsx`
  - `src/components/matrix/assign-job-dialog/__tests__/useAssignJobMutations.test.tsx`
  - `src/components/matrix/assign-job-dialog/__tests__/conflictUtils.test.ts`
  - `src/hooks/__tests__/useAvailableTechnicians.test.tsx`
  - `src/hooks/__tests__/useMemoizedMatrix.test.tsx`
- Playwright coverage:
  - `tests/e2e/assignments-matrix.spec.ts`
- Recommended commands:
  - `npm run test:run -- src/components/matrix/__tests__/AssignJobDialog.test.tsx src/components/matrix/assign-job-dialog/__tests__/useAssignJobMutations.test.tsx src/components/matrix/assign-job-dialog/__tests__/conflictUtils.test.ts src/hooks/__tests__/useAvailableTechnicians.test.tsx src/hooks/__tests__/useMemoizedMatrix.test.tsx`
  - `npm run test:e2e -- tests/e2e/assignments-matrix.spec.ts`
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
