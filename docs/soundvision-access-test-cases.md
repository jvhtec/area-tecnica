# SoundVision Access Workflow - Test Cases

## Prerequisites
- Database migration `20260212000000_add_messages_metadata.sql` must be applied
- Two test users:
  - Technician (role: 'house_tech' or 'technician', department: 'sound')
  - Manager (role: 'management', department: 'sound')

## Test Case 1: Submit SoundVision Access Request

### Steps
1. Log in as technician
2. Open browser console
3. Execute:
   ```javascript
   const { vacationRequestsApi } = await import('./src/lib/vacation-requests');
   await vacationRequestsApi.submitSoundVisionAccessRequest(
     "I need access to review SoundVision files for the upcoming Q1 2025 events.",
     "sound"
   );
   ```

### Expected Results
- ✅ Success message in console
- ✅ New row in `vacation_requests` table with status='pending'
- ✅ New row in `messages` table with:
  - content: "SoundVision Access Request from [First] [Last]:\n\n[Reason]"
  - department: "sound"
  - metadata: `{ "type": "soundvision_access_request", "vacation_request_id": "<id>" }`
  - status: "unread"

## Test Case 2: View SoundVision Access Request (Management)

### Steps
1. Log in as manager (management role, sound department)
2. Navigate to Messages section
3. View department messages

### Expected Results
- ✅ Message displays with "SoundVision Access Request" badge
- ✅ Requester name and department shown
- ✅ Request reason displayed in message content
- ✅ "Grant SoundVision Access" button visible
- ✅ Message has unread status indication

## Test Case 3: Grant SoundVision Access

### Steps
1. As manager, view the SoundVision access request message
2. Click "Grant SoundVision Access" button

### Expected Results
- ✅ Toast notification: "Access Granted - SoundVision access has been successfully granted."
- ✅ Message marked as read (border changes, unread indicator removed)
- ✅ In `profiles` table: `soundvision_access_enabled = true` for the requester
- ✅ In `vacation_requests` table:
  - `status = 'approved'`
  - `approved_by = <manager_id>`
  - `approved_at = <timestamp>`
- ✅ Grant button no longer appears or is disabled

## Test Case 4: Prevent Duplicate Grant

### Steps
1. As manager, try to grant access again for the same request
2. Either:
   - Refresh page and click grant button again, OR
   - Query and trigger the handler manually

### Expected Results
- ✅ Toast notification: "Already Granted - SoundVision access has already been granted for this request."
- ✅ No duplicate updates to database
- ✅ Function returns early without errors

## Test Case 5: Query Invalidation

### Setup
1. Have multiple browser tabs open with the messages page

### Steps
1. In Tab 1 (as manager): Grant SoundVision access
2. Observe Tab 2

### Expected Results
- ✅ Tab 2 messages list updates automatically
- ✅ Message shown as read in Tab 2
- ✅ Grant button no longer visible in Tab 2

## Test Case 6: Error Handling - Invalid Request

### Steps
1. Manually create a message with invalid metadata:
   ```sql
   INSERT INTO messages (content, department, sender_id, metadata)
   VALUES (
     'Test message',
     'sound',
     '<tech_user_id>',
     '{"type": "soundvision_access_request", "vacation_request_id": "00000000-0000-0000-0000-000000000000"}'::jsonb
   );
   ```
2. As manager, try to grant access

### Expected Results
- ✅ Toast notification with error message
- ✅ No changes to database
- ✅ Error logged to console

## Test Case 7: Permission Check

### Steps
1. Log in as technician (non-management)
2. View own submitted message in the department messages

### Expected Results
- ✅ "Grant SoundVision Access" button is NOT visible
- ✅ Only management sees the grant button

## Test Case 8: Regular Messages Unaffected

### Steps
1. Send a regular department message (no metadata)
2. View as management

### Expected Results
- ✅ No "SoundVision Access Request" badge
- ✅ No "Grant SoundVision Access" button
- ✅ Regular message actions (reply, mark as read, delete) work normally

## Validation Queries

### Check SoundVision Access Status
```sql
SELECT id, first_name, last_name, soundvision_access_enabled 
FROM profiles 
WHERE id = '<technician_id>';
```

### Check Vacation Request Status
```sql
SELECT id, status, approved_by, approved_at, reason
FROM vacation_requests
WHERE id = '<vacation_request_id>';
```

### Check Message Metadata
```sql
SELECT id, content, status, metadata
FROM messages
WHERE metadata->>'type' = 'soundvision_access_request';
```

## Cleanup
After testing, reset test data:
```sql
-- Remove test messages
DELETE FROM messages WHERE metadata->>'type' = 'soundvision_access_request';

-- Remove test vacation requests
DELETE FROM vacation_requests WHERE reason LIKE '%test%' OR reason LIKE '%Test%';

-- Reset SoundVision access (if needed)
UPDATE profiles SET soundvision_access_enabled = false WHERE id = '<technician_id>';
```
