# Matrix UI Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix scrolling desync, virtualization gaps, and extend date range to 12 months in the Job Assignment Matrix.

**Architecture:** Replace 3-container scroll sync with single container + CSS sticky positioning. Replace custom virtualization with @tanstack/react-virtual. Increase date range limits.

**Tech Stack:** React, @tanstack/react-virtual, CSS sticky positioning, TanStack Query

---

## Phase 1: Quick Wins (Can Ship Immediately)

### Task 1: Increase Date Range Limits

**Files:**
- Modify: `src/hooks/useVirtualizedDateRange.ts:20-27`

**Step 1: Update the default options**

Change maxWeeksBefore/After from 26 to 52:

```typescript
export const useVirtualizedDateRange = (options: UseVirtualizedDateRangeOptions = {}) => {
  const {
    initialWeeksBefore = 1,
    initialWeeksAfter = 2,
    maxWeeksBefore = 52, // 12 months
    maxWeeksAfter = 52,  // 12 months
    expandByWeeks = 4
  } = options;
```

**Step 2: Verify the change**

Run: `npm run dev`
Expected: Matrix allows scrolling up to 12 months in each direction

**Step 3: Commit**

```bash
git add src/hooks/useVirtualizedDateRange.ts
git commit -m "feat(matrix): increase date range limit from 6 to 12 months"
```

---

### Task 2: Increase Virtualization Overscan

**Files:**
- Modify: `src/components/matrix/OptimizedAssignmentMatrix.tsx:243-244`

**Step 1: Increase overscan values**

Change from 10/6 to 15/10:

```typescript
  // Higher overscan to keep cells rendered during fast vertical/horizontal scrolls
  const OVERSCAN_ROWS = mobile ? 8 : 15;
  const OVERSCAN_COLS = mobile ? 6 : 10;
```

**Step 2: Verify the change**

Run: `npm run dev`
Expected: Fewer blank cells during fast scrolling

**Step 3: Commit**

```bash
git add src/components/matrix/OptimizedAssignmentMatrix.tsx
git commit -m "feat(matrix): increase virtualization overscan to reduce blank cells"
```

---

## Phase 2: Install Dependencies

### Task 3: Add @tanstack/react-virtual

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

```bash
npm install @tanstack/react-virtual
```

**Step 2: Verify installation**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/react-virtual dependency"
```

---

## Phase 3: Refactor to Sticky Positioning

### Task 4: Update CSS for Sticky Layout

**Files:**
- Modify: `src/index.css:205-340`

**Step 1: Replace the matrix CSS classes**

Replace the entire matrix section (lines 205-340) with:

```css
/* ===== MATRIX LAYOUT - UNIFIED SCROLL ===== */

.matrix-container {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  -webkit-overflow-scrolling: touch;
}

.matrix-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.matrix-container::-webkit-scrollbar-track {
  background: hsl(var(--muted) / 0.1);
}

.matrix-container::-webkit-scrollbar-thumb {
  background-color: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

.matrix-container::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground) / 0.5);
}

.matrix-table {
  display: grid;
  position: relative;
  background: hsl(var(--background));
}

/* Sticky Corner - highest z-index */
.matrix-corner-sticky {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 30;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
}

/* Sticky Header Row */
.matrix-header-row {
  display: contents;
}

.matrix-header-cell {
  position: sticky;
  top: 0;
  z-index: 20;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
  border-right: 1px solid hsl(var(--border));
}

/* Sticky Technician Column */
.matrix-tech-cell {
  position: sticky;
  left: 0;
  z-index: 10;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
}

/* Data Cells */
.matrix-data-cell {
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  contain: layout style paint;
}

/* Virtual row/column containers */
.matrix-virtual-row {
  display: contents;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .matrix-container {
    font-size: 0.875rem;
  }
}

/* ===== LEGACY MATRIX CLASSES (keep for migration) ===== */

