# Push Notifications Summary - Recent Additions

## Overview

This document summarizes all the push notification events that have been recently added to the system.

## New Events Added

### 1. Direct Job Assignment (`job.assignment.direct`)

**Purpose:** Notify when management directly assigns a technician to a job through the Assignment Matrix

**Migration:** `20251030100000_add_direct_assignment_push_event.sql`

**Default Recipients:**
- The assigned technician (always)
- Management users (configurable)

**Distinction from existing event:**
- `job.assignment.confirmed` - When technician confirms via staffing workflow
- `job.assignment.direct` - When management directly assigns via matrix

**Documentation:** `/docs/push-notifications-direct-assignments.md`

---

### 2. Job Type Changes (`job.type.changed.*`)

**Purpose:** Notify when a job's type is changed

**Events:**
- `job.type.changed` - General (any type change)
- `job.type.changed.single` - Changed to Single job
- `job.type.changed.tour` - Changed to Tour
- `job.type.changed.festival` - Changed to Festival
- `job.type.changed.dryhire` - Changed to Dry Hire
- `job.type.changed.tourdate` - Changed to Tour Date

**Default Recipients:**
- Management (configurable)
- Job participants (configurable)

---

### 3. Tour Date Type Changes (`tourdate.type.changed.*`)

**Purpose:** Notify when a tour date's type is changed

**Events:**
- `tourdate.type.changed` - General (any type change)
- `tourdate.type.changed.show` - Changed to Show
- `tourdate.type.changed.rehearsal` - Changed to Rehearsal
- `tourdate.type.changed.travel` - Changed to Travel
- `tourdate.type.changed.setup` - Changed to Setup
- `tourdate.type.changed.off` - Changed to Day Off

**Default Recipients:**
- Management (configurable)

**Documentation:** `/docs/push-notifications-tour-date-types.md`

---

## Migration Instructions

Apply all migrations:

```bash
# Apply migrations
npx supabase db push

# Regenerate TypeScript types (if needed)
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Or apply via Supabase Dashboard SQL Editor.

## Configuration

All events are configurable via:

**Settings → Push Notifications**

You can configure:
- Who receives notifications (management users, departments, broadcast)
- Which events trigger notifications
- Natural recipients (participants, assigned users)

## Files Modified

### Database
- `/supabase/migrations/20251030100000_add_direct_assignment_push_event.sql`
- `/supabase/migrations/20251030110000_add_tour_date_type_change_events.sql`

### Backend (Push Function)
- `/supabase/functions/push/index.ts`
  - Added `job.assignment.direct` handler (line ~879-906)
  - Added `tourdate.type.changed.*` handlers (line ~1098-1161)
  - Added `job.type.changed.*` handlers (line ~1162-1207)
  - Updated `BroadcastBody` type with new fields

### Frontend
- `/src/components/matrix/AssignJobDialog.tsx` - Uses `job.assignment.direct`
- `/src/components/settings/PushNotificationMatrix.tsx` - Added all new events to fallback list

### Documentation
- `/docs/push-notifications-direct-assignments.md`
- `/docs/push-notifications-tour-date-types.md`
- `/docs/PUSH_NOTIFICATIONS_SUMMARY.md` (this file)

## Usage Examples

### Direct Assignment Notification
```typescript
await supabase.functions.invoke('push', {
  body: {
    action: 'broadcast',
    type: 'job.assignment.direct',
    job_id: jobId,
    recipient_id: technicianId,
    recipient_name: 'Juan Pérez',
    assignment_status: 'invited', // or 'confirmed'
    target_date: '2025-11-15T00:00:00Z',
    single_day: true
  }
});
```

### Job Type Change Notification
```typescript
await supabase.functions.invoke('push', {
  body: {
    action: 'broadcast',
    type: 'job.type.changed.festival',
    job_id: jobId,
    old_type: 'single',
    new_type: 'festival',
    url: `/jobs/${jobId}`
  }
});
```

### Tour Date Type Change Notification
```typescript
await supabase.functions.invoke('push', {
  body: {
    action: 'broadcast',
    type: 'tourdate.type.changed.show',
    tour_id: tourId,
    tour_date_id: tourDateId,
    tour_name: 'European Tour 2025',
    location_name: 'Palau de la Música',
    old_type: 'rehearsal',
    new_type: 'show',
    url: `/tours/${tourId}`
  }
});
```

## Testing Checklist

- [ ] Migrations applied successfully
- [ ] All events appear in Push Notification Matrix
- [ ] Can configure routing for each event
- [ ] Direct assignments trigger notifications
- [ ] Job type changes trigger notifications
- [ ] Tour date type changes trigger notifications
- [ ] Spanish messages display correctly
- [ ] Deep links work correctly
- [ ] Natural recipients receive notifications
- [ ] Configured recipients receive notifications

## Event Counts

**Total new events added:** 17

- Direct assignment: 1 event
- Job type changes: 6 events (1 general + 5 specific)
- Tour date type changes: 6 events (1 general + 5 specific)
- Already existed in fallback: 4 events

## Recipients Configuration

All events support the following recipient configurations:

1. **Natural Recipients** - Default participants based on context
2. **Management Users** - Specific management users
3. **Departments** - All users in a department
4. **Broadcast** - All management users
5. **Custom Routes** - Mix and match above

## Notes

- All notifications are **non-blocking** - if they fail, the operation still succeeds
- Notifications are sent to all logged-in devices
- Spanish translations are built into the push function
- Events respect configured push notification routes
- All changes are logged in the activity log regardless of push notifications

## Support

For questions or issues:
1. Review the specific documentation files
2. Check the migration SQL for schema details
3. Test with small datasets first
4. Verify push notification routes are configured correctly
