# Push Notification Triggers - Implementation Summary

## Overview

Push notification triggers have been added to automatically send notifications when job types or tour date types are changed in the UI.

## Changes Made

### 1. Job Type Changes (EditJobDialog.tsx)

**File:** `/src/components/jobs/EditJobDialog.tsx`

**Lines:** 228-260

**What was added:**
- Detection of job type changes when editing a job
- Automatic push notification when job type changes
- Sends event type: `job.type.changed.{newType}` (e.g., `job.type.changed.festival`)

**Code added:**
```typescript
// Send specific job type change notification if job type changed
if (jobTypeChanged && job.job_type && jobType) {
  void supabase.functions.invoke('push', {
    body: {
      action: 'broadcast',
      type: `job.type.changed.${jobType}`,
      job_id: job.id,
      old_type: job.job_type,
      new_type: jobType,
      url: `/jobs/${job.id}`
    }
  });
}
```

**When triggered:**
- User edits a job in the EditJobDialog
- Changes the "Job Type" field (e.g., from "Single" to "Festival")
- Clicks "Save"
- Push notification is sent immediately after successful database update

---

### 2. Tour Date Type Changes (TourDateManagementDialog.tsx)

**File:** `/src/components/tours/TourDateManagementDialog.tsx`

**Lines:** 720-739

**What was added:**
- Detection of tour date type changes when editing a tour date
- Automatic push notification when tour date type changes
- Sends event type: `tourdate.type.changed.{newType}` (e.g., `tourdate.type.changed.show`)

**Code added:**
```typescript
// Send push notification if tour date type changed
if (editingTourDate && editingTourDate.tour_date_type !== tourDateType) {
  try {
    void supabase.functions.invoke('push', {
      body: {
        action: 'broadcast',
        type: `tourdate.type.changed.${tourDateType}`,
        tour_id: tourId,
        tour_date_id: dateId,
        tour_name: tourData.name,
        location_name: newLocation || updatedDate?.location?.name || '',
        old_type: editingTourDate.tour_date_type,
        new_type: tourDateType,
        url: `/tours/${tourId}`
      }
    });
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}
```

**When triggered:**
- User edits a tour date in the TourDateManagementDialog
- Changes the "Type" field (e.g., from "Rehearsal" to "Show")
- Clicks "Save" or confirms the edit
- Push notification is sent immediately after successful database update

---

## Payload Structure

### Job Type Change Notification

```typescript
{
  action: 'broadcast',
  type: 'job.type.changed.{newType}',  // e.g., 'job.type.changed.festival'
  job_id: string,                       // UUID of the job
  old_type: string,                     // Previous job type ('single', 'tour', etc.)
  new_type: string,                     // New job type ('single', 'tour', etc.)
  url: string                           // Deep link to job page
}
```

### Tour Date Type Change Notification

```typescript
{
  action: 'broadcast',
  type: 'tourdate.type.changed.{newType}', // e.g., 'tourdate.type.changed.show'
  tour_id: string,                          // UUID of the tour
  tour_date_id: string,                     // UUID of the tour date
  tour_name: string,                        // Name of the tour
  location_name: string,                    // Location/venue name
  old_type: string,                         // Previous type ('show', 'rehearsal', etc.)
  new_type: string,                         // New type ('show', 'rehearsal', etc.)
  url: string                               // Deep link to tour page
}
```

---

## Push Function Handlers

The push function (`/supabase/functions/push/index.ts`) already has handlers for these events:

**Job Type Changes:** Lines 1162-1207
- Handles: `job.type.changed`, `job.type.changed.single`, `job.type.changed.tour`, `job.type.changed.festival`, `job.type.changed.dryhire`, `job.type.changed.tourdate`

**Tour Date Type Changes:** Lines 1102-1161
- Handles: `tourdate.type.changed`, `tourdate.type.changed.show`, `tourdate.type.changed.rehearsal`, `tourdate.type.changed.travel`, `tourdate.type.changed.setup`, `tourdate.type.changed.off`

---

## Testing

### Test Job Type Change

1. Open any job
2. Click "Edit"
3. Change the "Job Type" from one type to another (e.g., Single → Festival)
4. Click "Save"
5. ✅ Push notification should appear on all logged-in devices

**Expected notification:**
> **Trabajo cambiado a Festival**
> [Your Name] cambió "[Job Title]" a Festival.

### Test Tour Date Type Change

1. Open a tour
2. Find a tour date and click edit
3. Change the "Type" from one type to another (e.g., Rehearsal → Show)
4. Click "Save"
5. ✅ Push notification should appear on all logged-in devices

**Expected notification:**
> **Fecha cambiada a Concierto**
> [Your Name] cambió "[Location]" a Concierto en "[Tour Name]".

---

## Configuration

Recipients for these notifications are configurable via:

**Settings → Push Notifications**

Find these events:
- "Job type changed" + specific type events
- "Tour date type changed" + specific type events

Configure who receives notifications:
- All management
- Specific departments
- Specific users
- Job participants (for job changes)

---

## Error Handling

Both implementations include error handling:

- Notifications are **non-blocking** - if they fail, the job/tour date update still succeeds
- Errors are logged to console but don't interrupt the user workflow
- Uses `void` keyword to explicitly ignore promise results
- Wrapped in try-catch blocks

---

## Notes

- Notifications are sent **immediately after** the database update succeeds
- Both `job.updated` and `job.type.changed.*` notifications are sent when job type changes (general + specific)
- Only sends notification if the type **actually changed** (not on other edits)
- Requires push function to be deployed with the new handlers
- Requires database migration to be applied for events to appear in settings

---

## Deployment Checklist

- [x] Frontend code updated (EditJobDialog.tsx, TourDateManagementDialog.tsx)
- [ ] Database migration applied (`npx supabase db push`)
- [ ] Push function deployed (`npx supabase functions deploy push`)
- [ ] Configure notification routing in Settings → Push Notifications
- [ ] Test job type change notification
- [ ] Test tour date type change notification