.matrix-layout {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.matrix-corner {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 50;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
}

.matrix-date-headers {
  position: absolute;
  top: 0;
  z-index: 40;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.matrix-date-headers::-webkit-scrollbar {
  display: none;
}

.matrix-technician-column {
  position: absolute;
  left: 0;
  z-index: 30;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  overflow: hidden;
}

.matrix-technician-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

.matrix-technician-scroll::-webkit-scrollbar {
  width: 6px;
}

.matrix-technician-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.matrix-technician-scroll::-webkit-scrollbar-thumb {
  background-color: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

.matrix-main-area {
  position: absolute;
  background: hsl(var(--background));
  overflow: hidden;
}

.matrix-main-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  will-change: scroll-position;
  -webkit-overflow-scrolling: touch;
}

.matrix-main-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.matrix-main-scroll::-webkit-scrollbar-track {
  background: hsl(var(--muted) / 0.1);
}

.matrix-main-scroll::-webkit-scrollbar-thumb {
  background-color: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

.matrix-main-scroll::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground) / 0.5);
}

.matrix-grid {
  position: relative;
  background: hsl(var(--background));
  contain: layout style paint;
  will-change: transform;
}

.matrix-row {
  position: absolute;
  width: 100%;
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: 60px;
}

.matrix-cell-wrapper {
  position: absolute;
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  contain: layout style paint;
  will-change: transform;
  backface-visibility: hidden;
}

@media (max-width: 768px) {
  .matrix-layout {
    font-size: 0.875rem;
  }
  .matrix-row {
    contain-intrinsic-size: 80px;
  }
}
```

**Step 2: Verify CSS compiles**

Run: `npm run dev`
Expected: App loads without CSS errors

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(matrix): add sticky positioning CSS classes"
```

---

### Task 5: Create New Unified Matrix Component

**Files:**
- Create: `src/components/matrix/UnifiedAssignmentMatrix.tsx`

**Step 1: Create the new component file**

