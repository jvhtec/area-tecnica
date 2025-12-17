# Push Equipment to Flex Pullsheets - Design Document

**Date:** 2025-12-17
**Feature:** Push equipment items from Festival Gear Setup form to Flex pullsheets

---

## Overview and User Flow

### Feature Goal
Allow users to push equipment items from the Festival Gear Setup form directly into Flex pullsheets by pasting a pullsheet URL.

### User Flow
1. User configures festival gear setup (consoles, wireless, IEMs, wired mics, etc.)
2. User saves the gear setup to the database
3. User clicks a new "Push to Flex Pullsheet" button in the form
4. Dialog appears prompting for the Flex pullsheet URL
5. System extracts the pullsheet element ID from the URL
6. System gathers all configured equipment that has a `resource_id` in the equipment table
7. System calls the Flex API to add each equipment item as a line item to the pullsheet
8. Success toast shows count of items pushed (e.g., "5 items pushed to Flex pullsheet")
9. Error handling for missing resource_ids or API failures

### What Gets Pushed
- FOH consoles (by model name lookup)
- Monitor consoles (by model name lookup)
- Wireless systems (by model name lookup)
- IEM systems (by model name lookup)
- Wired mics (by model name lookup)
- **Only items that have a valid `resource_id` in the equipment table are pushed**
- Items without resource_id are skipped with a warning in the UI

---

## URL Parsing and Element ID Extraction

### URL Patterns to Support
Based on existing Flex URL handling code, we need to extract the element ID from URLs like:
- `https://flex.domain.com/app/element/{elementId}`
- `https://flex.domain.com/app/element/{elementId}/...` (with additional path segments)

### Implementation Approach

Create a utility function `extractFlexElementId(url: string): string | null` that:
1. Validates the URL format
2. Extracts the element ID from the path using regex or URL parsing
3. Returns the element ID or null if invalid

Leverage or extend existing `src/utils/flexUrlResolver.ts` patterns for consistency.

### Dialog UX
- Input field with placeholder: "Paste Flex pullsheet URL here..."
- Real-time validation showing green checkmark when valid element ID detected
- Error message if URL format is invalid
- "Push Items" button disabled until valid URL is entered
- Shows count of items that will be pushed (e.g., "Ready to push 5 equipment items")

---

## Equipment Lookup and Resource ID Mapping

### Database Query Strategy

The system needs to map equipment model names (strings like "DiGiCo SD12", "Shure UR4D") from the gear setup arrays to their `resource_id` values in the equipment table.

### Implementation

1. **Collect all model names** from the gear setup form:
   - `setup.foh_consoles.map(c => c.model)`
   - `setup.mon_consoles.map(c => c.model)`
   - `setup.wireless_systems.map(w => w.model)`
   - `setup.iem_systems.map(i => i.model)`
   - `setup.wired_mics.map(m => m.model)`

2. **Single batch query** to equipment table:
   ```sql
   SELECT name, resource_id, department, id
   FROM equipment
   WHERE name = ANY($1) AND resource_id IS NOT NULL
   ```

3. **Build a mapping**: `Map<modelName, {resourceId, quantity}>`
   - For wireless/IEM: aggregate quantity_hh + quantity_bp (or use quantity field)
   - For consoles/mics: use quantity field directly

4. **Handle missing mappings**:
   - Collect items that have no resource_id
   - Show warning in dialog: "3 items will be skipped (no Flex resource ID): DiGiCo SD12, Shure ULXD4, ..."
   - Only push items with valid resource_ids

### Performance Note
Single query for all equipment is efficient. The Map lookup is O(1) for building the push list.

---

## Flex API Integration

### API Endpoint

Reuse the existing `addResourceLineItem` pattern from `src/services/flexWorkOrders.ts`:

```
POST /financial-document-line-item/{pullsheetId}/add-resource/{resourceId}
Query params: resourceParentId, managedResourceLineItemType, quantity
```

### New Service Function

Create `src/services/flexPullsheets.ts` with:

```typescript
async function pushEquipmentToPullsheet(options: {
  pullsheetElementId: string;
  equipment: Array<{
    resourceId: string;
    quantity: number;
    name: string; // for logging
  }>;
}): Promise<{
  succeeded: number;
  failed: Array<{ name: string; error: string }>;
}>
```

### Implementation Details

