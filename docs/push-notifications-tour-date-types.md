# Push Notifications for Type Changes (Jobs & Tour Dates)

## Overview

New configurable push notification events have been added for **type changes** on both jobs and tour dates. This allows you to control who receives notifications when:
- **Job types** change (Single, Tour, Festival, Dry Hire, Tour Date)
- **Tour date types** change (Show, Rehearsal, Travel, Setup, Day Off)

## Event Details

### Job Type Events

**General Event:**
- **Code:** `job.type.changed`
- **Label:** "Job type changed"
- **Default Visibility:** Management

**Specific Job Type Events:**

| Event Code | Event Label | Description |
|------------|-------------|-------------|
| `job.type.changed.single` | Job changed to Single | Notifies when job becomes a single job |
| `job.type.changed.tour` | Job changed to Tour | Notifies when job becomes a tour job |
| `job.type.changed.festival` | Job changed to Festival | Notifies when job becomes a festival |
| `job.type.changed.dryhire` | Job changed to Dry Hire | Notifies when job becomes a dry hire |
| `job.type.changed.tourdate` | Job changed to Tour Date | Notifies when job becomes a tour date |

### Tour Date Type Events

**General Event:**
- **Code:** `tourdate.type.changed`
- **Label:** "Tour date type changed"
- **Default Visibility:** Management

**Specific Tour Date Type Events:**

| Event Code | Event Label | Description |
|------------|-------------|-------------|
| `tourdate.type.changed.show` | Tour date changed to Show | Notifies when a date becomes a show date |
| `tourdate.type.changed.rehearsal` | Tour date changed to Rehearsal | Notifies when a date becomes a rehearsal |
| `tourdate.type.changed.travel` | Tour date changed to Travel | Notifies when a date becomes a travel day |
| `tourdate.type.changed.setup` | Tour date changed to Setup | Notifies when a date becomes a setup date |
| `tourdate.type.changed.off` | Tour date changed to Day Off | Notifies when a date becomes a day off |

## Push Notification Messages

### Job Type Notifications (Spanish)

**Title Formats:**
- "Trabajo cambiado a Individual" (Single)
- "Trabajo cambiado a Gira" (Tour)
- "Trabajo cambiado a Festival" (Festival)
- "Trabajo cambiado a Alquiler seco" (Dry Hire)
- "Trabajo cambiado a Fecha de gira" (Tour Date)

**Message Format:**
```
[Manager] cambió "[Job Title]" a [Type].
```

**Example:**
> **Trabajo cambiado a Festival**
> Juan Pérez cambió "Primavera Sound 2025" a Festival.

### Tour Date Type Notifications (Spanish)

**Title Formats:**
- "Fecha cambiada a Concierto" (Show)
- "Fecha cambiada a Ensayo" (Rehearsal)
- "Fecha cambiada a Viaje" (Travel)
- "Fecha cambiada a Montaje" (Setup)
- "Fecha cambiada a Día libre" (Day Off)

**Message Format:**
```
[Manager] cambió "[Location]" a [Type] en "[Tour Name]".
```

**Example:**
> **Fecha cambiada a Concierto**
> Juan Pérez cambió "Palau de la Música" a Concierto en "European Tour 2025".

## Configuration

### Push Notification Matrix

Navigate to **Settings** → **Push Notifications** to configure routing for these events.

**Available Options:**

1. **General Type Changes** (`tourdate.type.changed`)
   - Get notified for ANY type change
   - Use when you want to know about all changes regardless of type

2. **Specific Type Changes**
   - Configure individually for each type
   - Example: Only notify when dates change to "Show"
   - More granular control over notifications

### Example Configurations

#### Configuration 1: Notify management about all type changes
```
Event: tourdate.type.changed
Recipients: ✅ All Management
```

#### Configuration 2: Notify only when dates become Shows
```
Event: tourdate.type.changed.show
Recipients: ✅ All Management
```

#### Configuration 3: Notify specific department for setup changes
```
Event: tourdate.type.changed.setup
Recipients: ✅ Department: Production
```

#### Configuration 4: Notify everyone about day off changes
```
Event: tourdate.type.changed.off
Recipients: ✅ Broadcast to all management
```

## How to Trigger These Events

### From Job Management

When updating a job's type field, call the push notification function:

```typescript
// Example: When updating a job type
const oldType = job.job_type; // 'single'
const newType = 'festival'; // new type

// Update the job in the database
const { error } = await supabase
  .from('jobs')
  .update({ job_type: newType })
  .eq('id', jobId);

if (!error) {
  // Send push notification
  try {
    await supabase.functions.invoke('push', {
      body: {
        action: 'broadcast',
        type: `job.type.changed.${newType}`, // or 'job.type.changed' for general
        job_id: jobId,
        old_type: oldType,
        new_type: newType,
        url: `/jobs/${jobId}`
      }
    });
  } catch (err) {
    // Non-blocking - notification failure doesn't affect the update
    console.error('Failed to send push notification:', err);
  }
}
```