```typescript
import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, isSameDay } from 'date-fns';
import { TechnicianRow } from './TechnicianRow';
import { OptimizedMatrixCell } from './OptimizedMatrixCell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DateHeader } from './DateHeader';
import { SelectJobDialog } from './SelectJobDialog';
import { StaffingJobSelectionDialog } from './StaffingJobSelectionDialog';
import { AssignJobDialog } from './AssignJobDialog';
import { AssignmentStatusDialog } from './AssignmentStatusDialog';
import { MarkUnavailableDialog } from './MarkUnavailableDialog';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { useToast } from '@/hooks/use-toast';
import { OfferDetailsDialog } from './OfferDetailsDialog';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { Button } from '@/components/ui/button';
import { UserPlus, Calendar as CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQueryClient } from '@tanstack/react-query';

interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
  job_type: string;
}

interface Technician {
  id: string;
  first_name: string;
  nickname?: string | null;
  last_name: string;
  email: string;
  phone?: string | null;
  dni?: string | null;
  department: string;
  role: string;
  bg_color?: string | null;
  skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
}

interface UnifiedAssignmentMatrixProps {
  technicians: Technician[];
  dates: Date[];
  jobs: MatrixJob[];
  onNearEdgeScroll?: (direction: 'before' | 'after') => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  allowDirectAssign?: boolean;
  fridgeSet?: Set<string>;
  cellWidth?: number;
  cellHeight?: number;
  technicianWidth?: number;
  headerHeight?: number;
  mobile?: boolean;
}

export const UnifiedAssignmentMatrix = ({
  technicians,
  dates,
  jobs,
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  allowDirectAssign = false,
  fridgeSet,
  cellWidth = 160,
  cellHeight = 60,
  technicianWidth = 256,
  headerHeight = 80,
  mobile = false,
}: UnifiedAssignmentMatrixProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor('UnifiedMatrix');
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const qc = useQueryClient();
  const { toast } = useToast();

  useStaffingRealtime();
  const { mutate: sendStaffingEmail } = useSendStaffingEmail();

  // Dimensions
  const CELL_WIDTH = cellWidth;
  const CELL_HEIGHT = cellHeight;
  const TECH_WIDTH = technicianWidth;
  const HEADER_HEIGHT = headerHeight;

  // Data hook
  const {
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    invalidateAssignmentQueries,
    isInitialLoading,
    isFetching,
  } = useOptimizedMatrixData({ technicians, dates, jobs });

  // Staffing statuses
  const techIds = useMemo(() => technicians.map(t => t.id), [technicians]);
  const jobIds = useMemo(() => jobs.map(j => j.id), [jobs]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(techIds, jobIds, dates);

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: technicians.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => CELL_HEIGHT,
    overscan: mobile ? 8 : 15,
  });

  // Column virtualizer
  const colVirtualizer = useVirtualizer({
    count: dates.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => CELL_WIDTH,
    overscan: mobile ? 6 : 10,
    horizontal: true,
  });

  // Edge detection for infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !onNearEdgeScroll) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const edgeThreshold = CELL_WIDTH * 3; // 3 cells from edge

    if (scrollLeft < edgeThreshold && canExpandBefore) {
      onNearEdgeScroll('before');
    } else if (scrollLeft > maxScroll - edgeThreshold && canExpandAfter) {
      onNearEdgeScroll('after');
    }
  }, [onNearEdgeScroll, canExpandBefore, canExpandAfter, CELL_WIDTH]);

  // Scroll to today on mount
  useEffect(() => {
    const todayIndex = dates.findIndex(d => isSameDay(d, new Date()));
    if (todayIndex > 0 && scrollContainerRef.current) {
      const scrollTo = Math.max(0, (todayIndex - 2) * CELL_WIDTH);
      scrollContainerRef.current.scrollLeft = scrollTo;
    }
  }, [dates, CELL_WIDTH]);

  // Track render time
  useEffect(() => {
    startRenderTimer();
    return () => endRenderTimer();
  }, []);

  // Total grid dimensions
  const totalWidth = TECH_WIDTH + dates.length * CELL_WIDTH;
  const totalHeight = HEADER_HEIGHT + technicians.length * CELL_HEIGHT;

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();

  // Declined jobs map
  const declinedJobsByTech = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (allAssignments as any[])?.forEach((a: any) => {
      if (a?.status === 'declined' && a.technician_id && a.job_id) {
        if (!map.has(a.technician_id)) map.set(a.technician_id, new Set());
        map.get(a.technician_id)!.add(a.job_id);
      }
    });
    return map;
  }, [allAssignments]);

  // Cell action state (simplified - full implementation would mirror OptimizedAssignmentMatrix)
  const [cellAction, setCellAction] = useState<any>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const handleCellClick = useCallback((techId: string, date: Date, action: string, jobId?: string) => {
    setCellAction({ type: action, technicianId: techId, date, selectedJobId: jobId });
  }, []);

  const closeDialogs = useCallback(() => setCellAction(null), []);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        ref={scrollContainerRef}
        className="matrix-container"
        style={{ height: '100%', width: '100%' }}
        onScroll={handleScroll}
      >
        {/* Grid container with sticky positioning */}
        <div
          className="matrix-table"
          style={{
            width: totalWidth,
            height: totalHeight,
            gridTemplateColumns: `${TECH_WIDTH}px repeat(${dates.length}, ${CELL_WIDTH}px)`,
            gridTemplateRows: `${HEADER_HEIGHT}px repeat(${technicians.length}, ${CELL_HEIGHT}px)`,
          }}
        >
          {/* Sticky Corner */}
          <div
            className="matrix-corner-sticky"
            style={{ width: TECH_WIDTH, height: HEADER_HEIGHT }}
          >
            <div className="flex items-center justify-center h-full text-sm font-medium">
              Técnicos
            </div>
          </div>

          {/* Header Row - Date Headers */}
          {virtualCols.map((virtualCol) => {
            const date = dates[virtualCol.index];
            return (
              <div
                key={`header-${virtualCol.index}`}
                className="matrix-header-cell"
                style={{
                  width: CELL_WIDTH,
                  height: HEADER_HEIGHT,
                  gridColumn: virtualCol.index + 2, // +2 for corner column
                  gridRow: 1,
                }}
              >
                <DateHeader
                  date={date}
                  jobs={getJobsForDate(date)}
                  width={CELL_WIDTH}
                  height={HEADER_HEIGHT}
                />
              </div>
            );
          })}

          {/* Data Rows */}
          {virtualRows.map((virtualRow) => {
            const technician = technicians[virtualRow.index];
            const rowIndex = virtualRow.index + 2; // +2 for header row

            return (
              <React.Fragment key={technician.id}>
                {/* Sticky Technician Cell */}
                <div
                  className="matrix-tech-cell"
                  style={{
                    width: TECH_WIDTH,
                    height: CELL_HEIGHT,
                    gridColumn: 1,
                    gridRow: rowIndex,
                  }}
                >
                  <TechnicianRow
                    technician={technician}
                    height={CELL_HEIGHT}
                    isFridge={fridgeSet?.has(technician.id) || false}
                    compact={mobile}
                  />
                </div>

                {/* Data Cells */}
                {virtualCols.map((virtualCol) => {
                  const date = dates[virtualCol.index];
                  const assignment = getAssignmentForCell(technician.id, date);
                  const availability = getAvailabilityForCell(technician.id, date);
                  const cellKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const isSelected = selectedCells.has(cellKey);
                  const jobId = assignment?.job_id;

                  const byJobKey = jobId ? `${jobId}-${technician.id}` : '';
                  const byDateKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const staffingByJob = jobId && staffingMaps?.byJob.get(byJobKey);
                  const staffingByDate = staffingMaps?.byDate.get(byDateKey);

                  return (
                    <div
                      key={`${technician.id}-${virtualCol.index}`}
                      className="matrix-data-cell"
                      style={{
                        width: CELL_WIDTH,
                        height: CELL_HEIGHT,
                        gridColumn: virtualCol.index + 2,
                        gridRow: rowIndex,
                      }}
                    >
                      <OptimizedMatrixCell
                        technician={technician}
                        date={date}
                        assignment={assignment}
                        availability={availability}
                        width={CELL_WIDTH}
                        height={CELL_HEIGHT}
                        isSelected={isSelected}
                        onSelect={(selected) => {
                          setSelectedCells(prev => {
                            const next = new Set(prev);
                            if (selected) next.add(cellKey);
                            else next.delete(cellKey);
                            return next;
                          });
                        }}
                        onClick={(action, selectedJobId) => handleCellClick(technician.id, date, action, selectedJobId)}
                        onPrefetch={() => prefetchTechnicianData(technician.id)}
                        onOptimisticUpdate={(status) => assignment && updateAssignmentOptimistically(technician.id, assignment.job_id, status)}
                        onRender={() => incrementCellRender()}
                        jobId={jobId}
                        declinedJobIdsSet={declinedJobsByTech.get(technician.id) || new Set()}
                        allowDirectAssign={allowDirectAssign}
                        staffingStatusProvided={staffingByJob || null}
                        staffingStatusByDateProvided={staffingByDate || null}
                        isFridge={fridgeSet?.has(technician.id) || false}
                        mobile={mobile}
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Dialogs - same as OptimizedAssignmentMatrix */}
      {cellAction?.type === 'select-job' && (
        <SelectJobDialog
          open={true}
          onClose={closeDialogs}
          onJobSelected={(jobId) => {
            setCellAction({ ...cellAction, type: 'assign', selectedJobId: jobId });
          }}
          technicianName={`${technicians.find(t => t.id === cellAction.technicianId)?.first_name || ''} ${technicians.find(t => t.id === cellAction.technicianId)?.last_name || ''}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
        />
      )}

      {cellAction?.type === 'assign' && (
        <AssignJobDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
          existingAssignment={cellAction.assignment}
          preSelectedJobId={cellAction.selectedJobId}
        />
      )}
    </TooltipProvider>
  );
};
```

**Step 2: Verify component compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/matrix/UnifiedAssignmentMatrix.tsx
git commit -m "feat(matrix): add UnifiedAssignmentMatrix with sticky positioning and react-virtual"
```

