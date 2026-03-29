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

- **Hard conflicts**: Overlapping job times → blocks assignment
- **Soft conflicts**: Cautionary flags → allows override with warning
- Checks against:
  - Existing timesheets for overlapping dates
  - Unavailability records from `availability_schedules`
  - Job date types (filters out 'off'/'travel' dates)

## Assignment Workflow

```
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