### From Tour Date Management

When updating a tour date's type field, call the push notification function:

```typescript
// Example: When updating a tour date type
const oldType = tourDate.tour_date_type; // 'rehearsal'
const newType = 'show'; // new type

// Update the tour date in the database
const { error } = await supabase
  .from('tour_dates')
  .update({ tour_date_type: newType })
  .eq('id', tourDateId);

if (!error) {
  // Send push notification
  try {
    await supabase.functions.invoke('push', {
      body: {
        action: 'broadcast',
        type: `tourdate.type.changed.${newType}`, // or 'tourdate.type.changed' for general
        tour_id: tourId,
        tour_date_id: tourDateId,
        tour_name: tourName,
        location_name: locationName,
        old_type: oldType,
        new_type: newType,
        url: `/tours/${tourId}`
      }
    });
  } catch (err) {
    // Non-blocking - notification failure doesn't affect the update
    console.error('Failed to send push notification:', err);
  }
}
```

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | ✅ | Must be `'broadcast'` |
| `type` | string | ✅ | Event code (e.g., `'tourdate.type.changed.show'`) |
| `tour_id` | string | ❌ | Tour UUID |
| `tour_date_id` | string | ❌ | Tour date UUID |
| `tour_name` | string | ❌ | Tour name for display |
| `location_name` | string | ❌ | Location/venue name |
| `old_type` | string | ❌ | Previous type ('show', 'rehearsal', etc.) |
| `new_type` | string | ❌ | New type ('show', 'rehearsal', etc.) |
| `url` | string | ❌ | Deep link URL (defaults to `/tours/{tour_id}`) |

## Type Mappings

### Database Values → Spanish Labels

| Database Value | Spanish Label |
|----------------|---------------|
| `show` | Concierto |
| `rehearsal` | Ensayo |
| `travel` | Viaje |
| `setup` | Montaje |
| `off` | Día libre |

## Migration

The database migration is located at:
```
/supabase/migrations/20251030110000_add_tour_date_type_change_events.sql
```

To apply:
```bash
npx supabase db push
```

Or apply directly via the Supabase dashboard SQL editor.

## Integration Points

### Where to Add Notification Calls

**1. Tour Date Management Dialog**
- File: `/src/components/tours/TourDateManagementDialog.tsx`
- When: User changes the type dropdown

**2. Tour Date Form Fields**
- File: `/src/components/tours/TourDateFormFields.tsx`
- When: Type selection changes and is saved

**3. Bulk Operations**
- When: Multiple tour dates have their types changed at once
- Use the general `tourdate.type.changed` event

**4. API/Backend Updates**
- When: Tour dates are updated programmatically
- Trigger appropriate notifications

## Testing

### Test Push Notification

1. **Apply the migration:**
   ```bash
   npx supabase db push
   ```

2. **Configure routing:**
   - Go to **Settings** → **Push Notifications**
   - Find "Tour date type changed" events
   - Configure who receives notifications

3. **Test the notification:**
   - Open a tour with dates
   - Change a tour date's type
   - Check for push notification on all logged-in devices

### Verification Checklist

- [ ] Migration applied successfully
- [ ] Events appear in Push Notification Matrix
- [ ] Can configure routing for each event
- [ ] Notifications received when type changes
- [ ] Spanish messages display correctly
- [ ] Deep links work to tour page

## Use Cases

### Use Case 1: Production Manager Tracking
**Scenario:** Production manager wants to know immediately when any date changes to "Setup"

**Configuration:**
```
Event: tourdate.type.changed.setup
Recipients: Production Department Management
```

### Use Case 2: Tour Coordinator Overview
**Scenario:** Tour coordinator wants to track all type changes for planning

**Configuration:**
```
Event: tourdate.type.changed
Recipients: Specific User (Tour Coordinator)
```

### Use Case 3: Team-wide Show Alerts
**Scenario:** Everyone needs to know when a new show is added (date changed to Show)

**Configuration:**
```
Event: tourdate.type.changed.show
Recipients: Broadcast to all management
```

## Related Files

**Frontend:**
- `/src/components/tours/TourDateManagementDialog.tsx` - Where to trigger events
- `/src/components/tours/TourDateFormFields.tsx` - Type selection UI
- `/src/components/settings/PushNotificationMatrix.tsx` - Configuration UI

**Backend:**
- `/supabase/functions/push/index.ts` - Event handlers (lines 1098-1158)
- `/supabase/migrations/20251030110000_add_tour_date_type_change_events.sql` - Database schema

**Types:**
- Event type: `BroadcastBody.type = 'tourdate.type.changed.*'`
- Includes: `location_name`, `old_type`, `new_type`, `tour_name`

## Notes

- Notifications are **non-blocking** - if they fail, the type change still succeeds
- Use specific events for granular control, general event for broad monitoring
- Default recipients are management users (configurable)
- All type changes are logged in the activity log regardless of push notifications
- Spanish translations are built into the push function handler