---

### Task 6: Add Feature Flag and Integration

**Files:**
- Modify: `src/pages/JobAssignmentMatrix.tsx`

**Step 1: Import the new component**

Add at the top of the file after other imports:

```typescript
import { UnifiedAssignmentMatrix } from '@/components/matrix/UnifiedAssignmentMatrix';
```

**Step 2: Add feature flag state**

Add after the other useState declarations (around line 200):

```typescript
// Feature flag for new matrix implementation
const [useUnifiedMatrix] = useState(() => {
  return localStorage.getItem('matrix-unified') === 'true';
});
```

**Step 3: Conditionally render the matrix**

Find where OptimizedAssignmentMatrix is rendered (around line 1200) and wrap it:

```typescript
{useUnifiedMatrix ? (
  <UnifiedAssignmentMatrix
    technicians={filteredTechnicians}
    dates={dateRange}
    jobs={matrixJobs}
    onNearEdgeScroll={handleNearEdgeScroll}
    canExpandBefore={canExpandBefore}
    canExpandAfter={canExpandAfter}
    allowDirectAssign={allowDirectAssign}
    fridgeSet={fridgeSet}
    cellWidth={isMobile ? 140 : undefined}
    cellHeight={isMobile ? 80 : undefined}
    technicianWidth={isMobile ? 110 : undefined}
    headerHeight={isMobile ? 50 : undefined}
    mobile={isMobile}
  />
) : (
  <OptimizedAssignmentMatrix
    // ... existing props
  />
)}
```

