# Push Notifications for Direct Assignments

## Overview

A new configurable push notification event has been added for **direct job assignments**. This allows you to control who receives notifications when management directly assigns technicians to jobs through the Assignment Matrix.

## Event Details

**Event Code:** `job.assignment.direct`
**Event Label:** "Direct job assignment"

## What's New

### 1. New Database Event

A new event has been added to the `activity_catalog` table:

```sql
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'job.assignment.direct',
  'Direct job assignment',
  'job_participants',
  'success',
  TRUE,
  '{actor_name} directly assigned {tech_name} to {job_title}'
);
```

### 2. Push Notification Handler

The push notification function now handles the `job.assignment.direct` event with Spanish messaging:

**Notification Title:** "Nueva asignación" (New assignment)

**Message Format:**
- If confirmed: `[Manager] te ha confirmado a "[Job Title]" para [Date]`
- If invited: `[Manager] te ha asignado a "[Job Title]" para [Date]`

**Default Recipients:**
- The assigned technician (always)
- Management users (configurable via Push Notification Matrix)

### 3. Updated Components

**AssignJobDialog** (`/src/components/matrix/AssignJobDialog.tsx`):
- Now sends `job.assignment.direct` event when creating assignments
- Includes `assignment_status` field to differentiate between "confirmed" and "invited" assignments

## Event Distinction

### `job.assignment.confirmed` (Existing)
- **Trigger:** When a technician **confirms** an assignment through the staffing workflow (via email/WhatsApp link)
- **Use case:** Technician-initiated confirmation
- **Notification:** "Asignación confirmada"

### `job.assignment.direct` (New)
- **Trigger:** When management **directly assigns** a technician through the Assignment Matrix
- **Use case:** Management-initiated assignment
- **Notification:** "Nueva asignación"

## Configuration

### Push Notification Matrix

Navigate to **Settings** → **Push Notifications** to configure routing for this event.

**Available Options:**

1. **Natural Recipients** (Default)
   - Assigned technician receives notification
   - Management users receive notification

2. **Custom Routing**
   - Target specific management users
   - Target specific departments
   - Broadcast to all management
   - Exclude natural recipients if needed

### Example Configurations

#### Configuration 1: Notify only the assigned technician
- ✅ Natural recipients: **Enabled**
- ⚠️ Remove all management routing rules

#### Configuration 2: Notify technician + specific department managers
- ✅ Natural recipients: **Enabled**
- ✅ Department: **Sound** (only sound managers get notified)

#### Configuration 3: Notify everyone in management
- ✅ Natural recipients: **Enabled**
- ✅ Broadcast to all management

## Testing

### Test Push Notification

1. Go to **Settings** → **Push Notifications**
2. Enable notifications if not already enabled
3. Navigate to the **Assignment Matrix**
4. Directly assign a technician to a job
5. Check for push notification on all logged-in devices

### Verify Event in Matrix

1. Go to **Settings** → **Push Notifications**
2. Find "Direct job assignment" in the event list
3. Configure routing as needed
4. Save changes

## Migration

The database migration is located at:
```
/supabase/migrations/20251030100000_add_direct_assignment_push_event.sql
```

To apply:
```bash
npx supabase db push
```

Or apply directly via the Supabase dashboard SQL editor.

## Related Files

**Frontend:**
- `/src/components/matrix/AssignJobDialog.tsx` - Sends the event
- `/src/components/settings/PushNotificationMatrix.tsx` - Configuration UI

**Backend:**
- `/supabase/functions/push/index.ts` - Event handler
- `/supabase/migrations/20251030100000_add_direct_assignment_push_event.sql` - Database schema

**Types:**
- Event type: `BroadcastBody.type = 'job.assignment.direct'`
- Includes: `assignment_status?: 'confirmed' | 'invited'`

## Notes

- This event is **non-blocking** - if push notification fails, the assignment still succeeds
- Notifications are sent to all devices where the user is logged in
- The event respects all configured push notification routes in the database
- Assignments created via the staffing workflow (email/WhatsApp) continue to use `job.assignment.confirmed`
