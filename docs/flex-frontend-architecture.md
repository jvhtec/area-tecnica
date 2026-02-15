# Flex Frontend Architecture Map

## Overview
This document catalogs all flex-related frontend modules in the Sector Pro application, organized by responsibility, and documents the data/control flow for each creation pipeline (job, tour, tour-date). It highlights the architectural differences between pipelines and captures open gaps for future refactoring.

---

## Module Inventory

### Core Utilities (Data Layer & Orchestration)

#### Folder Creation & API
- **`src/utils/flex-folders/folders.ts`** (1137 lines)
  - **Purpose**: Main folder orchestration logic
  - **Key Export**: `createAllFoldersForJob(job, startDate, endDate, docNum, options?)`
  - **Responsibilities**:
    - Branches on `job.job_type` (dryhire, tourdate, standard)
    - Handles per-department folder creation with granular toggles
    - Creates main event folders, department subfolders, and specialty elements
    - Manages metadata-driven pullsheet templates
    - Upserts crew calls to `flex_crew_calls` table
    - Creates comercial extras with multiple presupuestos
    - Persists all folders to `flex_folders` table with appropriate `folder_type`
  - **Dependencies**: `api.ts`, `constants.ts`, `types.ts`, `supabase`

- **`src/utils/flex-folders/api.ts`**
  - **Purpose**: Thin wrapper around Flex API
  - **Key Export**: `createFlexFolder(payload)` - POST to `/element`
  - **Dependencies**: Flex auth token from `secure-flex-api` Edge function

- **`src/utils/flex-folders/types.ts`** (364 lines)
  - **Purpose**: Type definitions for folder creation
  - **Key Types**:
    - `CreateFoldersOptions` - per-department subfolder toggles
    - `DepartmentSelectionOptions` - subfolder keys, custom pullsheets, extras presupuestos
    - `SubfolderKey` - 18 toggleable subfolder types
    - `FlexFolderMetadataEntry` - name/dates for pullsheets and presupuestos
  - **Helpers**: Sanitization, cloning, metadata extraction

- **`src/utils/flex-folders/constants.ts`**
  - **Purpose**: Flex element IDs, department IDs, responsible person IDs
  - **Key Exports**: `FLEX_FOLDER_IDS`, `DEPARTMENT_IDS`, `RESPONSIBLE_PERSON_IDS`, `DEPARTMENT_SUFFIXES`, `DRYHIRE_PARENT_IDS`

- **`src/utils/flex-folders/config.ts`**
  - **Purpose**: Configuration settings

- **`src/utils/flex-folders/index.ts`**
  - **Purpose**: Barrel export for all flex-folders utilities

#### Tree/Element Navigation
- **`src/utils/flex-folders/getElementTree.ts`** (300+ lines)
  - **Purpose**: Fetch and manipulate Flex element hierarchies
  - **Key Exports**:
    - `getElementTree(mainElementId)` - fetch tree from Flex API
    - `flattenTree(nodes, depth?)` - flatten to list with depth
    - `searchTree(nodes, query)` - search by display name or document number
    - `filterTreeWithAncestors(nodes, predicate)` - filter while preserving parent chain
  - **Dependencies**: Flex API via `secure-flex-api` Edge function

- **`src/utils/flex-folders/buildFlexUrl.ts`**
  - **Purpose**: Construct Flex URLs from job/tour/element data
  - **Key Export**: `buildFlexUrl(options)`

- **`src/utils/flex-folders/resolveFlexUrl.ts`**
  - **Purpose**: Resolve element IDs to Flex URLs
  - **Key Export**: `resolveFlexUrl(elementId, options?)`

- **`src/utils/flex-folders/openFlexElement.ts`**
  - **Purpose**: Async open Flex elements in new tab
  - **Key Export**: `openFlexElement(elementId)`

- **`src/utils/flex-folders/openFlexElementSync.ts`**
  - **Purpose**: Sync open Flex elements
  - **Key Export**: `openFlexElementSync(elementId)`

- **`src/utils/flex-folders/urlBuilder.ts`**
  - **Purpose**: URL building utilities
  - **Note**: Also exists at `src/lib/flex/urlBuilder.ts`

