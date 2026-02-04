# Project Management Create Job FAB Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Floating Action Button (FAB) to the Project Management page that opens the global CreateJobDialog with context-aware pre-population.

**Architecture:** Modify ProjectManagement.tsx to add a fixed-position FAB button that calls the existing useCreateJobDialogStore hook with current department and date context. Zero new components needed - uses existing global dialog infrastructure.

**Tech Stack:** React, TypeScript, Zustand (store), Tailwind CSS, lucide-react icons

---

## Task 1: Add FAB Imports

**Files:**
- Modify: `src/pages/ProjectManagement.tsx:1-23`

**Step 1: Add missing imports**

Add these two imports to the existing import block:

```typescript
import { Loader2, CheckCircle, Search, Filter, X, Plus } from "lucide-react";
```

```typescript
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useCreateJobDialogStore } from "@/stores/useCreateJobDialogStore";
```

**Location:**
- Add `Plus` to the lucide-react import on line 6 (after `X`)
- Add the `useCreateJobDialogStore` import after line 23 (after `useOptimizedAuth`)

**Step 2: Verify imports compile**

Run: `npm run dev` (or check TypeScript compilation)
Expected: No import errors

**Step 3: Commit**

```bash
git add src/pages/ProjectManagement.tsx
git commit -m "feat(project-mgmt): add imports for FAB component"
```

---

## Task 2: Add Store Hook

**Files:**
- Modify: `src/pages/ProjectManagement.tsx:25-44`

**Step 1: Add openDialog destructuring**

Inside the `ProjectManagement` component (after line 29, after `const isMobile = useIsMobile();`), add:

```typescript
const { openDialog } = useCreateJobDialogStore();
```

**Location:** Add this line around line 30, after the `useIsMobile()` hook and before the state declarations.

**Step 2: Verify hook works**

Run: `npm run dev`
Expected: No errors, page loads normally

**Step 3: Commit**

```bash
git add src/pages/ProjectManagement.tsx
git commit -m "feat(project-mgmt): add CreateJobDialog store hook"
```

---

## Task 3: Add FAB Component

**Files:**
- Modify: `src/pages/ProjectManagement.tsx:412-415`

**Step 1: Add FAB button before closing divs**

Find the closing tags at the end of the component (around line 412-415):

```typescript
        </CardContent>
      </Card>
    </div>
    </div>
  );
};
```

Replace with:

```typescript
        </CardContent>
      </Card>
    </div>

    {/* Floating Action Button for Create Job */}
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
    </div>
  );
};
```

**Important:**
- The FAB must be inside the outer `<div>` (line 349) but outside the `<Card>` component
- It should be after the closing `</div>` for the card's parent div (line 413)
- Before the final closing `</div>` that ends the component (line 414)

**Step 2: Verify FAB appears**

Run: `npm run dev`
Navigate to: `http://localhost:8080/project-management`

Expected:
- FAB appears in bottom-right corner (only if logged in as admin/management/logistics)
- FAB is circular, blue, with a white plus icon
- FAB is visible while scrolling

**Step 3: Test FAB interaction**

1. Click the FAB
Expected: CreateJobDialog opens

2. Check dialog pre-population:
   - Department should match the currently selected tab
   - Date should be within the currently viewed month

3. Test on mobile viewport (resize browser to < 768px):
   - FAB should be slightly smaller
   - Touch target should be at least 48x48px

**Step 4: Test permissions**

1. If logged in as technician role:
Expected: FAB does NOT appear

2. If logged in as admin/management/logistics:
Expected: FAB appears

**Step 5: Commit**

```bash
git add src/pages/ProjectManagement.tsx
git commit -m "feat(project-mgmt): add FAB for creating jobs

- Add fixed-position FAB in bottom-right corner
- Context-aware: pre-populates department and date from current view
- Respects permissions (admin, management, logistics only)
- Responsive: 48x48px mobile, 56x56px desktop
- Accessible: ARIA label, keyboard accessible
- Matches existing blue button styling"
```

---

## Task 4: Manual Testing Checklist

**Files:**
- Test: Manual testing in browser

**Step 1: Visual testing**

Run: `npm run dev`
Navigate to: `/project-management`

