# Invoicing Company Push Notifications - Design

**Date**: 2026-01-02
**Status**: Approved
**Feature**: Push notifications for invoicing company field changes

## Overview

Add push notifications when the `invoicing_company` field on jobs is modified. This ensures management users are immediately notified of billing-related changes.

## Requirements

- Trigger notification whenever `invoicing_company` changes (including initial set, change between values, or clearing)
- Default recipients: Management/admin users (can opt out via push notification matrix)
- Notification language: Spanish
- Notification includes: job title, old company, new company, who made the change
- Deep link: Click notification → opens job details dialog
- Clearing field treated as normal change: "Company X → (ninguna)"

## Design

### 1. Event Definition & Matrix Integration

**Event Code**: `job.invoicing_company.changed`

**Activity Catalog Entry**:
```sql
INSERT INTO activity_catalog (code, label)
VALUES ('job.invoicing_company.changed', 'Invoicing company changed');
```

**Push Notification Matrix**:
- Add to `FALLBACK_EVENTS` array in `src/components/settings/PushNotificationMatrix.tsx`:
  ```typescript
  { code: 'job.invoicing_company.changed', label: 'Invoicing company changed' }
  ```
- Natural recipients: Enabled by default (management/admin users)
- Supports all routing types: broadcast, departments, individual users, assigned technicians

### 2. Trigger Implementation

**Detection Method**: Database trigger on `jobs` table (catches all updates regardless of source)

**Trigger Function** (`supabase/migrations/YYYYMMDDHHMMSS_add_invoicing_company_notification.sql`):
```sql
CREATE OR REPLACE FUNCTION notify_invoicing_company_changed()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key TEXT;
  project_url TEXT;
  actor_id UUID;
  actor_display_name TEXT;
BEGIN
  -- Only proceed if invoicing_company actually changed
  IF (OLD.invoicing_company IS DISTINCT FROM NEW.invoicing_company) THEN

    -- Get service role key and project URL from vault or environment
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
    LIMIT 1;

    -- Get current user (who made the change)
    actor_id := auth.uid();

    -- Get actor's display name
    IF actor_id IS NOT NULL THEN
      SELECT COALESCE(
        NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''),
        nickname,
        email,
        'Usuario'
      ) INTO actor_display_name
      FROM profiles
      WHERE id = actor_id;
    ELSE
      actor_display_name := 'Sistema';
    END IF;

    -- Make HTTP request to push notification function
    PERFORM net.http_post(
      url := project_url || '/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'action', 'broadcast',
        'type', 'job.invoicing_company.changed',
        'job_id', NEW.id,
        'title', NEW.title,
        'actor_id', actor_id,
        'actor_name', actor_display_name,
        'changes', jsonb_build_object(
          'invoicing_company', jsonb_build_object(
            'from', OLD.invoicing_company,
            'to', NEW.invoicing_company
          )
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_invoicing_company_changed
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoicing_company_changed();
```

**Note**: Uses Supabase's `pg_net` extension for HTTP requests and `vault.decrypted_secrets` for secure credential storage.

### 3. Push Notification Handler

**Location**: `supabase/functions/push/broadcast.ts`

**Message Composition** (add new case after other job events):
```typescript
} else if (type === 'job.invoicing_company.changed') {
  const oldCompany = body.changes?.invoicing_company?.from || '(ninguna)';
  const newCompany = body.changes?.invoicing_company?.to || '(ninguna)';

  title = 'Empresa de facturación modificada';
  text = `${actor} cambió la empresa de facturación de "${jobTitle || 'Trabajo'}" de ${oldCompany} a ${newCompany}.`;

  addNaturalRecipients(Array.from(mgmt));
```

**Expected Payload from Trigger**:
- `type`: `'job.invoicing_company.changed'`
- `job_id`: Job ID
- `title`: Job title
- `actor_id`: User who made the change
- `actor_name`: User's display name
- `changes.invoicing_company.from`: Old value (or null)
- `changes.invoicing_company.to`: New value (or null)

### 4. Deep Link Navigation

**Location**: `supabase/functions/push/urls.ts`

**URL Resolution**: Add explicit handling in the job events section (lines 85-92):
```typescript
else if (type === EVENT_TYPES.JOB_CREATED ||
         type === EVENT_TYPES.JOB_UPDATED ||
         type === EVENT_TYPES.JOB_DELETED ||
         type === EVENT_TYPES.JOB_STATUS_CONFIRMED ||
         type === EVENT_TYPES.JOB_STATUS_CANCELLED ||
         type === EVENT_TYPES.JOB_CALLTIME_UPDATED ||
         type === EVENT_TYPES.JOB_REQUIREMENTS_UPDATED ||
         type === 'job.invoicing_company.changed' ||  // NEW
         type?.startsWith('job.type.changed')) {
```

