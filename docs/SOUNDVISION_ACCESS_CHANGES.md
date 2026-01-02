# SoundVision Access Grant Workflow - Implementation Summary

## Overview
This implementation extends the messages system to support SoundVision access request workflows, allowing technicians to request access and management to approve requests directly from the message interface.

## Changes Made

### 1. Database Migration
**File**: `supabase/migrations/20260212000000_add_messages_metadata.sql`
- Added `metadata` JSONB column to the `messages` table
- Supports structured message types (e.g., SoundVision access requests)

### 2. Type Definitions

#### `src/components/messages/types.ts`
- Added `MessageMetadata` interface:
  ```typescript
  interface MessageMetadata {
    type?: 'soundvision_access_request';
    vacation_request_id?: string;
  }
  ```
- Updated `Message` interface to include optional `metadata` field

#### `src/integrations/supabase/types.ts`
- Updated `messages` table types to include `metadata: Json | null` field in Row, Insert, and Update types

### 3. UI Components

#### `src/components/messages/MessageCard.tsx`
- Added imports: `UserCheck` icon, `Badge` component
- Added `onGrantSoundVisionAccess` prop to component interface
- Detects SoundVision access request messages via `metadata.type`
- Displays "SoundVision Access Request" badge for these messages
- Renders "Grant SoundVision Access" button for management users
- Button triggers grant handler with message ID and vacation request ID

### 4. Business Logic

#### `src/components/messages/hooks/useMessageOperations.ts`
- Added `useQueryClient` import from `@tanstack/react-query`
- Implemented `handleGrantSoundVisionAccess` function:
  - Validates authentication
  - Fetches vacation request to get technician ID
  - Safeguard: Checks if request already approved (prevents duplicate grants)
  - Updates `profiles.soundvision_access_enabled = true`
  - Approves vacation request with `approved_by` and `approved_at` timestamps
  - Marks message as read
  - Invalidates messages and vacation_requests queries
  - Dispatches `messages_invalidated` event for multi-tab coordination
  - Shows success/error toast notifications
- Returns new handler in hook's return object

#### `src/components/messages/MessagesList.tsx`
- Destructures `handleGrantSoundVisionAccess` from `useMessageOperations`
- Passes handler to `MessageCard` components via `onGrantSoundVisionAccess` prop

#### `src/components/messages/hooks/useMessagesQuery.ts`
- Updated query to explicitly select `metadata` field from messages table

#### `src/lib/vacation-requests.ts`
- Added `submitSoundVisionAccessRequest` function to `vacationRequestsApi`:
  - Creates vacation request with today's date (start_date = end_date = today)
  - Sets status to 'pending'
  - Fetches requester's profile information
  - Creates message with structured metadata linking to vacation request
  - Returns created vacation request

### 5. Documentation
**File**: `docs/soundvision-access-workflow.md`
- Comprehensive documentation of the workflow
- Usage examples for requesting and granting access
- Database schema details
- Component descriptions
- Testing guidelines

## Workflow Summary

1. **Request Submission** (Technician):
   ```typescript
   await vacationRequestsApi.submitSoundVisionAccessRequest(
     "Reason for needing access",
     "sound"
   );
   ```
   - Creates vacation_request with status='pending'
   - Creates message with metadata linking to vacation_request

2. **Review** (Management):
   - Views message with special badge indicating it's a SoundVision access request
   - Sees requester details and submitted note
   - Click "Grant SoundVision Access" button

3. **Grant** (System):
   - Validates request hasn't already been approved
   - Sets `profiles.soundvision_access_enabled = true`
   - Updates vacation_request: status='approved', approved_by, approved_at
   - Marks message as read
   - Invalidates queries and dispatches events
   - Shows success toast

## Safeguards
- Duplicate grant prevention (checks if already approved)
- Authentication validation
- Error handling with user feedback
- RLS policies (management-only access)
- Query invalidation for data consistency

## Testing
Run TypeScript check:
```bash
npx tsc --noEmit
```

Result: ✅ No errors

## Migration Required
Before deploying, run the migration:
```bash
supabase db push
```

Or for production:
```bash
supabase db push --db-url <production-db-url>
```
