# Pending Tasks Modal - QA Testing Guide

## Overview
The Pending Tasks Modal feature automatically displays incomplete tasks assigned to management/admin/logistics users upon login.

## Feature Components
1. **Database View**: `pending_tasks_view` - Aggregates pending tasks from sound/lights/video task tables
2. **React Query Hook**: `usePendingTasks` - Fetches and groups pending tasks by job/tour
3. **Modal Component**: `PendingTasksModal` - Displays tasks in an organized, navigable format
4. **Layout Integration**: Manages modal state and session-based dismissal

## Manual QA Test Cases

### Test 1: Modal Auto-Display for Eligible Users
**Scenario**: Management/admin/logistics user with pending tasks logs in

**Steps**:
1. Create a test user with role `management`, `admin`, or `logistics`
2. Assign at least one incomplete task to this user (status: `not_started` or `in_progress`)
3. Log in as this user
4. Observe the UI after login

**Expected Result**:
- Modal appears automatically ~500ms after login
- Modal title shows "Pending Tasks" with task count badge
- Tasks are grouped by job/tour
- Each task shows:
  - Department badge (sound/lights/video)
  - Task type
  - Status (Not Started/In Progress)
  - Progress bar with percentage
  - Due date (if set) with relative time display
  - "View" button for navigation

### Test 2: No Modal for Technicians
**Scenario**: Technician or house_tech user logs in

**Steps**:
1. Log in as a user with role `technician` or `house_tech`
2. Observe the UI

**Expected Result**:
- Modal does NOT appear
- No pending tasks are fetched (query is disabled)

### Test 3: Dismissal Persistence Within Session
**Scenario**: User dismisses modal and navigates around the app

**Steps**:
1. Log in as eligible user with pending tasks
2. When modal appears, click X or outside modal to close
3. Navigate to different pages within the app
4. Refresh the page (F5 or browser refresh)

**Expected Result**:
- Modal does not reappear after dismissal
- Modal stays hidden after page refresh within same session
- Modal stays hidden when navigating between pages

### Test 4: New Task Assignment Detection
**Scenario**: New task is assigned after modal dismissal

**Steps**:
1. Log in as eligible user with 2 pending tasks
2. Dismiss the modal
3. Have another user (or via database) assign a new task to the logged-in user
4. Wait for the query to refetch (or force refresh)

**Expected Result**:
- Modal automatically reopens when new tasks are detected
- Task count increases in the badge
- New task appears in the list

### Test 5: Session Reset on New Login
**Scenario**: User logs out and logs back in

**Steps**:
1. Log in as eligible user with pending tasks
2. Dismiss the modal
3. Log out
4. Log back in

**Expected Result**:
- Modal appears again on new login (sessionStorage is cleared)
- Fresh task data is loaded

### Test 6: Empty State Display
**Scenario**: Eligible user has no pending tasks

**Steps**:
1. Log in as eligible user with NO pending tasks assigned
2. Observe the behavior

**Expected Result**:
- Modal does NOT appear automatically
- If manually triggered (future feature), shows empty state message:
  - Icon indicator
  - "No pending tasks" heading
  - "You're all caught up!" description

### Test 7: Navigation from Modal
**Scenario**: User clicks "View" button on a task

**Steps**:
1. Log in as eligible user with pending tasks
2. Click "View" button on a job task
3. Verify navigation to `/job-management/:jobId`
4. Return and click "View" on a tour task
5. Verify navigation to `/tour-management/:tourId`

**Expected Result**:
- Navigation works correctly
- Modal closes upon navigation
- Correct job/tour detail page is displayed

### Test 8: Loading State
**Scenario**: Observe modal while data is loading

**Steps**:
1. Log in as eligible user
2. If network is slow, observe the modal loading state
3. Or use browser dev tools to throttle network

**Expected Result**:
- Loading spinner with "Loading pending tasks..." message
- No flashing or jarring UI transitions

### Test 9: Error Handling
**Scenario**: Database error or network failure

**Steps**:
1. Log in as eligible user
2. Simulate network error (disconnect or block Supabase requests)
3. Observe modal behavior

**Expected Result**:
- Error message displayed: "Failed to load pending tasks. Please try again later."
- Red/destructive styling with alert icon
- Modal doesn't crash the app

### Test 10: Multiple Jobs/Tours
**Scenario**: User has tasks across multiple jobs and tours

**Steps**:
1. Assign tasks to user across:
   - 2 different jobs
   - 1 tour
   - Mix of departments (sound, lights, video)
2. Log in as this user

**Expected Result**:
- Tasks are grouped by job/tour
- Each group shows:
  - Type badge (JOB/TOUR)
  - Name and client (for jobs)
  - Task count
  - Expandable task list
- Tasks within group show all details correctly

### Test 11: Due Date Highlighting
**Scenario**: Tasks with overdue dates

**Steps**:
1. Assign tasks with:
   - Due date in the past (overdue)
   - Due date today
   - Due date in future
   - No due date
2. Log in and view modal

**Expected Result**:
- Overdue tasks show due date in red/destructive color
- Future tasks show muted color
- All show relative time (e.g., "2 days ago", "in 3 days")
- Tasks without due date show "-"

### Test 12: Department Badge Styling
**Scenario**: Verify department badge colors

**Expected Result**:
- Sound: Blue badge
- Lights: Amber/yellow badge
- Video: Purple badge

### Test 13: Status Badge Styling
**Scenario**: Verify status indicators

**Expected Result**:
- "Not Started": Gray badge
- "In Progress": Orange badge
- Progress bar shows correct percentage

## Session Storage Keys
The feature uses these sessionStorage keys (keyed by userId):
- `pending_tasks_dismissed_<userId>`: Tracks if modal was dismissed
- `pending_tasks_dismissed_<userId>_count`: Tracks task count at dismissal

## Database View Query
Check that the view exists:
```sql
SELECT * FROM pending_tasks_view WHERE assigned_to = '<user_id>';
```

## Future Enhancements (Not in Current Scope)
- Manual button to reopen modal
- Filter/sort tasks within modal
- Mark tasks as complete from modal
- Notification badge showing pending count
- Priority sorting