- **`src/utils/flex-folders/intentDetection.ts`**
  - **Purpose**: Detect user intent from URL patterns

#### Helper Utilities
- **`src/utils/flexMainFolderId.ts`**
  - **Purpose**: Extract main Flex element ID from job data
  - **Key Exports**:
    - `getMainFlexElementIdSync(job)` - sync extraction from `job.flex_folders` array
    - `resolveMainFlexElementId(jobId)` - async with Supabase fallback
  - **Logic**: Prefers `folder_type: 'main_event'`, falls back to `'main'` for legacy

- **`src/utils/flexUrlResolver.ts`**
  - **Purpose**: URL resolution utilities

- **`src/utils/flexCrewAssignments.ts`**
  - **Purpose**: Determine Flex departments (sound/lights) for crew assignments
  - **Key Export**: `determineFlexDepartmentsForAssignment(assignment, fallbackDept?)`

- **`src/utils/flex-labor-resources.ts`**
  - **Purpose**: Map job roles to Flex resource IDs for labor line items
  - **Key Exports**: `resourceIdForRole(role)`, `EXTRA_RESOURCE_IDS`

- **`src/utils/tourFolders.ts`** (313 lines)
  - **Purpose**: Tour-specific folder creation helpers
  - **Key Exports**:
    - `createTourRootFolders(tourId)` - calls Edge function for root + department folders
    - `createTourDateFolders(tourId)` - calls Edge function for date folders
    - `createTourRootFoldersManual(tourId)` - direct API calls via `secure-flex-api`
    - `createAllTourFolders(tourId)` - root + dates in one call
  - **Note**: Lighter-weight than job creation; defers to Edge function `create-flex-folders`

### Services

- **`src/services/flexUuidService.ts`** (431 lines)
  - **Purpose**: Department-aware Flex UUID resolution
  - **Key Export**: `FlexUuidService.getFlexUuid(identifier, userDepartment)`
  - **Logic**:
    - Determines identifier type (tour_date, tour, job)
    - Routes to appropriate handler
    - For tours: checks `tours.flex_*_folder_id` columns, falls back to job-based lookup
    - For jobs: branches on `job_type` (dryhire, tourdate, single)
    - Queries `flex_folders` table with `folder_type` and `department` filters
  - **Dependencies**: Supabase

- **`src/services/flexWorkOrders.ts`** (825 lines)
  - **Purpose**: Create and manage Flex work orders (Orden de Trabajo)
  - **Key Export**: `syncFlexWorkOrdersForJob(jobId)`
  - **Responsibilities**:
    - Creates work order elements under personnel folders
    - Adds resource line items for technicians (roles, extras)
    - Updates line item dates, pricing models, quantities
    - Persists work order metadata to `flex_work_orders` table
  - **Dependencies**: Flex API, `flex-labor-resources.ts`, `flexCrewAssignments.ts`

- **`src/services/flexFolderDeletionService.ts`**
  - **Purpose**: Delete Flex folders and clean up database records
  - **Dependencies**: Supabase, Flex API

### Hooks

- **`src/hooks/useJobActions.ts`** (281 lines)
  - **Purpose**: Shared job actions (delete, create flex folders, create local folders)
  - **Key Export**: `useJobActions(job, userRole, onDeleteClick?)`
  - **Flex-Related Method**: `createFlexFoldersHandler(e)`
  - **Flow**:
    1. Check for existing folders
    2. Format dates and document number
    3. Call `createAllFoldersForJob(job, startDate, endDate, docNum)`
    4. Update `jobs.flex_folders_created = true`
    5. Broadcast push notification (`flex.folders.created`)
    6. Invalidate queries
  - **Used By**: JobCardNew, legacy job cards

- **`src/hooks/useTourDateFlexFolders.ts`** (161 lines)
  - **Purpose**: Bulk folder creation for tour dates
  - **Key Exports**:
    - `createIndividualFolders(tourDate)` - single tour date
    - `createAllFolders(tourDates)` - bulk creation
  - **Flow**:
    1. Get tour date's associated job
    2. Call `createAllFoldersForJob` for the job
    3. Update `jobs.flex_folders_created = true`
    4. Invalidate job and tour-date queries
  - **Note**: Reuses job helper, so tour-date jobs get full granularity

