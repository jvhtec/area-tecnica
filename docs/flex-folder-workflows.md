# Flex Folder Creation Workflows Audit

## Overview
This document summarizes how Flex folders are provisioned for jobs, tours, and tour dates in the application. It captures entry points, supporting utilities, Supabase functions, and database side effects so future updates can maintain parity across workflows.

## Job Flex Folder Creation

### Entry Points in the UI
* **Job cards (dashboard & jobs list).** Both `Dashboard JobCardNew` and the job card used in the jobs list expose "Create Flex folders" actions. Each checks for an existing `flex_folders` row for the job, builds the Flex timestamps/document number, and then calls the shared creation helper before marking `jobs.flex_folders_created` and refreshing queries.【F:src/components/dashboard/JobCardNew.tsx†L516-L583】【F:src/components/jobs/cards/JobCardNew.tsx†L523-L583】
* **Shared job action hook.** `useJobActions` provides the same creation routine for components that rely on the hook (including legacy card implementations). It prevents duplicate requests, invokes the helper, updates the job record, and fires a push notification broadcast.【F:src/hooks/useJobActions.ts†L100-L141】
* **Tour-date automation hook.** `useTourDateFlexFolders` bulk-creates folders for every tour date by locating its associated job and reusing the job helper. It maintains mutation state, updates `jobs.flex_folders_created`, and invalidates both job and tour-date queries.【F:src/hooks/useTourDateFlexFolders.ts†L8-L158】

### Core Helper: `createAllFoldersForJob`
The heavy lifting lives in `src/utils/flex-folders/folders.ts`. The helper orchestrates Flex API calls and local persistence with nuanced handling per job type.【F:src/utils/flex-folders/folders.ts†L245-L740】 Key behaviors:

* **Dry hire jobs.** Resolve the department-specific monthly parent folder, create the dry hire subfolder plus a linked "Presupuesto" child, and register the Flex element in `flex_folders` as a `dryhire` row.【F:src/utils/flex-folders/folders.ts†L200-L242】
* **Tour date jobs.** Require existing tour root folders, look up selected departments, and create department subfolders beneath the tour’s saved Flex IDs. Each folder is stored locally (`folder_type: "tourdate"`) and optional structures (hoja info, documentación técnica, pull sheets, crew calls, etc.) are gated by department selections and UI options.【F:src/utils/flex-folders/folders.ts†L252-L533】 Crew call elements update `flex_crew_calls` so the job retains pointers back to Flex.【F:src/utils/flex-folders/folders.ts†L506-L533】
* **Standard jobs.** Create the main event folder, persist it (`folder_type: "main_event"`), and then iterate per department. The helper respects department enablement, provisions specialty elements (hoja info, documentación técnica, presupuestos, gastos, comercial extras, crew calls), and writes the relationships into `flex_folders` with `folder_type: "department"` for traceability.【F:src/utils/flex-folders/folders.ts†L538-L737】

All branches call the shared `createFlexFolder` fetch wrapper (Flex API `POST /element`) and rely on `supabase` inserts to mirror the Flex hierarchy locally.【F:src/utils/flex-folders/api.ts†L1-L28】【F:src/utils/flex-folders/folders.ts†L556-L609】

## Tour and Tour-Date Flex Folder Workflows

### Supabase Edge Function (`create-flex-folders`)
Tours can trigger folder creation via the edge function at `supabase/functions/create-flex-folders/index.ts`:

* **Root folders.** The function determines enabled departments from tour jobs, creates the main folder plus department subfolders in Flex, persists created IDs back onto the `tours` row, and logs management-visible activity events.【F:supabase/functions/create-flex-folders/index.ts†L138-L235】
* **Date folders.** When asked to build tour-date folders, it enumerates dates, creates a date folder under the tour’s main element, conditionally creates department folders beneath each date, and inserts a `flex_folders` record tied to the `tour_date_id`. It also broadcasts a `flex.tourdate_folder.created` push notification and logs activity.【F:supabase/functions/create-flex-folders/index.ts†L237-L378】

The UI wires into this function through `createTourRootFolders` and `createTourDateFolders` utilities, which invoke the function with the appropriate payload and bubble errors to the calling components.【F:src/utils/tourFolders.ts†L14-L63】 `TourCard` exposes these flows to users, blocking date-folder creation until root folders exist.【F:src/components/tours/TourCard.tsx†L110-L160】

### Manual Root Folder Creation
For cases where Flex access must be proxied differently, `createTourRootFoldersManual` calls the `secure-flex-api` function to create the main tour folder plus department subfolders, mirrors auxiliary elements (hoja info, documentación técnica, etc.), persists IDs into both `tours` and `flex_folders`, and returns the collected metadata.【F:src/utils/tourFolders.ts†L66-L286】 This path mirrors the job folder structure to keep numbering and subfolders consistent.

### Tour-Date Jobs via UI Hook
When a user opts to generate folders for individual tour dates from the management dialog, the `useTourDateFlexFolders` hook described above executes the job helper for each date, ensuring tour-level jobs gain the same folder structure as stand-alone jobs.【F:src/hooks/useTourDateFlexFolders.ts†L13-L158】

