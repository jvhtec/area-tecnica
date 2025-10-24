# SoundVision Access Grant Workflow

## Overview

The SoundVision access grant workflow allows technicians to request access to SoundVision features, and enables management to review and approve these requests through the messaging system.

## Components

### 1. Message Types

Messages now support structured metadata to identify special message types:

```typescript
interface MessageMetadata {
  type?: 'soundvision_access_request';
  vacation_request_id?: string;
}
```

### 2. Requesting Access

Technicians can submit a SoundVision access request using the `vacationRequestsApi`:

```typescript
import { vacationRequestsApi } from '@/lib/vacation-requests';

// Submit a SoundVision access request
await vacationRequestsApi.submitSoundVisionAccessRequest(
  "I need access to SoundVision to review project files for upcoming events.",
  "sound" // department
);
```

This creates:
- A `vacation_requests` entry with status 'pending'
- A department message with `metadata.type = 'soundvision_access_request'`

### 3. Management Review

When management views messages, SoundVision access request messages are automatically identified and rendered with:
- A "SoundVision Access Request" badge
- The requester's details (name, department)
- The submitted note/reason
- A "Grant SoundVision Access" button

### 4. Granting Access

When a manager clicks "Grant SoundVision Access", the system:

1. **Validates** - Checks if the request has already been approved
2. **Updates Profile** - Sets `profiles.soundvision_access_enabled = true` for the requester
3. **Approves Request** - Updates the `vacation_requests` row:
   - `status = 'approved'`
   - `approved_by = <current_user_id>`
   - `approved_at = <timestamp>`
4. **Marks Message as Read** - Updates message status
5. **Invalidates Queries** - Refreshes messages and vacation_requests data
6. **Shows Toast** - Displays success feedback to the manager

### 5. Safeguards

- **Duplicate Prevention**: The handler checks if the request is already approved before processing
- **Permission Checks**: Only management can grant access (enforced by UI and RLS policies)
- **Atomic Operations**: All database updates are performed with proper error handling
- **Clear Feedback**: Toast notifications inform users of success or failure

## Database Schema

### Messages Table

Added `metadata` column:
```sql
ALTER TABLE public.messages ADD COLUMN metadata jsonb;
```

### Vacation Requests Table

Reused for access requests with:
- `status`: 'pending' | 'approved' | 'rejected'
- `approved_by`: User ID who granted access
- `approved_at`: Timestamp of approval
- `reason`: Technician's request note

### Profiles Table

- `soundvision_access_enabled`: Boolean flag for SoundVision access

## UI Components

### MessageCard

Enhanced to:
- Detect SoundVision access request messages via metadata
- Display badge and special formatting
- Render "Grant SoundVision Access" button for management

### useMessageOperations Hook

Added `handleGrantSoundVisionAccess` function that orchestrates the approval workflow.

## Example Usage Flow

1. **Technician submits request**:
   ```typescript
   await vacationRequestsApi.submitSoundVisionAccessRequest(
     "Need access for Q1 2025 projects"
   );
   ```

2. **Management views messages**: Sees request with badge and grant button

3. **Management clicks "Grant Access"**: System updates profile, approves request, marks message as read

4. **Technician gains access**: `soundvision_access_enabled` flag is now true

## Testing

To test the workflow:

1. Create a test message with metadata:
   ```typescript
   await supabase.from('messages').insert({
     content: "Test SoundVision access request",
     department: "sound",
     sender_id: "<tech_user_id>",
     metadata: {
       type: 'soundvision_access_request',
       vacation_request_id: "<vacation_request_id>"
     }
   });
   ```

2. Log in as management and view the message
3. Click "Grant SoundVision Access"
4. Verify the profile and vacation request are updated correctly