- **`src/hooks/useFlexUuid.ts`** (83 lines)
  - **Purpose**: React hook wrapper around `FlexUuidService`
  - **Key Export**: `useFlexUuid(identifier)`
  - **Flow**:
    1. Get current user's department from profile
    2. Call `FlexUuidService.getFlexUuid(identifier, department)`
    3. Return `{ flexUuid, isLoading, error, folderExists, refetch }`

- **`src/hooks/useFlexUuidLazy.ts`**
  - **Purpose**: Lazy version of `useFlexUuid` (manual trigger)

- **`src/hooks/useFlexCrewAssignments.ts`** (98 lines)
  - **Purpose**: Manage Flex crew assignments (add/remove from crew calls)
  - **Key Export**: `useFlexCrewAssignments()`
  - **Methods**:
    - `manageFlexCrewAssignment(jobId, technicianId, department, action)` - calls Edge function
    - `useCrewCallData(jobId, department)` - query hook for crew call element ID
  - **Dependencies**: Edge function `manage-flex-crew-assignments`, `flex_crew_calls` table

- **`src/hooks/useFolderExistence.ts`**
  - **Purpose**: Check if Flex folders exist for a job

### UI Components

- **`src/components/flex/FlexElementSelectorDialog.tsx`** (233 lines)
  - **Purpose**: Tree-based modal for selecting Flex elements
  - **Props**:
    - `mainElementId` - root element to fetch tree from
    - `defaultElementId` - highlight default
    - `onSelect(elementId, node?)` - callback on selection
    - `filterPredicate?` - filter tree nodes
  - **Features**:
    - TanStack Query for tree fetching
    - Search by name or document number
    - Visual indentation (16px per level)
    - Command menu for keyboard navigation
  - **Dependencies**: `getElementTree`, `flattenTree`, `searchTree`, `filterTreeWithAncestors`

- **`src/components/flex/FlexFolderPicker.tsx`**
  - **Purpose**: Folder picker component

- **`src/components/tours/TourDateFlexButton.tsx`**
  - **Purpose**: Button to create Flex folders for tour dates

- **`src/components/jobs/FlexSyncLogDialog.tsx`**
  - **Purpose**: Display sync logs for Flex operations

- **`src/components/project-management/LaborPOForm.tsx`** (341 lines)
  - **Purpose**: Create labor purchase orders in Flex
  - **Note**: Uses Flex API directly (not folder creation, but related integration)
  - **Dependencies**: `apiService.ts` for Flex API calls

### UI Entry Points (Job Cards)

- **`src/components/dashboard/JobCardNew.tsx`**
  - **Purpose**: Dashboard job card with "Create Flex folders" action
  - **Flow**: Calls `useJobActions` hook → `createFlexFoldersHandler`

- **`src/components/jobs/cards/JobCardNew.tsx`**
  - **Purpose**: Jobs list card with "Create Flex folders" action
  - **Flow**: Same as dashboard card

### Type Definitions

- **`src/types/flex.ts`**
  - **Purpose**: Shared Flex type definitions

- **`src/lib/flex/urlBuilder.ts`**
  - **Purpose**: URL builder types and utilities

### Tests

- **`src/utils/flex-folders/__tests__/flexUrlResolver.test.ts`**
- **`src/utils/flex-folders/__tests__/config.test.ts`**
- **`src/utils/flex-folders/__tests__/buildFlexUrl.test.ts`**
- **`src/utils/flex-folders/__tests__/intentDetection.test.ts`**
- **`src/utils/flex-folders/__tests__/openFlexElementSync.test.ts`**
- **`src/utils/flex-folders/__tests__/openFlexElement.test.ts`**
- **`src/utils/flex-folders/__tests__/resolveFlexUrl.test.ts`**
- **`src/utils/flex-folders/__tests__/urlBuilder.test.ts`**
- **`src/utils/flex-folders/getElementTree.test.ts`**
- **`src/utils/flexMainFolderId.test.ts`**
- **`src/components/flex/FlexElementSelectorDialog.test.tsx`**

---

## Data/Control Flow Diagrams

