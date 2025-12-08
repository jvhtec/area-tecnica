# Job Assignment Matrix UI Optimization Design

## Problem Statement

The current matrix implementation has three issues:
1. **Date range limited to 6 months** - users need 9-12 months
2. **Sync scrolling desync** - headers/tech column lag behind main grid during fast scrolling
3. **Virtualization gaps** - cells don't render until scrolling a bit

Target scale: 100+ technicians × 365 days (~36,500 cells)

## Solution Overview

### 1. Unified Scroll Container with Sticky Positioning

**Replace** the current 3-container sync approach with a single scroll container using CSS `position: sticky`.

**Current architecture:**
- 3 separate scroll containers (date headers, technician column, main grid)
- JavaScript-based scroll synchronization via `requestAnimationFrame`
- Different throttling rates causing visual desync

**New architecture:**
- Single scroll container wrapping the entire matrix
- Date headers: `position: sticky; top: 0`
- Technician column: `position: sticky; left: 0`
- Corner cell: `position: sticky; top: 0; left: 0`
- Zero JS sync code needed

**Benefits:**
- Native browser scroll handling (GPU accelerated)
- No desync possible - single scroll source
- Eliminates all scroll event handlers for sync
- Better mobile performance

### 2. @tanstack/react-virtual Integration

**Replace** custom virtualization with `@tanstack/react-virtual`.

**Current issues:**
- Fixed overscan values don't adapt to scroll velocity
- `requestAnimationFrame` scheduling causes cells to render one frame late
- Edge cases with fast scrolling leave gaps

**New approach:**
- Use `useVirtualizer` for both rows and columns
- Dynamic overscan based on scroll velocity (built-in)
- Synchronous measurement and rendering
- Proven at scale (used by TanStack Table, AG Grid, etc.)

**Implementation:**
```typescript
const rowVirtualizer = useVirtualizer({
  count: technicians.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => CELL_HEIGHT,
  overscan: 10,
});

const colVirtualizer = useVirtualizer({
  count: dates.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => CELL_WIDTH,
  overscan: 6,
  horizontal: true,
});
```

### 3. Infinite Date Range with Data Windowing

**Replace** hard max limits with dynamic data fetching based on visible window.

**Current limits:**
- `maxWeeksBefore: 26` (6 months)
- `maxWeeksAfter: 26` (6 months)
- All data loaded upfront for the range

**New approach:**
- Remove `maxWeeksBefore/After` limits (or set to 104 weeks / 2 years)
- Fetch jobs only for visible date window + 4-week buffer on each side
- Prefetch next window when user scrolls within 2 weeks of edge
- Cache previously fetched windows

**Data fetching strategy:**
```
Visible window: [Week 10 - Week 14]
Fetched data:   [Week 6 - Week 18]  (4-week buffer each side)
Prefetch trigger: When scrolling into [Week 8] or [Week 16]
```

**Benefits:**
- Unlimited scroll range
- Controlled memory usage
- Fast initial load (only fetch ~8 weeks initially)

## File Changes

### Modified Files:
1. `src/components/matrix/OptimizedAssignmentMatrix.tsx` - Major refactor
   - Remove 3-container structure
   - Add single scroll container with sticky elements
   - Replace custom virtualization with react-virtual
   - Remove all scroll sync logic

2. `src/hooks/useVirtualizedDateRange.ts` - Increase/remove limits
   - Change `maxWeeksBefore/After` to 104 or remove
   - Add data windowing logic

3. `src/hooks/useOptimizedMatrixData.ts` - Add windowed fetching
   - Accept visible date window parameter
   - Fetch only jobs/assignments for visible window + buffer
   - Implement prefetching

4. `src/index.css` - Update matrix styles
   - Add sticky positioning rules
   - Remove sync-related hacks

### New Dependencies:
- `@tanstack/react-virtual` (~3KB gzipped)

## Migration Strategy

Phase 1: Quick wins (can ship independently)
- Increase date range limits to 52 weeks each direction
- Increase overscan values

Phase 2: Sticky positioning refactor
- Restructure DOM to single scroll container
- Remove all sync logic
- Update CSS

Phase 3: React-virtual integration
- Replace custom virtualization
- Test with 100+ technicians

Phase 4: Data windowing
- Implement windowed fetching
- Add prefetch logic
- Remove upfront data limits

## Rollback Plan

Keep the old `AssignmentMatrix.tsx` as fallback. Add feature flag to switch between implementations during testing.

## Success Criteria

- [ ] Can scroll 12 months in either direction
- [ ] No visible desync between headers/tech column and grid
- [ ] Smooth 60fps scrolling with 100+ technicians
- [ ] No blank cells during normal scrolling speed
- [ ] Initial load time unchanged or improved