**Navigation Target**:
- Festival jobs: `/festival-management/{jobId}`
- Other job types: `/festival-management/{jobId}?singleJob=true`
- Opens job details dialog on click

**Also add event type constant** in `supabase/functions/push/config.ts`:
```typescript
export const EVENT_TYPES = {
  // ... existing events ...
  JOB_INVOICING_COMPANY_CHANGED: 'job.invoicing_company.changed',
  // ...
};
```

### 5. Example Notification Messages

**Scenario 1**: Production Sector → Sharecable
```
Title: Empresa de facturación modificada
Body: María García cambió la empresa de facturación de "Summer Music Festival" de Production Sector a Sharecable.
```

**Scenario 2**: Initially set
```
Title: Empresa de facturación modificada
Body: Juan López cambió la empresa de facturación de "Corporate Event" de (ninguna) a MFO.
```

**Scenario 3**: Cleared
```
Title: Empresa de facturación modificada
Body: Admin cambió la empresa de facturación de "Test Job" de Sharecable a (ninguna).
```

## Testing Plan

### Manual Testing Steps

1. **Basic change detection**:
   - Create a job without invoicing company
   - Edit job and set invoicing_company to "Production Sector"
   - Verify notification sent with "de (ninguna) a Production Sector"

2. **Company change**:
   - Edit job and change from "Production Sector" to "Sharecable"
   - Verify notification sent with "de Production Sector a Sharecable"

3. **Clear field**:
   - Edit job and clear invoicing_company
   - Verify notification sent with "de Sharecable a (ninguna)"

4. **No change**:
   - Edit job title or other fields (not invoicing_company)
   - Verify NO notification sent

5. **Deep linking**:
   - Click notification
   - Verify job details dialog opens
   - Verify correct job is displayed

6. **Routing matrix**:
   - Navigate to Settings → Push Notification Matrix
   - Verify "Invoicing company changed" event appears
   - Test configuring routing (broadcast, departments, specific users)
   - Verify configured routing is respected

### Edge Cases

- Multiple rapid updates to invoicing_company
- Update when user is not authenticated (system update)
- Job doesn't exist (should fail gracefully)
- Missing profile data for actor

### Verification Commands

```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_invoicing_company_changed';

-- Check activity catalog entry
SELECT * FROM activity_catalog WHERE code = 'job.invoicing_company.changed';

-- Check push notification routes
SELECT * FROM push_notification_routes WHERE event_code = 'job.invoicing_company.changed';
```

## Rollout Plan

### 1. Database Migration
- Create migration file with activity catalog entry and trigger
- Test migration on dev/staging environment
- Deploy to production

### 2. Frontend Updates
- Add event to `FALLBACK_EVENTS` in PushNotificationMatrix.tsx
- Deploy frontend changes

### 3. Backend Updates
- Add broadcast handler case in broadcast.ts
- Add event type constant in config.ts
- Update URL routing in urls.ts
- Deploy edge function updates

### 4. Configuration
- Enable natural recipients for management via push notification matrix
- Optionally configure specific departments or users

### 5. Monitoring
- Monitor Supabase logs for trigger execution
- Check push notification delivery success rate
- Gather user feedback

## Files to Modify

1. `supabase/migrations/YYYYMMDDHHMMSS_add_invoicing_company_notification.sql` (new)
2. `src/components/settings/PushNotificationMatrix.tsx` (add to FALLBACK_EVENTS)
3. `supabase/functions/push/broadcast.ts` (add case for new event)
4. `supabase/functions/push/config.ts` (add EVENT_TYPES constant)
5. `supabase/functions/push/urls.ts` (add to job events list)

## Dependencies

- Supabase `pg_net` extension (for HTTP requests from triggers)
- Supabase Vault (for secure credential storage)
- Existing push notification infrastructure

## Success Metrics

- Notifications delivered within 5 seconds of invoicing company change
- 95%+ delivery success rate
- Zero false positives (notifications only when field actually changes)
- Management users can successfully configure routing preferences

## Future Enhancements

- Multi-language support (if user language preferences added)
- Batch notification digest for multiple changes
- Audit log integration