1. Get Flex auth token using existing `getFlexAuthToken()` from flexWorkOrders
2. For each equipment item, call the add-resource endpoint
3. Use `managedResourceLineItemType: 'resource'` (since it's equipment, not service-offering)
4. Set `resourceParentId` to the pullsheet element ID itself
5. Track successes and failures
6. Return summary for user feedback

### Error Handling
- Individual item failures don't stop the whole batch
- Collect all errors and show in toast/dialog
- Log API errors to console for debugging

---

## UI Components and User Interaction

### New Button in FestivalGearSetupForm

Add a secondary button next to the Save button:
- Label: "Push to Flex Pullsheet"
- Icon: Upload or Send icon (from lucide-react)
- Variant: outline (less prominent than Save)
- Position: Same button row as Save, to the left
- Only enabled when form has been saved (existingSetupId exists)

### New Dialog Component

Create `src/components/festival/PushToFlexPullsheetDialog.tsx`:

```typescript
interface PushToFlexPullsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gearSetup: GearSetupFormData;
  jobId: string;
}
```

#### Dialog Content

1. **URL Input Section:**
   - Input field for pullsheet URL
   - Validation indicator (checkmark/error icon)
   - Help text: "Paste the URL of the Flex pullsheet where equipment should be added"

2. **Preview Section:**
   - Shows count of items that will be pushed
   - Shows count of items that will be skipped (no resource_id)
   - Expandable list of skipped items with warning icon

3. **Action Buttons:**
   - "Cancel" (secondary)
   - "Push Items" (primary, disabled until valid URL)

4. **Loading State:**
   - Show spinner and "Pushing X items..." when in progress
   - Disable all inputs during push

5. **Result Display:**
   - Success: "✓ Successfully pushed 5 items to Flex pullsheet"
   - Partial success: "✓ Pushed 3 items, 2 failed: [list]"
   - Full failure: Error message with retry option

---

## Error Handling and Edge Cases

### Validation Checks

1. **Before opening dialog:**
   - Require saved gear setup (existingSetupId must exist)
   - Show toast if user tries to push unsaved changes: "Please save the gear setup first"

2. **URL validation:**
   - Check URL format matches Flex patterns
   - Validate element ID extraction succeeds
   - Show inline error: "Invalid Flex URL format"

3. **Equipment lookup:**
   - Handle case where NO equipment has resource_id: "No equipment items are linked to Flex resources"
   - Warn about partial matches: "3 of 8 items will be skipped"

4. **API failures:**
   - Network errors: "Failed to connect to Flex. Check your connection."
   - Auth failures: "Flex authentication failed. Please contact support."
   - Invalid pullsheet ID: "Could not access pullsheet. Check the URL or permissions."
   - Individual item failures: Track and display which items failed

### Edge Cases

- Empty gear setup (no equipment configured): Disable push button
- Duplicate resource IDs: Flex API should handle, but we aggregate quantities first
- Quantity of 0: Skip these items silently
- Very long equipment lists (100+ items): Show progress indicator, consider rate limiting

### Logging

- Console.log the equipment mapping for debugging
- Log API responses for each item
- Log final success/failure summary

---

## Testing Strategy and Future Enhancements

### Testing Approach

1. **Manual Testing Checklist:**
   - Push items to a test pullsheet with all equipment types
   - Test with some equipment missing resource_id
   - Test with invalid URL formats
   - Test with unsaved gear setup
   - Test with empty gear setup
   - Test API failures (invalid pullsheet ID)
   - Verify quantities are correct in Flex

2. **Validation Steps:**
   - Check Flex pullsheet shows all pushed items
   - Verify quantities match gear setup
   - Confirm skipped items are reported correctly
   - Test multiple pushes to same pullsheet (should add more items)

### Future Enhancements (not in initial implementation)

1. **Auto-detect pullsheet:** Query flex_folders table to find pullsheet for current job/department
2. **Bulk operations:** Push to multiple pullsheets at once (one per stage)
3. **Sync tracking:** Store which items were pushed when, allow updates
4. **Resource ID management:** UI to link equipment models to Flex resources
5. **Preset support:** Push equipment preset lists to pullsheets
6. **Department filtering:** Only push sound equipment to sound pullsheets

### Performance Considerations

- Equipment lookup: Single query for all models (fast)
- API calls: Sequential to avoid rate limiting (acceptable for typical gear setup of 5-20 items)
- If needed later: Batch API or parallel requests with Promise.all

---

## Implementation Summary

The feature adds a "Push to Flex Pullsheet" button to the FestivalGearSetupForm that:
1. Prompts user for pullsheet URL
2. Extracts element ID from URL
3. Looks up equipment resource IDs from database
4. Pushes each equipment item to Flex via API
5. Shows success/failure summary to user

### Key Files to Create/Modify

- `src/components/festival/PushToFlexPullsheetDialog.tsx` (new dialog)
- `src/services/flexPullsheets.ts` (new service)
- `src/utils/flexUrlParser.ts` (new utility, or extend existing)
- `src/components/festival/FestivalGearSetupForm.tsx` (add button)

---

## Architecture Decisions

1. **Why prompt for URL instead of auto-detect?**
   - Explicit and simple for v1
   - Works for any pullsheet, not just job-related ones
   - Avoids complex flex_folders queries
   - User has full control

2. **Why only push items with resource_id?**
   - Clean separation: equipment without Flex mapping isn't ready
   - Prevents API errors from unmapped items
   - Encourages proper equipment setup
   - User gets clear feedback about what's missing

3. **Why sequential API calls instead of parallel?**
   - Avoids potential rate limiting
   - Easier error tracking per item
   - Typical gear setup (5-20 items) completes quickly enough
   - Can optimize later if needed

4. **Why separate service file?**
   - Keeps flexWorkOrders.ts focused on work orders
   - Allows different auth/error handling if needed
   - Reusable for future pullsheet operations
   - Clear separation of concerns
