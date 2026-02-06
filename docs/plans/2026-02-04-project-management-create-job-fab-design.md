# Project Management Create Job FAB Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

Add a Floating Action Button (FAB) to the Project Management page that opens the existing global CreateJobDialog with context-aware pre-population based on the currently selected department and month.

## Visual Design

### FAB Positioning
- Fixed position at bottom-right corner
- Desktop: 24px from bottom and right edges (via `bottom-6 right-6`)
- Mobile: 16px from edges (via `md:bottom-8 md:right-8`)
- Z-index: 50 (above page content, below modals)

### FAB Appearance
- Circular button: 48x48px mobile, 56x56px desktop
- Primary blue color: `bg-blue-600 hover:bg-blue-500`
- White Plus icon from lucide-react
- Shadow: `shadow-lg` for depth
- Hover effect: `hover:scale-110` transition
- Matches existing "Create Job" button styling across the app

### Responsive Behavior
- Always visible while scrolling
- Positioned above mobile bottom sheets/navigation
- Touch target meets 44x44px minimum accessibility requirement

### Accessibility
- ARIA label: "Create new job"
- Keyboard accessible (tabbable)
- Only visible to users with create permissions

## Context-Aware Dialog Opening

When the FAB is clicked, it opens the global CreateJobDialog with pre-populated fields:

### Department Pre-selection
- Passes `selectedDepartment` (currently active tab) to dialog store
- Dialog opens with that department already selected
- User can still change departments after opening

### Date Pre-population
- Passes `currentDate` (current month from navigation) to dialog store
- Start/end times default to a date within that month
- Ensures new jobs appear in the currently viewed month
- User can adjust dates as needed

### Implementation Call
```typescript
openDialog({
  department: selectedDepartment,  // From DepartmentTabs state
  date: currentDate,                // From MonthNavigation state
  jobType: undefined                // Let dialog use default
})
```

## Technical Implementation

### Files Modified
1. **`src/pages/ProjectManagement.tsx`** - Only file that needs changes

### Changes Required
1. Import `useCreateJobDialogStore` from `@/stores/useCreateJobDialogStore`
2. Import `Plus` icon from `lucide-react`
3. Destructure `openDialog` from the store hook
4. Add FAB component before closing `</div>` tags (outside main Card)

### FAB Component
```tsx
{canCreateItems && (
  <button
    onClick={() => openDialog({
      department: selectedDepartment,
      date: currentDate
    })}
    className="fixed bottom-6 right-6 md:bottom-8 md:right-8
               w-12 h-12 md:w-14 md:h-14
               bg-blue-600 hover:bg-blue-500
               text-white rounded-full shadow-lg
               flex items-center justify-center
               transition-all hover:scale-110
               z-50"
    aria-label="Create new job"
  >
    <Plus className="h-6 w-6" />
  </button>
)}
```

### Permission Check
- Respects existing `canCreateItems` boolean (already computed)
- Only users with roles: admin, management, logistics see the FAB
- Matches permission logic for "Auto-Complete Past Jobs" button

### Z-index Stack
- Page content: default (z-0 to z-10)
- FAB: z-50
- Dialog/Modal overlays: z-50+ (appear over FAB)
- Mobile Sheet components: default z-index

## Benefits

1. **Improved UX**: Common mobile/modern pattern for create actions
2. **Context-aware**: Smart defaults reduce friction for most common use case
3. **Consistent**: Uses existing global dialog and permission patterns
4. **Minimal code**: Only one file modified, ~15 lines of code added
5. **Accessible**: Keyboard and screen reader friendly
6. **Responsive**: Works seamlessly on mobile and desktop

## Testing Checklist

- [ ] FAB appears on Project Management page for authorized users
- [ ] FAB does not appear for technician role
- [ ] Clicking FAB opens CreateJobDialog
- [ ] Dialog pre-selects the currently active department tab
- [ ] Dialog defaults to a date within the currently viewed month
- [ ] FAB remains visible while scrolling
- [ ] FAB appears correctly on mobile viewport
- [ ] FAB appears correctly on desktop viewport
- [ ] FAB is keyboard accessible (Tab to focus, Enter to click)
- [ ] FAB has correct ARIA label for screen readers
- [ ] FAB appears above page content but below dialog overlay
- [ ] Hover effect works smoothly on desktop
- [ ] Touch target is adequate on mobile (48x48px minimum)

## Future Enhancements (Not in Scope)

- Add tooltip on hover showing "Create Job (Ctrl+N)"
- Animate FAB entrance on page load
- Add badge/count indicator if there are pending actions
- Consider adding secondary actions (speed dial menu)