### Job Folder Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ UI ENTRY POINTS                                                  │
├─────────────────────────────────────────────────────────────────┤
│ • JobCardNew (dashboard)                                         │
│ • JobCardNew (jobs list)                                         │
│ • useJobActions hook                                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ createFlexFoldersHandler()   │
        ├──────────────────────────────┤
        │ 1. Check existing folders    │
        │ 2. Format dates/doc number   │
        │ 3. Call helper               │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────────────┐
        │ createAllFoldersForJob(job, start, end, doc, opts)│
        └──────────────┬───────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌─────────────────┐      ┌─────────────────────────┐
│ job_type check  │      │ Load existing folders   │
└────────┬────────┘      │ from flex_folders table │
         │               └─────────────────────────┘
    ┌────┴────┐
    │         │
    ▼         ▼
  dryhire   tourdate   standard
    │         │           │
    │         │           ▼
    │         │    ┌──────────────────────────┐
    │         │    │ Create main_event folder │
    │         │    │ (POST /element)          │
    │         │    └──────────┬───────────────┘
    │         │               │
    │         │               ▼
    │         │    ┌─────────────────────────────────┐
    │         │    │ Insert flex_folders row         │
    │         │    │ (folder_type: 'main_event')     │
    │         │    └──────────┬──────────────────────┘
    │         │               │
    │         │               ▼
    │         │    ┌─────────────────────────────────────────────┐
    │         │    │ Iterate departments (sound, lights, video,  │
    │         │    │   production, personnel, comercial)         │
    │         │    └──────────┬──────────────────────────────────┘
    │         │               │
    │         │               ▼
    │         │    ┌──────────────────────────────────────────┐
    │         │    │ For each department:                     │
    │         │    │ • Check shouldCreateDepartmentFolder     │
    │         │    │ • Create department subfolder            │
    │         │    │ • Insert flex_folders (folder_type:      │
    │         │    │   'department', department: <dept>)      │
    │         │    │                                          │
    │         │    │ Then create specialty subfolders         │
    │         │    │ (if shouldCreateItem returns true):      │
    │         │    │   - hojaInfo (SIP/LIP/VIP for s/l/v)     │
    │         │    │   - documentacionTecnica (DT)            │
    │         │    │   - presupuestosRecibidos (PR)           │
    │         │    │   - hojaGastos (HG)                      │
    │         │    │   - pullSheets (TP/PA for sound)         │
    │         │    │   - comercial extras + presupuestos      │
    │         │    │   - personnel work orders, gastos,       │
    │         │    │     crew calls (CCS/CCL)                 │
    │         │    │                                          │
    │         │    │ Crew calls: upsert flex_crew_calls       │
    │         │    └──────────────────────────────────────────┘
    │         │
    │         ▼
    │    ┌─────────────────────────────────────────────────┐
    │    │ Tour Date Job Path                              │
    │    ├─────────────────────────────────────────────────┤
    │    │ 1. Validate tour_id exists                      │
    │    │ 2. Fetch tour root folders from tours table     │
    │    │ 3. Get selected departments from tour jobs      │
    │    │ 4. For each department:                         │
    │    │    • Get parent folder ID from tour             │
    │    │    • Create tour date subfolder                 │
    │    │      (name: "{location} - {date} - {dept}")     │
    │    │    • Insert flex_folders (folder_type:          │
    │    │      'tourdate', department: <dept>)            │
    │    │    • Create department-specific subfolders:     │
    │    │      - hojaInfo (SIP/LIP/VIP for s/l/v)         │
    │    │      - documentacionTecnica (DT)                │
    │    │      - presupuestosRecibidos (PR)               │
    │    │      - hojaGastos (HG)                          │
    │    │      - pullSheets (TP/PA for sound)             │
    │    │      - comercial extras                         │
    │    │      - personnel work orders, gastos, crew calls│
    │    └─────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────┐