## Flex Element Selector Integration

### Overview
The Flex Element Selector provides an interactive tree-based dialog for selecting which Flex element to open, with hierarchical navigation, search functionality, and visual indentation.

### Components

#### FlexElementSelectorDialog (`src/components/flex/FlexElementSelectorDialog.tsx`)
A reusable modal dialog component that:
* Fetches the complete element tree from Flex API via `getElementTree` helper
* Uses TanStack Query for efficient data fetching and caching
* Renders elements in a searchable, scrollable command menu
* Displays nested hierarchy with visual indentation (16px per level)
* Shows element display names and document numbers
* Highlights the default element when specified
* Supports real-time filtering by name or document number
* Provides loading spinner and error states with retry functionality
* Calls `onSelect` callback with selected element ID and closes on selection

**Props**:
* `open: boolean` - Controls dialog visibility
* `onOpenChange: (open: boolean) => void` - Callback for dialog state changes
* `mainElementId: string` - Root element ID to fetch tree from
* `defaultElementId?: string` - Optional element ID to highlight as default
* `onSelect: (elementId: string) => void` - Callback invoked when element is selected

#### Element Tree Helper (`src/utils/flex-folders/getElementTree.ts`)
Provides utilities for fetching and processing Flex element trees:

* **`getElementTree(mainElementId)`**: Fetches the element tree from Flex API
  - Returns array of FlexElementNode objects with hierarchical structure
  - Handles API errors and transforms response to normalized format
  - Supports nested children with recursive structure

* **`flattenTree(nodes, depth?)`**: Flattens hierarchical tree to list with depth
  - Preserves parent-child relationships
  - Adds depth property for indentation rendering
  - Returns FlatElementNode array for easy list rendering

* **`searchTree(nodes, query)`**: Searches tree by display name or document number
  - Case-insensitive search
  - Returns flattened results with depth preserved
  - Empty query returns all nodes flattened

#### Helper Functions (`src/utils/flexMainFolderId.ts`)
Two utility functions for resolving the main Flex element ID:

* **`getMainFlexElementIdSync`**: Synchronously extracts the main element ID from `job.flex_folders` array
  - Prefers `folder_type === 'main_event'`
  - Falls back to `folder_type === 'main'` for legacy data
  - Returns `{ elementId, department }` or `null`

* **`resolveMainFlexElementId`**: Async version that queries Supabase when job data lacks flex_folders
  - First checks job's in-memory flex_folders array
  - Falls back to Supabase query for `main_event` or `main` folder types
  - Handles errors gracefully with console logging

### Integration in JobCardActions

The "Open Flex" button behavior varies by context:

**Project Management Page (with main element)**:
* Computes the main Flex element ID using `getMainFlexElementIdSync`
* Opens the FlexElementSelectorDialog when clicked
* User selects from available department folders
* Selected folder opens in new tab

**Other Contexts (or no main element)**:
* Retains legacy behavior using `useFlexUuid` hook
* Directly navigates to the job's primary Flex folder
* Shows appropriate error/info toasts when folders unavailable

### Loading States
The button remains disabled while:
* Folder state is loading (`folderStateLoading`)
* Folders are being created (`isCreatingFolders`)
* Flex UUID is being resolved (`isFlexLoading`)

Toast feedback is shown for:
* Main folder resolution failures
* Selector loading errors
* Missing folder availability

### Testing

#### Element Tree Tests (`src/utils/flex-folders/getElementTree.test.ts`)
Comprehensive unit tests covering:
* Tree flattening with correct depth calculation
* Multi-level nesting and sibling handling
* Search filtering by display name and document number
* Case-insensitive search
* Edge cases (empty trees, missing children, deep nesting)

#### Dialog Component Tests (`src/components/flex/FlexElementSelectorDialog.test.tsx`)
Unit tests for component behavior:
* Tree flattening for rendering with indentation
* Search/filter functionality
* Node selection callback invocation
* Default element highlighting logic
* Document number display handling

#### Main Folder ID Tests (`src/utils/flexMainFolderId.test.ts`)
Tests covering:
* Synchronous extraction from job.flex_folders
* Preference for main_event over main folder type
* Fallback to Supabase queries
* Error handling for missing/invalid data
* Graceful handling of exceptions

## Observations
* All job-facing entry points now share the API-driven `createAllFoldersForJob` helper, ensuring consistent Flex element creation and Supabase persistence across cards, dialogs, and hooks.【F:src/components/dashboard/JobCardNew.tsx†L512-L587】【F:src/pages/FestivalManagement.tsx†L498-L600】【F:src/hooks/useJobActions.ts†L1-L122】
* Each workflow writes to the `flex_folders` table to mirror remote structure, so any schema changes should remain backward compatible with these inserts (job, dryhire, tourdate, and tour department folder types).【F:src/utils/flex-folders/folders.ts†L232-L239】【F:supabase/functions/create-flex-folders/index.ts†L292-L301】
* The Flex Element Selector enhances user experience by allowing department-specific navigation while maintaining backward compatibility with direct Flex UUID navigation for non-project-management contexts.