Check:
- [ ] FAB appears in bottom-right corner
- [ ] FAB has correct size (48x48px mobile, 56x56px desktop)
- [ ] FAB has blue background (#3b82f6)
- [ ] FAB has white Plus icon
- [ ] FAB has shadow
- [ ] FAB remains visible while scrolling

**Step 2: Interaction testing**

Test clicks:
- [ ] Click FAB → CreateJobDialog opens
- [ ] Dialog shows correct department (matches active tab)
- [ ] Dialog shows date within current month
- [ ] Can still change department in dialog
- [ ] Can still change date in dialog

**Step 3: Permission testing**

Test with different roles:
- [ ] Admin: FAB visible
- [ ] Management: FAB visible
- [ ] Logistics: FAB visible
- [ ] Technician: FAB NOT visible

**Step 4: Responsive testing**

Test viewports:
- [ ] Desktop (1920x1080): FAB 56x56px, positioned correctly
- [ ] Tablet (768x1024): FAB transitions smoothly
- [ ] Mobile (375x667): FAB 48x48px, touch-friendly

**Step 5: Accessibility testing**

Test keyboard:
- [ ] Tab key reaches FAB
- [ ] Enter key opens dialog
- [ ] ARIA label present ("Create new job")

**Step 6: Z-index testing**

Test layering:
- [ ] FAB appears above page content
- [ ] Dialog appears above FAB when open
- [ ] Mobile filter sheet doesn't cover FAB

**Step 7: Edge cases**

Test scenarios:
- [ ] FAB works when search is active
- [ ] FAB works when filters are applied
- [ ] FAB works on different department tabs
- [ ] FAB works when navigating between months

---

## Task 5: Final Review and Documentation

**Files:**
- Update: `docs/plans/2026-02-04-project-management-create-job-fab-design.md`

**Step 1: Mark testing checklist complete**

Update the testing checklist in the design document to reflect all completed tests.

**Step 2: Take screenshots (optional)**

If desired, capture screenshots showing:
- FAB on desktop view
- FAB on mobile view
- Dialog opening with pre-populated values

**Step 3: Update CLAUDE.md (if needed)**

If this pattern should be reused elsewhere, add a note to CLAUDE.md:
```markdown
### FAB Pattern
FABs for create actions follow this pattern:
- Fixed position bottom-right
- Uses global dialog stores (e.g., useCreateJobDialogStore)
- Context-aware pre-population
- Permission-gated with canCreateItems or similar
- See ProjectManagement.tsx for reference implementation
```

**Step 4: Final commit**

```bash
git add docs/
git commit -m "docs: update design doc with completed testing"
```

**Step 5: Push and create PR**

```bash
git push origin wt/fab-pm-create
```

Then create a PR to merge `wt/fab-pm-create` into `main` or `dev`.

---

## Implementation Notes

### Key Variables Used
- `canCreateItems`: Boolean computed on line 96, checks user role
- `selectedDepartment`: State from line 32, tracks active department tab
- `currentDate`: State from line 33, tracks month navigation
- `openDialog`: Function from useCreateJobDialogStore, opens global dialog

### Existing Patterns
- Permission checks: Follow pattern from "Auto-Complete Past Jobs" button (line 329)
- Mobile responsiveness: Uses `md:` Tailwind prefix like existing buttons
- Color scheme: `bg-blue-600 hover:bg-blue-500` matches other create buttons

### No Breaking Changes
- Purely additive - no existing code modified except imports
- Uses existing global dialog (no new dialogs created)
- Uses existing permission logic (no new role checks)
- No database changes required
- No API changes required

### Performance Considerations
- FAB is conditionally rendered (only if `canCreateItems`)
- No additional network requests
- Store hook is lightweight (already used globally)
- No re-renders triggered by adding FAB

---

## Rollback Plan

If issues arise, rollback is simple:

```bash
# Revert the commits
git revert HEAD~3..HEAD

# Or reset to before feature
git reset --hard HEAD~3

# Force push if already pushed
git push origin wt/fab-pm-create --force
```

The feature is isolated to ProjectManagement.tsx, so removing it has zero impact on other pages.