│ Dry Hire Path                                      │
├────────────────────────────────────────────────────┤
│ 1. Check existing dryhire folder                   │
│ 2. Get department from job_departments             │
│ 3. Resolve monthly parent folder ID from           │
│    DRYHIRE_PARENT_IDS[dept][monthKey]              │
│ 4. Create dryhire subfolder in monthly parent      │
│    (name: "Dry Hire - {job.title}")                │
│ 5. Create presupuestoDryHire child                 │
│ 6. Insert flex_folders rows:                       │
│    • folder_type: 'dryhire' (parent)               │
│    • folder_type: 'dryhire_presupuesto' (child)    │
└────────────────────────────────────────────────────┘

                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Update jobs.flex_folders_created=true│
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Broadcast push notification          │
        │ (flex.folders.created)               │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Invalidate queries:                  │
        │ • ["jobs"]                           │
        │ • ["folder-existence"]               │
        └──────────────────────────────────────┘
```

### Tour Root Folder Creation Flow

```
┌─────────────────────────────────────────┐
│ UI ENTRY POINTS                          │
├─────────────────────────────────────────┤
│ • TourCard                               │
│ • TourManagement components              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ createTourRootFolders(tourId)            │
│   OR                                     │
│ createTourRootFoldersManual(tourId)      │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────────┐    ┌──────────────────────┐
│ Edge Fn     │    │ Manual Path          │
│ Path        │    │ (secure-flex-api)    │
└─────┬───────┘    └──────┬───────────────┘
      │                   │
      ▼                   ▼
┌─────────────────────────────────────────────────┐
│ Edge Function: create-flex-folders              │
│   OR                                            │
│ Direct API calls via secure-flex-api            │
├─────────────────────────────────────────────────┤
│ 1. Fetch tour data (name, dates)               │
│ 2. Determine enabled departments from tour jobs │
│ 3. Create main tour folder (POST /element)      │
│ 4. For each department:                         │
│    • Create department subfolder                │
│      (name: "{tour.name} - {dept}")             │
│    • For sound/lights/video:                    │
│      - Create hojaInfo (SIP/LIP/VIP)            │
│    • For sound/lights/video/production:         │
│      - Create documentacionTecnica (DT)         │
│      - Create presupuestosRecibidos (PR)        │
│      - Create hojaGastos (HG)                   │
│    • Insert flex_folders row (folder_type:      │
│      'tour_department', department: <dept>)     │
│ 5. Update tours table:                          │
│    • flex_main_folder_id                        │
│    • flex_sound_folder_id                       │
│    • flex_lights_folder_id                      │
│    • flex_video_folder_id                       │
│    • flex_production_folder_id                  │
│    • flex_personnel_folder_id                   │
│    • flex_comercial_folder_id                   │
│    • flex_folders_created = true                │
│ 6. Log activity event (management-visible)      │
│ 7. Broadcast push notification                  │
└─────────────────────────────────────────────────┘
```

### Tour Date Folder Creation Flow (via Edge Function)

```
┌─────────────────────────────────────────┐
│ UI ENTRY POINTS                          │
├─────────────────────────────────────────┤
│ • TourCard                               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ createTourDateFolders(tourId)            │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Edge Function: create-flex-folders              │
├─────────────────────────────────────────────────┤
│ 1. Fetch tour data with root folder IDs         │
│ 2. Fetch tour dates                             │
│ 3. For each tour date:                          │
│    • Create date folder under main tour folder  │
│      (name: "{location} - {date}")              │
│    • For each enabled department:               │
│      - Create department subfolder              │
│        (name: "{location} - {date} - {dept}")   │
│      - Insert flex_folders row (folder_type:    │
│        'tourdate', tour_date_id: <id>)          │
│ 4. Broadcast push notification                  │
│    (flex.tourdate_folder.created)               │
│ 5. Log activity events                          │
└─────────────────────────────────────────────────┘
```

### Tour Date Folder Creation Flow (via Job Helper)

```
┌─────────────────────────────────────────────────┐
│ UI ENTRY POINTS                                  │
├─────────────────────────────────────────────────┤
│ • useTourDateFlexFolders hook                   │
│ • TourManagement bulk actions                   │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│ useTourDateFlexFolders.createIndividualFolders() │
│   OR                                             │
│ useTourDateFlexFolders.createAllFolders()        │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ For each tour date:                      │
│ 1. Fetch associated job (tour_date_id)  │
│ 2. Format dates and document number      │
│ 3. Call createAllFoldersForJob(job, ...) │
│    (follows Job Creation Flow above)     │
│ 4. Update jobs.flex_folders_created=true │
│ 5. Invalidate queries                    │
└──────────────────────────────────────────┘
```

### Flex UUID Resolution Flow

```
┌─────────────────────────────────────────┐
│ UI ENTRY POINTS                          │
├─────────────────────────────────────────┤
│ • useFlexUuid(identifier) hook           │
│ • "Open Flex" buttons in job/tour cards  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ FlexUuidService.getFlexUuid(identifier,  │
│   userDepartment)                        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Determine identifier type:               │
│ • Check tour_dates table                 │
│ • Check tours table                      │
│ • Check jobs table                       │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────────┐    ┌──────────────────────┐
│ tour_date   │    │ tour / job           │
└─────┬───────┘    └──────┬───────────────┘
      │                   │
      ▼                   ▼
