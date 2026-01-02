# SoundVision Access Grant Workflow - Implementation Checklist

## ✅ Completed Tasks

### Database Layer
- [x] Created migration to add `metadata` JSONB column to `messages` table
- [x] Migration includes comment explaining purpose
- [x] Migration is idempotent (checks if column exists)

### Type System
- [x] Added `MessageMetadata` interface with `type` and `vacation_request_id` fields
- [x] Updated `Message` interface to include optional `metadata` field
- [x] Updated Supabase generated types for `messages` table
- [x] All types properly exported and imported

### UI Components
- [x] MessageCard recognizes SoundVision access request messages
- [x] MessageCard displays "SoundVision Access Request" badge
- [x] MessageCard renders requester details (name from sender field)
- [x] MessageCard shows submitted note (message content)
- [x] MessageCard displays "Grant SoundVision Access" button for management
- [x] Button only visible when: `isManagement && isSoundVisionRequest && vacationRequestId`
- [x] Added UserCheck icon import
- [x] Added Badge component import

### Business Logic
- [x] useMessageOperations hook includes `handleGrantSoundVisionAccess` function
- [x] Function validates user authentication
- [x] Function fetches vacation request to get technician_id
- [x] **Safeguard**: Checks if request already approved (prevents duplicates)
- [x] Updates `profiles.soundvision_access_enabled = true`
- [x] Approves vacation request with `approved_by` and `approved_at`
- [x] Marks message as read
- [x] Invalidates messages and vacation_requests queries
- [x] Dispatches `messages_invalidated` event for multi-tab coordination
- [x] Shows clear toast feedback (success and error cases)
- [x] Proper error handling with user-friendly messages

### Query Updates
- [x] useMessagesQuery explicitly selects `metadata` field
- [x] MessagesList passes `handleGrantSoundVisionAccess` to MessageCard
- [x] All message-related queries updated to work with new schema

### Helper Functions
- [x] Added `submitSoundVisionAccessRequest` to `vacationRequestsApi`
- [x] Function creates vacation_request with today's dates
- [x] Function creates message with proper metadata structure
- [x] Function links message to vacation_request via metadata

### Documentation
- [x] Created comprehensive workflow documentation
- [x] Created implementation summary document
- [x] Created test cases document
- [x] Included usage examples
- [x] Documented safeguards and error handling
- [x] Added database schema details

### Code Quality
- [x] No new TypeScript errors (verified with `tsc --noEmit`)
- [x] No new ESLint errors in modified files
- [x] Follows existing code patterns and conventions
- [x] Proper imports and exports
- [x] Consistent naming conventions

## 🚀 Deployment Steps

1. **Apply Database Migration**
   ```bash
   supabase db push
   ```

2. **Verify Migration**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'messages' AND column_name = 'metadata';
   ```

3. **Deploy Application**
   - Build and deploy frontend with updated code
   - Verify no TypeScript/build errors

4. **Verify RLS Policies**
   - Ensure management can update messages in their department
   - Ensure management can update profiles and vacation_requests

5. **Test Workflow**
   - Follow test cases in `docs/soundvision-access-test-cases.md`
   - Verify grant workflow end-to-end
   - Test safeguards (duplicate prevention)

## 📝 Files Changed

### Modified Files (7)
1. `src/components/messages/MessageCard.tsx` - UI for grant button
2. `src/components/messages/MessagesList.tsx` - Pass handler to card
3. `src/components/messages/hooks/useMessageOperations.ts` - Grant logic
4. `src/components/messages/hooks/useMessagesQuery.ts` - Include metadata
5. `src/components/messages/types.ts` - Add MessageMetadata interface
6. `src/integrations/supabase/types.ts` - Update messages table types
7. `src/lib/vacation-requests.ts` - Add submit helper function

### New Files (4)
1. `supabase/migrations/20260212000000_add_messages_metadata.sql` - Migration
2. `docs/soundvision-access-workflow.md` - Workflow documentation
3. `docs/soundvision-access-test-cases.md` - Test cases
4. `SOUNDVISION_ACCESS_CHANGES.md` - Implementation summary

## 🎯 Key Features

1. **Structured Messages**: Messages can now carry metadata for special types
2. **Grant Workflow**: Complete workflow from request to approval
3. **Safeguards**: Duplicate prevention and proper validation
4. **Query Invalidation**: Ensures data consistency across app
5. **Multi-tab Coordination**: Uses events for cross-tab updates
6. **User Feedback**: Clear toast notifications for all actions
7. **Extensible**: Metadata system can support other message types in future

## ⚠️ Important Notes

- The workflow reuses the `vacation_requests` table creatively
- SoundVision access requests use same-day start/end dates
- Management must be in the same department to see requests
- RLS policies enforce permission checks at database level
- TypeScript types ensure type safety throughout
