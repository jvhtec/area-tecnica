# Activity / Audit Logging

> Platform-wide event logging with realtime toasts, visibility controls, and read tracking.

## Overview

The activity system logs all significant platform events (job creation, assignments, timesheet submissions, staffing campaigns, etc.) and delivers them as realtime toast notifications and in an admin-facing activity feed.

## Key Files

| Category | Path |
|----------|------|
| **API layer** | `src/features/activity/api.ts` |
| **Event catalog** | `src/features/activity/catalog.ts` (7.2KB) |
| **Types** | `src/features/activity/types.ts` |
| **Realtime hook** | `src/features/activity/hooks/useActivityRealtime.ts` |
| **Page** | `src/pages/ActivityCenter.tsx` (admin/management only) |

## Database Tables

| Table | Purpose |
|-------|---------|
| `activity_log` | Event records (code, job_id, actor_id, actor_name, entity_type, entity_id, visibility, payload, created_at) |
| `activity_reads` | Read tracking (user_id, activity_id) |
| `activity_prefs` | User preferences (muted_codes array, mute_toasts boolean) |

## Event Catalog (30+ Event Types)

### Job Events
`job.created`, `job.updated`, `job.requirements.updated`, `job.deleted`, `job.calltime.updated`

### Document Events
`document.uploaded`, `document.deleted`

### Festival Events
`festival.public_form.submitted`, `festival.public_rider.uploaded`

### Assignment Events
`assignment.created`, `assignment.updated`, `assignment.removed`

### Staffing Events
`staffing.availability.sent`, `staffing.availability.confirmed`, `staffing.availability.declined`
`staffing.offer.sent`, `staffing.offer.confirmed`, `staffing.offer.declined`

### Timesheet Events
`timesheet.submitted`, `timesheet.approved`, `timesheet.rejected`

### Infrastructure Events
`flex.folders.created`, `flex.crew.updated`, `hoja.updated`

### Other Events
`announcement.posted`, `calendar.exported`, `availability.unavailable.created/updated/deleted`

## Visibility Levels

Each event has a visibility level controlling who sees it:

| Level | Who sees it |
|-------|-------------|
| `management` | Admin and management users only |
| `house_plus_job` | House techs + users assigned to the job |
| `job_participants` | Only users assigned to the specific job |
| `actor_only` | Only the user who performed the action |

## Workflow

```text
1. EVENT OCCURS → RPC log_activity() inserts row with code, context, visibility, payload
2. SUPABASE TRIGGER → broadcasts to push function
3. REALTIME → useActivityRealtime subscribes to activity_log INSERT events
4. TOAST MAPPING → mapToast() renders severity-appropriate toast (info/success/warn/error)
5. PREFERENCES CHECK → skip if code is in user's muted_codes or mute_toasts is true
6. READ TRACKING → markActivityRead() upserts to activity_reads
7. ACTIVITY CENTER → admin page lists recent activities with timestamps and payloads
```

## User Preferences

- **Muted codes**: Array of event type codes the user doesn't want to see
- **Mute toasts**: Boolean to disable all toast notifications
- Managed via `activity_prefs` table

## Integration Points

- **Push Notifications**: Activity events trigger push notifications via the `push/` edge function
- **All Subsystems**: Events logged by jobs, assignments, timesheets, staffing, festivals, Flex, etc.
- **Toast System**: Uses sonner for realtime toast display with severity-based styling