**Step 4: Test both implementations**

Run: `npm run dev`
- Test default (old) implementation
- Open console, run `localStorage.setItem('matrix-unified', 'true')`, refresh
- Test new implementation

**Step 5: Commit**

```bash
git add src/pages/JobAssignmentMatrix.tsx
git commit -m "feat(matrix): add feature flag for unified matrix implementation"
```

---

## Phase 4: Complete Dialog Migration

### Task 7: Complete Dialog Handlers in UnifiedAssignmentMatrix

**Files:**
- Modify: `src/components/matrix/UnifiedAssignmentMatrix.tsx`

**Step 1: Copy dialog state and handlers from OptimizedAssignmentMatrix**

This requires copying all the cell action handlers, dialog state, and staffing logic from OptimizedAssignmentMatrix.tsx. The key sections are:

- CellAction type and state (lines 64-73, 103-104)
- All dialog state (lines 425-443)
- Handle functions (handleCellClick, handleJobSelected, handleStaffingActionSelected, etc.)
- All Dialog components at the bottom

**Step 2: Verify all dialogs work**

Run: `npm run dev`
Enable unified matrix, test:
- Clicking empty cell shows job selection
- Clicking assigned cell shows status options
- Staffing dialogs open correctly

**Step 3: Commit**

```bash
git add src/components/matrix/UnifiedAssignmentMatrix.tsx
git commit -m "feat(matrix): complete dialog integration in UnifiedAssignmentMatrix"
```

---

## Phase 5: Remove Legacy Code

### Task 8: Make Unified Matrix Default

**Files:**
- Modify: `src/pages/JobAssignmentMatrix.tsx`

**Step 1: Change default to true**

```typescript
const [useUnifiedMatrix] = useState(() => {
  const stored = localStorage.getItem('matrix-unified');
  return stored !== 'false'; // Default to true
});
```

**Step 2: Test thoroughly**

Run: `npm run dev`
Test all matrix functionality with 100+ technicians

**Step 3: Commit**

```bash
git add src/pages/JobAssignmentMatrix.tsx
git commit -m "feat(matrix): make unified matrix the default implementation"
```

---

### Task 9: Remove Old Scroll Sync Code

**Files:**
- Modify: `src/components/matrix/OptimizedAssignmentMatrix.tsx` (optional - keep as fallback)

This task is optional. Keep the old implementation as a fallback by using the localStorage flag `matrix-unified=false`.

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Can scroll 12 months in either direction
- [ ] No visible desync between headers/tech column and grid
- [ ] Smooth scrolling with 100+ technicians
- [ ] No blank cells during normal scrolling
- [ ] All dialogs work (assign, staffing, status changes)
- [ ] Mobile layout works correctly
- [ ] Edge scroll expansion triggers properly
- [ ] Performance monitor shows acceptable metrics

---

## Rollback

If issues arise:
1. Set `localStorage.setItem('matrix-unified', 'false')`
2. Refresh page
3. Old implementation will be used
