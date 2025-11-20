# Codebase & Rollout Review Report

## Critical Blockers (Must Fix Before Deploy)

### 1. Unstaged Migration Trigger
**File:** `supabase/migrations/20251120103000_extend_timesheet_trigger_schedule_metadata.sql`
**Issue:** The critical trigger registration (`CREATE TRIGGER trg_create_timesheets_for_assignment`) is present in the file but **not staged** in git.
**Impact:** If deployed as is, the database trigger will not be created/updated. New job assignments will **not** automatically create timesheets. This breaks the core functionality of the "transparent" hotfix.
**Fix:** Stage the file changes (`git add supabase/migrations/20251120103000_extend_timesheet_trigger_schedule_metadata.sql`).

## Logic Weak Points & Potential Bugs

### 1. Morning Summary Availability Logic
**File:** `src/pages/MorningSummary.tsx`
**Issue:** The "Morning Summary" calculates available technicians (Warehouse) by filtering out those with *active* timesheets. However, it explicitly filters `is_schedule_only = false`.
```typescript
// src/pages/MorningSummary.tsx:73
.eq('is_schedule_only', false)
```
**Impact:** Technicians on "Tour Dates" or "Dry Hire" (which are flagged as `is_schedule_only` to avoid payroll) will **not** be considered "assigned". Consequently, they will appear in the **"En Almacén" (Warehouse)** list, incorrectly indicating they are available for work when they are actually on a tour.
**Recommendation:** The availability logic should include `is_schedule_only` timesheets to mark technicians as "busy", even if they are not displayed in the "En Trabajos" list (or they should be displayed with a distinct indicator).

### 2. Wallboard Crew Counts for Tour Dates
**File:** `src/pages/Wallboard.tsx`
**Issue:** The Wallboard fetches timesheets to calculate "Crew Assigned" counts but filters `is_schedule_only = false`.
```typescript
// src/pages/Wallboard.tsx:1334
.eq('is_schedule_only', false)
```
**Impact:** Jobs of type `tourdate` (which now use `is_schedule_only` timesheets) will likely show **0 Crew Assigned** on the Wallboard, even if technicians are assigned. This may be a regression if visibility of tour crews was expected.
**Recommendation:** Verify if Tour Dates should show crew counts. If so, the query needs to include `is_schedule_only` timesheets, potentially distinguishing them in the UI.

### 3. Environment & Build Integrity
**Issue:** `npm test` and `npm run build` failed due to permission errors (`EACCES`) in `node_modules`.
**Impact:** Unable to verify that the changes do not introduce build errors or regression failures.
**Recommendation:** Fix `node_modules` permissions (requires `sudo` or root access) and run a full build/test cycle before deployment.

## General Observations

*   **Frontend Usage:** The `is_schedule_only` flag is widely used across hooks and components (`useTimesheets`, `TechnicianRow`, etc.), correctly filtering "planning" entries from "payroll/worked" views.
*   **New Migrations:** Several new migrations are introduced. Ensure they are applied in the correct order. The backdated migration `20250716...` is unusual but likely intended to fill a gap; verify it doesn't conflict with existing schema state.

## Action Plan

1.  **Stage** the missing migration changes.
2.  **Fix** the `MorningSummary.tsx` logic to correctly account for `schedule_only` technicians in availability calculations.
3.  **Resolve** environment permissions and **Verify** build/tests pass.
