# Flex Sync Control Flow Diagram

## Current Implementation (Problematic)

```
┌─────────────────────────────────────────────────────────────────────┐
│ sync-flex-crew-for-job(job_id, departments)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  FOR EACH department (sound/lights/etc) │
        └─────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Load Crew Call Mapping                                      │
│ ─────────────────────────────                                       │
│  SELECT flex_element_id FROM flex_crew_calls                        │
│  WHERE job_id=X AND department=Y                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Load Desired State                                          │
│ ───────────────────────────                                         │
│  SELECT technician_id, role FROM job_assignments                    │
│  JOIN profiles ON flex_resource_id                                  │
│  WHERE job_id=X AND (has role OR dept match)                        │
│                                                                      │
│  Result: desiredIds = {Tech A, Tech B, Tech C}                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Load Current DB State (SNAPSHOT - ONLY READ) ⚠️             │
│ ─────────────────────────────────────────────────────               │
│  SELECT id, technician_id, flex_line_item_id                        │
│  FROM flex_crew_assignments WHERE crew_call_id=Y                    │
│                                                                      │
│  Result: currentRows = [                                            │
│    {id: 1, tech: A, line_item: "flex-123"},                         │
│    {id: 2, tech: D, line_item: "flex-456"}                          │
│  ]                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Fetch Flex State (Discover Present Line Items)              │
│ ───────────────────────────────────────────────────                 │
│  GET /line-item/{crew_call}/row-data/?codeList=contact              │
│                                                                      │
│  Result: presentLineItemIds = {"flex-456"}                          │
│  (Note: "flex-123" missing - Tech A's contact deleted in Flex)      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Delete Stale DB Rows ⚠️ (NO RE-READ AFTER)                  │
│ ────────────────────────────                                        │
│  staleRows = currentRows.filter(r => !presentLineItemIds.has(r))   │
│  → [{id: 1, tech: A, line_item: "flex-123"}]                        │
│                                                                      │
│  DELETE FROM flex_crew_assignments WHERE id IN (1)                  │
│  → Tech A's DB row deleted                                          │
│                                                                      │
│  freshCurrentRows = currentRows - staleRows                         │
│  → [{id: 2, tech: D, line_item: "flex-456"}]                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Compute Diff (FROM STALE SNAPSHOT) ⚠️                        │
│ ──────────────────────────────────────────                          │
│  currentIds = {Tech D}  (from freshCurrentRows)                     │
│  desiredIds = {Tech A, Tech B, Tech C}                              │
│                                                                      │
│  toAdd = desiredIds - currentIds                                    │
│  → {Tech A, Tech B, Tech C}  ❌ WRONG! Tech A was in original       │
│     snapshot, so NOT added!                                         │
│                                                                      │
│  ACTUAL toAdd = {Tech B, Tech C}  (Tech A missing!)                 │
│                                                                      │
│  toRemove = currentIds - desiredIds                                 │
│  → {Tech D}                                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Add Missing Technicians ⚠️ (BLIND INSERT)                   │
│ ──────────────────────────────                                      │
│  FOR EACH tech IN toAdd:                                            │
│    POST /line-item/{crew_call}/add-resource/{flex_resource_id}     │
│    → Get lineItemId from response                                   │
│                                                                      │
│    INSERT INTO flex_crew_assignments (crew_call_id, technician_id) │
│    VALUES (Y, tech)                                                  │
│    ↑ NO UPSERT, NO CONFLICT HANDLING                                │
│                                                                      │
│  Result: Tech B, Tech C added                                       │
│          Tech A MISSING (wasn't in toAdd)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: Remove Unwanted Technicians                                 │
│ ────────────────────────────────                                    │
│  FOR EACH tech IN toRemove:                                         │
│    DELETE /line-item/{flex_line_item_id}                            │
│    DELETE FROM flex_crew_assignments WHERE id=...                   │
│                                                                      │
│  Result: Tech D removed                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: Set Business Roles (Sound Only)                             │
│ ────────────────────────────                                        │
│  FOR EACH added tech:                                               │
│    Infer tier from role code (-R/-E/-T)                             │
│    POST /line-item/{crew_call}/row-data/ (business-role field)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10: Discover & Prune Orphaned Flex Contacts ⚠️                 │
│ ─────────────────────────────────────────────────                   │
│  Fetch ALL contacts from Flex (multiple fallback endpoints)         │
│  → /line-items, /children, /row-data/findRowData                    │
│                                                                      │
│  extraIds = flexContacts - desiredResourceIds                       │
│                                                                      │
│  DELETE /line-item?lineItemIds={extraIds}  (bulk or individual)    │
│                                                                      │
│  ⚠️ TIMING ISSUE: If Tech A just deleted as stale but not           │
│     re-added yet, they won't be in Flex, may get double-deleted     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌────────────┐
                      │   DONE     │
                      └────────────┘

═══════════════════════════════════════════════════════════════════════

## Race Condition Scenario (Concurrent Syncs)

Timeline:
─────────────────────────────────────────────────────────────────────

Time  │  Request A                       │  Request B
──────┼──────────────────────────────────┼────────────────────────────
T0    │  Load currentRows: {Tech D}      │
T1    │  Compute toAdd: {Tech A, B, C}   │
T2    │                                  │  Load currentRows: {Tech D}
T3    │                                  │  Compute toAdd: {Tech A, B, C}
T4    │  Add Tech A to Flex              │
T5    │  INSERT Tech A (success)         │
T6    │                                  │  Add Tech A to Flex
T7    │                                  │  INSERT Tech A (success) ⚠️
T8    │  Add Tech B to Flex              │
T9    │  INSERT Tech B (success)         │
T10   │                                  │  Add Tech B to Flex
T11   │                                  │  INSERT Tech B (success) ⚠️
      │                                  │
Result: DB has DUPLICATE rows for Tech A and Tech B!

Why? No unique constraint on (crew_call_id, technician_id)
     Both requests saw empty currentRows at snapshot time
     Both inserted same technicians

═══════════════════════════════════════════════════════════════════════

## Proposed Fixed Implementation

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1-2: Load Crew Call + Desired State (UNCHANGED)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Load Current DB State (Initial Snapshot)                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Fetch Flex State                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Delete Stale DB Rows                                        │
│  DELETE FROM flex_crew_assignments WHERE id IN (staleIds)           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5b: ✅ RE-READ Current DB State                                │
│ ────────────────────────────────────                                │
│  SELECT id, technician_id, flex_line_item_id                        │
│  FROM flex_crew_assignments WHERE crew_call_id=Y                    │
│                                                                      │
│  Result: reloadedRows = fresh state after deletion                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: ✅ Compute Diff (FROM FRESH STATE)                           │
│ ──────────────────────────────────────────                          │
│  currentIds = reloadedRows.map(technician_id)                       │
│  toAdd = desiredIds - currentIds  → Now includes Tech A!            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: ✅ Add Missing Technicians (UPSERT)                          │
│ ────────────────────────────────────────                            │
│  FOR EACH tech IN toAdd:                                            │
│    POST /line-item/{crew_call}/add-resource/{flex_resource_id}     │
│                                                                      │
│    ✅ UPSERT INTO flex_crew_assignments                             │
│       (crew_call_id, technician_id, flex_line_item_id)             │
│       VALUES (Y, tech, lineItemId)                                  │
│       ON CONFLICT (crew_call_id, technician_id)                     │
│       DO UPDATE SET flex_line_item_id = EXCLUDED.flex_line_item_id │
│                                                                      │
│  Result: Concurrent syncs safely merge, no duplicates               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8-9: Remove Unwanted + Set Business Roles (UNCHANGED)          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10 (Optional): ✅ Prune Orphaned Flex Contacts                  │
│ ───────────────────────────────────────────────────                 │
│  Move this BEFORE Step 3 (or defer to separate job)                │
│  → Cleaner separation, avoids delete-before-add timing issues       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌────────────┐
                      │   DONE     │
                      └────────────┘

═══════════════════════════════════════════════════════════════════════

## Database Schema Fix

┌─────────────────────────────────────────────────────────────────────┐
│ Before (Current):                                                    │
│                                                                      │
│  CREATE TABLE flex_crew_assignments (                               │
│    id UUID PRIMARY KEY,                                             │
│    crew_call_id UUID NOT NULL,                                      │
│    technician_id UUID NOT NULL,                                     │
│    flex_line_item_id TEXT                                           │
│  );                                                                  │
│  ❌ NO UNIQUE CONSTRAINT → Allows duplicates                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ After (Fixed):                                                       │
│                                                                      │
│  CREATE TABLE flex_crew_assignments (                               │
│    id UUID PRIMARY KEY,                                             │
│    crew_call_id UUID NOT NULL,                                      │
│    technician_id UUID NOT NULL,                                     │
│    flex_line_item_id TEXT,                                          │
│    ✅ CONSTRAINT unique_crew_call_technician                         │
│       UNIQUE (crew_call_id, technician_id)                          │
│  );                                                                  │
│  ✅ Blocks duplicate inserts at DB level                             │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

## Legend

✅  Fixed in proposed solution
⚠️  Problematic section in current implementation
❌  Bug/issue
→  Data flow
```