┌─────────────────────────────────────────┐
│ Query flex_folders table:               │
│ • Filter by identifier (job_id,         │
│   tour_date_id, or tour lookup)         │
│ • Filter by department (user dept)      │
│ • Filter by folder_type:                │
│   - 'tourdate' (prefer)                 │
│   - 'department' (fallback)             │
│   - 'job' (final fallback)              │
│   - 'dryhire' (for dryhire jobs)        │
│ • Return element_id                     │
└─────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ For tours: also check tours table       │
│ columns (flex_sound_folder_id, etc.)     │
└──────────────────────────────────────────┘
```

---

## Creation Pipeline Comparison

### Standard Job Creation (Most Granular)

**Entry Points:**
- `JobCardNew` (dashboard)
- `JobCardNew` (jobs list)
- `useJobActions` hook

**Orchestrator:**
- `createAllFoldersForJob` in `src/utils/flex-folders/folders.ts`

**Special Capabilities:**

1. **Per-Department Folder Toggles**
   - UI can pass `CreateFoldersOptions` with department-specific `subfolders` arrays
   - Each department supports 10-15 toggleable subfolder types
   - Example: `{ sound: { subfolders: ['hojaInfo', 'documentacionTecnica', 'pullSheetTP'] } }`

2. **Metadata-Driven Pullsheet Templates**
   - Custom names, start dates, end dates for multiple pullsheets
   - Sound department: TP (Tour Pack), PA (Public Address)
   - PA creation conditional on `!is_tour_pack_only`
   - Supports custom pullsheet metadata via `options.sound.customPullsheet.entries[]`

3. **Supabase Mirroring**
   - Every Flex folder gets a `flex_folders` row with:
     - `job_id`, `element_id`, `parent_id`, `folder_type`, `department`
   - Enables local queries without hitting Flex API

4. **Crew Call Persistence**
   - Crew call elements (CCS, CCL) created under personnel folder
   - Upserts `flex_crew_calls` table with `job_id`, `department`, `flex_element_id`
   - Used by crew assignment management hooks

5. **Extras Budgeting Folders**
   - Comercial department creates extras folders for sound/lights
   - Each extras folder can have multiple presupuesto children
   - Metadata-driven via `options.comercial.extrasPresupuesto.entries[]`

6. **Personnel Integration**
   - Work orders (OT) for technicians
   - Gastos de Personal (GP)
   - Crew calls for sound/lights with Supabase tracking

7. **Dryhire Monthly Parents**
   - Resolves monthly parent folder from `DRYHIRE_PARENT_IDS[dept][monthKey]`
   - Creates dryhire subfolder + presupuestoDryHire child
   - Stores with `folder_type: 'dryhire'` and `'dryhire_presupuesto'`

**Folder Types Created:**
- `main_event` (main job folder)
- `department` (per-department subfolders)
- `dryhire` (dryhire jobs)
- `dryhire_presupuesto` (dryhire presupuesto)
- `tourdate` (tour-date job subfolders under tour parents)

**Subfolders Created (if enabled):**
- Sound/Lights/Video:
  - Hoja de Información (SIP/LIP/VIP)
  - Documentación Técnica (DT)
  - Presupuestos Recibidos (PR)
  - Hoja de Gastos (HG)
  - Pull Sheets (TP, PA for sound)
- Production:
  - Documentación Técnica (DT)
  - Presupuestos Recibidos (PR)
  - Hoja de Gastos (HG)
- Personnel:
  - Orden de Trabajo (OT)
  - Gastos de Personal (GP)
  - Crew Call Sonido (CCS)
  - Crew Call Luces (CCL)
- Comercial:
  - Extras Sonido (SQT)
  - Extras Luces (LQT)
  - Presupuestos for each extras (multiple supported)

---

### Tour Root Folder Creation (Lighter Weight)

**Entry Points:**
- `TourCard` UI
- Tour management components

**Orchestrator:**
- `createTourRootFolders` or `createTourRootFoldersManual` in `src/utils/tourFolders.ts`
- Edge function: `create-flex-folders` (backend)

**Capabilities:**

1. **Department Subfolders**
   - Creates main tour folder
   - Creates subfolders for all 6 departments (sound, lights, video, production, personnel, comercial)
   - Stores IDs in `tours` table columns (`flex_sound_folder_id`, etc.)

2. **Limited Specialty Elements**
   - Sound/Lights/Video: Hoja de Información (SIP/LIP/VIP)
   - Sound/Lights/Video/Production:
     - Documentación Técnica (DT)
     - Presupuestos Recibidos (PR)
     - Hoja de Gastos (HG)

3. **No Per-Department Toggles**
   - All departments are created unconditionally
   - No granular subfolder control

4. **Supabase Mirroring**
   - Inserts `flex_folders` rows with `folder_type: 'tour_department'`
   - No crew call tracking

**Folder Types Created:**
- `tour_department` (tour-level department folders)

**What's Missing vs Jobs:**
- No per-department folder toggles
- No custom pullsheet metadata
- No crew call persistence (`flex_crew_calls`)
- No extras/presupuestos (comercial)
- No personnel work orders or gastos
- No dryhire support
- No pullsheets
- No `CreateFoldersOptions` support

---

### Tour Date Folder Creation (Medium Weight)

**Entry Points:**
- `useTourDateFlexFolders` hook (reuses job helper)
- `TourCard` UI (calls Edge function)

**Two Paths:**

#### Path 1: Edge Function (Lighter)
- **Orchestrator**: Edge function `create-flex-folders`
- **Capabilities**:
  - Creates date folder under tour main folder
  - Creates department subfolders under date folder
  - Inserts `flex_folders` rows with `folder_type: 'tourdate'`
  - No specialty elements
  - No crew call tracking

#### Path 2: Job Helper (Full Granularity)
- **Orchestrator**: `useTourDateFlexFolders` → `createAllFoldersForJob`
- **Capabilities**:
  - Full job creation pipeline (see Standard Job Creation above)
  - Creates tourdate folders under tour department parents
  - Supports all per-department toggles
  - Crew call persistence
  - Extras/presupuestos
  - Personnel integration

**Folder Types Created:**
- `tourdate` (tour-date subfolders)

**What's Missing (Edge Function Path):**
- No per-department toggles
- No specialty elements (hoja info, documentacion tecnica, pullsheets, etc.)
- No crew call persistence
- No extras/presupuestos
- No personnel folders

**What's Available (Job Helper Path):**
- Full job creation capabilities
- All specialty elements
- Crew call persistence
- Extras/presupuestos
- Personnel integration

---

## Why Job Creation is More Granular

Job creation evolved to support complex, per-event requirements:

1. **Client-Specific Folder Structures**
   - Each client may require different combinations of subfolders
   - UI allows selection of which subfolders to create per department
   - Avoids cluttering Flex with unused folders

2. **Equipment Pull Sheets**
   - Sound department needs separate pullsheets for Tour Pack and PA
   - PA is hidden for tour-pack-only events
   - Custom metadata allows naming and date overrides

3. **Crew Management Integration**
   - Crew calls must be tracked in `flex_crew_calls` table
   - Enables `manage-flex-crew-assignments` Edge function to add/remove technicians
   - Links job assignments to Flex elements

4. **Budgeting Workflows**
   - Comercial extras folders support multiple presupuestos per department
   - Personnel needs work orders with line items for each technician
   - Pricing models and quantities vary per job

5. **Dryhire Business Model**
   - Dryhire jobs are organized by month in Flex
   - Requires resolving monthly parent folders
   - Different document suffix structure (SDH, LDH)

6. **Tour vs Event Distinction**
   - Tours are umbrella containers (lighter structure)
   - Tour dates are individual events (need full structure)
   - Tour-date jobs created via job helper get event-level granularity

---

## Open Gaps (Tour/Tour-Date vs Job)

The following capabilities are available in job creation but missing from tour/tour-date creation (Edge function paths):

### 1. Per-Department Folder Toggles
- **Gap**: Tours create all subfolders unconditionally; no UI control
- **Impact**: Cannot selectively disable unused subfolders (e.g., skip documentacion tecnica)
- **Workaround**: Use job helper path (`useTourDateFlexFolders`) for tour dates

### 2. Custom Pullsheet Metadata
- **Gap**: Tours/tour dates don't support custom names or dates for pullsheets
- **Impact**: Cannot create multiple pullsheets with specific configurations
- **Workaround**: Manual pullsheet creation in Flex UI, or use job helper path

### 3. Crew Call Persistence
- **Gap**: Tour date folders (Edge function path) don't upsert `flex_crew_calls`
- **Impact**: Cannot use `manage-flex-crew-assignments` Edge function for tour dates created via Edge function
- **Workaround**: Use job helper path for tour dates that need crew management

### 4. Extras/Presupuestos (Comercial)
- **Gap**: Tours don't create extras folders with multiple presupuestos
- **Impact**: Comercial department lacks budgeting folders for tours
- **Workaround**: Manual creation in Flex, or create tour dates as standard jobs

### 5. Personnel Folders (Work Orders, Gastos)
- **Gap**: Tours don't create work orders or gastos de personal
- **Impact**: Cannot track labor costs in Flex for tours
- **Workaround**: Use `flexWorkOrders.ts` service manually, or create tour dates as standard jobs

### 6. Dryhire Integration
- **Gap**: Tours don't support dryhire job types
- **Impact**: Dryhire events must be created as standard jobs, not tour dates
- **Workaround**: None; dryhire is job-only

### 7. Options Granularity (`CreateFoldersOptions`)
- **Gap**: Tours lack the entire `CreateFoldersOptions` infrastructure
- **Impact**: No programmatic control over subfolder creation
- **Workaround**: Modify Edge function or switch to job helper path

### 8. Subfolder Coverage
- **Gap**: Tour root creation only creates hoja info + 3 subfolders (DT, PR, HG) for technical departments
- **Impact**: Missing pullsheets, crew calls, work orders, gastos, extras
- **Workaround**: Manual creation or job helper path

---

## Recommendations for Future Refactoring

1. **Unify Creation Logic**
   - Extract common folder creation patterns into shared helpers
   - Make `createAllFoldersForJob` reusable for tours by accepting tour context

2. **Extend Tour Edge Function**
   - Add `CreateFoldersOptions` support to Edge function
   - Allow per-department subfolder toggles
   - Support custom pullsheet and extras metadata

3. **Crew Call Tracking for Tours**
   - Update Edge function to upsert `flex_crew_calls` for tour date folders
   - Enable crew management for all tour dates

4. **Personnel Integration for Tours**
   - Add work order and gastos creation to tour date Edge function
   - Sync labor costs for tour events

5. **Refactor into Modules**
   - Separate dryhire, tourdate, and standard job creation into distinct modules
   - Compose pipelines from shared building blocks

6. **Test Coverage**
   - Add integration tests for each creation pipeline
   - Test per-department toggle combinations
   - Verify crew call persistence

7. **Documentation Updates**
   - Document `CreateFoldersOptions` schema in UI components
   - Add examples of custom pullsheet/extras configurations

---

## Summary

The flex frontend architecture spans **50+ modules** organized into utilities, services, hooks, and UI components. The core orchestration happens in `createAllFoldersForJob`, which branches into dryhire, tourdate, and standard job paths. Job creation is significantly more granular than tour creation because it supports:

- Per-department folder toggles
- Metadata-driven pullsheets and presupuestos
- Crew call persistence
- Personnel work orders and gastos
- Dryhire monthly parent resolution
- Comercial extras budgeting

Tours and tour dates lack these capabilities when created via the Edge function, but tour dates created via `useTourDateFlexFolders` (job helper path) inherit full job granularity. The open gaps documented above highlight areas for future parity improvements between tour and job creation pipelines.
