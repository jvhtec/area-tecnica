# Dry Hire Folders Dynamic Management

## Problem

The `DRYHIRE_PARENT_IDS` in `src/utils/flex-folders/constants.ts` contains hardcoded Flex folder IDs for 2025. These become stale each year and require code changes to update.

## Solution

Store dryhire parent folder IDs in a database table, with a UI to create new year folders in Flex and automatically populate the table.

## Database Schema

```sql
CREATE TABLE dryhire_parent_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('sound', 'lights')),
  month TEXT NOT NULL CHECK (month IN ('01','02','03','04','05','06','07','08','09','10','11','12')),
  element_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, department, month)
);
```

## Folder Structure in Flex

For each year, create:
- `Dry Hire 2026 - Sonido` (main folder)
  - `Enero`, `Febrero`, ... `Diciembre` (12 subfolders)
- `Dry Hire 2026 - Luces` (main folder)
  - `Enero`, `Febrero`, ... `Diciembre` (12 subfolders)

The month subfolder element_ids are stored in the database.

## Implementation Steps

### Step 1: Database Migration
- Create `dryhire_parent_folders` table
- Seed with existing 2025 data from `DRYHIRE_PARENT_IDS`

### Step 2: Create DryHireFolderManager Component
- Display existing years and their folder status
- Year selector dropdown
- "Create Dry Hire Folders" button
- Loading/success/error states

### Step 3: Create Folder Creation Service
- Function `createDryhireYearFolders(year: number)`
- Creates main folders for sound and lights
- Creates 12 month subfolders under each
- Inserts records into `dryhire_parent_folders`

### Step 4: Update Settings Page
- Add CollapsibleCard with DryHireFolderManager
- Only visible to management users

### Step 5: Update folders.ts
- Replace `DRYHIRE_PARENT_IDS[department][monthKey]` lookup
- Query `dryhire_parent_folders` table by year/department/month

### Step 6: Cleanup
- Remove `DRYHIRE_PARENT_IDS` from constants.ts

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_dryhire_parent_folders.sql` | Create |
| `src/components/settings/DryHireFolderManager.tsx` | Create |
| `src/utils/flex-folders/dryhireFolderService.ts` | Create |
| `src/pages/Settings.tsx` | Modify |
| `src/utils/flex-folders/folders.ts` | Modify |
| `src/utils/flex-folders/constants.ts` | Modify |

## UI Mockup

```
┌─────────────────────────────────────────────┐
│  Dry Hire Folder Management                 │
├─────────────────────────────────────────────┤
│                                             │
│  Existing years:                            │
│  ┌─────────────────────────────────────┐    │
│  │ 2025  ✓ Sound (12)  ✓ Lights (12)  │    │
│  │ 2026  ✗ Not created                 │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Create folders for year: [2026 ▼]          │
│                                             │
│  [ Create Dry Hire Folders ]                │
│                                             │
└─────────────────────────────────────────────┘
```
