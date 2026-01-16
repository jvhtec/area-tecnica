# Flex Backend Capabilities Catalog

## Overview

This document catalogs all backend Edge Functions that interact with the Flex Rental Solutions API, their dependencies, and compares backend tour/tour-date folder creation granularity with frontend job folder creation workflows.

## Table of Contents

1. [Edge Functions Catalog](#edge-functions-catalog)
2. [Environment Variables](#environment-variables)
3. [Database Dependencies](#database-dependencies)
4. [Flex API Endpoints Used](#flex-api-endpoints-used)
5. [Tour/Tour-Date Workflow Analysis](#tourtour-date-workflow-analysis)
6. [Delta: Backend vs Frontend Creation](#delta-backend-vs-frontend-creation)
7. [Feature Gap Summary](#feature-gap-summary)

---

## Edge Functions Catalog

### 1. `create-flex-folders`

**Purpose:** Creates root folders for tours and date-specific folders for tour dates.

**Endpoint:** `POST /functions/v1/create-flex-folders`

**Request Payload:**
```typescript
{
  tourId: string;
  createRootFolders?: boolean;  // Create main tour folder + dept folders
  createDateFolders?: boolean;  // Create folder per tour_date
}
```

**Flex API Endpoints:**
- `POST /element` - Creates folders and subfolders

**Environment Variables:**
- `SUPABASE_URL` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required)
- `X_AUTH_TOKEN` (required) - Flex API authentication

**Database Operations:**

*Reads:*
- `tours` - Fetches tour information, existing folder IDs
- `tour_dates` - Lists dates for folder creation
- `jobs` → `job_departments` - Determines selected departments via `getTourDepartments()`

*Writes:*
- `tours` - Updates `flex_folders_created`, `flex_main_folder_id`, `flex_sound_folder_id`, `flex_lights_folder_id`, `flex_video_folder_id`, `flex_production_folder_id`, `flex_personnel_folder_id`, `flex_comercial_folder_id`
- `flex_folders` - Inserts row per tour_date with `folder_type='tour_date'`, stores `element_id`

*RPCs:*
- `log_activity_as` - Logs 'flex.folders.created' (root) or 'flex.tourdate_folder.created' (dates) with visibility='management'

**Push Notifications:**
- Broadcasts `flex.tourdate_folder.created` push event for date folder creation

**Logic Summary:**

*Root Folder Creation (`createRootFolders: true`):*
1. Queries job_departments for selected departments
2. Creates main tour folder (no parent)
3. Creates conditional department subfolders:
   - **Always created:** production, personnel, comercial
   - **Conditionally created:** sound, lights, video (only if selected)
4. Updates tours table with all created folder IDs
5. Logs management-visible activity

*Date Folder Creation (`createDateFolders: true`):*
1. Ensures tour has `flex_main_folder_id` (root must exist first)
2. For each tour_date:
   - Creates date folder under tour main folder (name: `YYYY-MM-DD - {tour.name}`)
   - Creates shallow department subfolders under date folder (conditional per selection)
   - Inserts **single** `flex_folders` row: `folder_type='tour_date'`, `element_id={dateFolderId}`
3. Broadcasts push notification with dates count
4. Logs management-visible activity

**Limitations:**
- Does NOT create per-department subfolder trees (doc técnica, hojas de gastos, crew calls, extras)
- Only the date folder element_id is persisted in `flex_folders`; department children are NOT mirrored locally
- No crew call tracking (`flex_crew_calls` not updated)
- No department-level asset notifications

---

### 2. `apply-flex-status`

**Purpose:** Applies workflow status transitions (tentativa, confirmado, cancelado) to Flex elements and logs changes.

**Endpoint:** `POST /functions/v1/apply-flex-status`

**Request Payload:**
```typescript
{
  folder_id?: string;       // flex_folders.id (preferred)
  element_id?: string;      // Flex documentId (fallback)
  status: 'tentativa' | 'confirmado' | 'cancelado';
  cascade?: boolean;        // Apply to children if master folder
}
```

**Flex API Endpoints:**
- `POST /workflow-action/{elementId}/process/{workflowActionId}?bulkProcess=false`

**Workflow Action IDs:**
```typescript
master: {
  confirmado: "7b46c4b7-a196-498a-9f83-787a0ed5ac88",
  tentativa:  "b7648474-3a2d-41ba-8c2f-c68499729a70",
  cancelado:  "e1a7f8d4-b48d-42dd-a570-1cb1aea474f0",
}
sub: {
  confirmado: "df6f44cc-b04f-11df-b8d5-00e08175e43e",
  tentativa:  "152062cc-b050-11df-b8d5-00e08175e43e",
  cancelado:  "34c0b30c-b050-11df-b8d5-00e08175e43e",
}
```

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN` (can fallback to `get-secret` function)

**Database Operations:**

*Reads:*
- `flex_folders` - Loads folder row to determine master vs sub (checks `parent_id`)

*Writes:*
- `flex_folders` - Updates `current_status`
- `flex_status_log` - Inserts audit log: `folder_id`, `previous_status`, `new_status`, `action_type='api'`, `processed_by`, `success`, `flex_response`, `error`

**Cascade Logic:**
- If `cascade=true` and folder is master (`parent_id IS NULL`), applies status to all children using `sub` workflow actions
- Each child gets separate `flex_status_log` entry

---

### 3. `archive-to-flex`

**Purpose:** Exports job documents from Supabase storage to Flex "Documentación Técnica" remote file lists. Optionally deletes documents from storage after successful upload.

**Endpoint:** `POST /functions/v1/archive-to-flex`

**Request Payload:**
```typescript
{
  job_id: string;
  mode?: 'by-prefix' | 'all-tech';  // default: 'by-prefix'
  departments?: Dept[];             // explicit target departments
  include_templates?: boolean;      // default: false
  on_missing_doc_tecnica?: 'skip' | 'fail';  // default: 'skip'
  dry_run?: boolean;                // default: false
}
```

**Flex API Endpoints:**
- `PUT /remote-file/{remoteFileListId}/add-line` - Uploads file content or URL
- `GET /element/{elementId}/tree` - Discovers doc técnica elements

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN` (or `FLEX_X_AUTH_TOKEN`)
- `FLEX_API_BASE_URL` (default: `https://sectorpro.flexrentalsolutions.com/f5/api`)
- `FLEX_UPLOAD_MODE` (optional: 'url' | 'content', defaults to content-first)

**Database Operations:**

*Reads:*
- `job_documents` - Loads all docs for job_id
- `flex_folders` - Resolves `doc_tecnica` element IDs per department
- `job_departments` - Determines selected departments
- `jobs` → `tours` - Resolves tour-level department folders as fallback
- Storage buckets: `job_documents`, `job-documents`, `soundvision-files`

*Writes:*
- `flex_folders` - Backfills discovered doc técnica element IDs with `folder_type='doc_tecnica'`
- `job_documents` - Deletes rows after successful upload (unless dry_run)
- Storage - Removes files after successful upload

**Target Resolution Logic:**
1. Query `flex_folders` for `folder_type='doc_tecnica'` per department
2. Fallback 1: Fetch department folder element, traverse tree to find doc técnica
3. Fallback 2: Check tour-level department folders (for tour jobs)
4. Fallback 3: Traverse main event element tree, match department keywords in doc técnica names

**Department Inference:**
- Path-based: Detects dept prefix (`sound/`, `lights/`, etc.)
- Filename-based: Keyword matching (sonido, luces, vídeo, rigging)
- Fallback: Uses selected technical departments (sound, lights, video)

**Upload Modes:**
- **content-first** (default): Uploads file bytes in JSON payload
- **url mode** (`FLEX_UPLOAD_MODE=url`): Uploads signed Supabase URL, lets Flex fetch file

**Result Summary:**
```typescript
{
  ok: true,
  attempted: number,
  uploaded: number,
  skipped: number,
  failed: number,
  perDepartment: Record<string, { attempted, uploaded, failed, skipped }>,
  details: Array<{ docId, file, deptTargets, rflIds, status, error?, flex? }>
}
```

---

### 4. `backfill-flex-doc-tecnica`

**Purpose:** Scans Flex element trees to discover and persist "Documentación Técnica" remote file list IDs into `flex_folders` table for faster archive-to-flex operations.

**Endpoint:** `POST /functions/v1/backfill-flex-doc-tecnica`

**Request Payload:**
```typescript
{
  job_id: string;
  departments?: Dept[];  // Optional filter
  manual?: Array<{ dept: string; element_id: string }>;  // Manual overrides
}
```

**Flex API Endpoints:**
- `GET /element/{elementId}/tree` - Fetches element hierarchy

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN` (or `FLEX_X_AUTH_TOKEN`)
- `FLEX_API_BASE_URL`

**Database Operations:**

*Reads:*
- `flex_folders` - Checks for existing `doc_tecnica` entries, loads department folders
- `jobs` → `tours` - Resolves tour-level dept folders

*Writes:*
- `flex_folders` - Inserts rows with `folder_type='doc_tecnica'`, `department`, `element_id`, `parent_id`

**Discovery Logic:**
1. Manual entries processed first (if provided)
2. Scans department folder trees (`folder_type='department'`)
3. Scans tour-level department folders
4. Scans main event element tree as last resort
5. Matches elements by:
   - `elementDefinitionId === "3787806c-af2d-11df-b8d5-00e08175e43e"` (doc técnica definition ID)
   - Name contains "Documentación Técnica" (normalized, accent-insensitive)
   - For department-targeted scans: name contains dept keywords (sonido, luces, video, producción)

**Result Summary:**
```typescript
{
  ok: true,
  job_id: string,
  checked: number,  // Candidate roots scanned
  inserted: number,
  already: number,
  details: Array<{ dept, elementId, status }>
}
```

---

### 5. `fetch-flex-contact-info`

**Purpose:** Fetches contact information from Flex API for a given contact ID, maps it to Sector Pro profile fields.

**Endpoint:** `POST /functions/v1/fetch-flex-contact-info`

**Request Payload:**
```typescript
{
  contact_id?: string;  // Flex contact UUID
  url?: string;         // Alternative: extract UUID from Flex URL
}
```

**Flex API Endpoints:**
- `GET /contact/{contactId}/key-info/?_dc={timestamp}`

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN`

**Database Operations:**

*Reads:*
- `profiles` - Validates user role (requires admin or management)

*Authorization:*
- Requires authenticated user with role='admin' or role='management'

**Response Mapping:**
```typescript
{
  ok: true,
  contact_id: string,
  mapped: {
    firstName: string,
    lastName: string,
    email: string,
    phone: string,        // formatted with country code
    residencia: string,   // homeBaseLocation
    dni: string,          // assignedNumber
    department: 'sound' | 'lights' | 'video' | null
  },
  raw: any  // Full Flex response
}
```

**Department Detection:**
- Parses `contactTypes[0].name`
- Regex matching: sonido/sound → sound, luz/luces/light → lights, video → video

---

### 6. `manage-flex-crew-assignments`

**Purpose:** Adds or removes a technician from a Flex crew call (line-item resource management).

**Endpoint:** `POST /functions/v1/manage-flex-crew-assignments`

**Request Payload:**
```typescript
{
  job_id: string;
  technician_id: string;
  department: 'sound' | 'lights';
  action: 'add' | 'remove';
}
```

**Flex API Endpoints:**
- `POST /line-item/{crewCallElementId}/add-resource/{resourceId}` - Adds contact to crew call
- `GET /line-item/{crewCallElementId}/row-data/?codeList=...&node=root` - Discovers line item IDs
- `POST /line-item/{crewCallElementId}/row-data/` - Sets business-role field
- `DELETE /line-item/{lineItemId}` - Removes contact from crew call

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN`

**Database Operations:**

*Reads:*
- `profiles` - Fetches technician's `flex_resource_id`
- `flex_crew_calls` - Resolves crew call `flex_element_id` for job/department
- `flex_crew_assignments` - Checks for existing assignment
- `job_assignments` - Fetches sound_role for business-role mapping (sound dept only)

*Writes:*
- `flex_crew_assignments` - Inserts or updates: `crew_call_id`, `technician_id`, `flex_line_item_id`
- `flex_crew_assignments` - Deletes on remove action

*RPCs:*
- `log_activity_as` - Logs 'flex.crew.updated' activity

**Add Flow:**
1. Validates technician has `flex_resource_id`
2. Loads crew call mapping
3. Checks for existing assignment (upsert-style)
4. Calls Flex add-resource endpoint (tries simple POST, then form-encoded POST)
5. Discovers lineItemId from response or by scanning row-data
6. Stores assignment in DB
7. For SOUND dept: sets business-role based on sound_role tier (R/E/T → Jefe/Técnico/Ayudante)

**Remove Flow:**
1. Loads assignment from DB
2. Calls Flex DELETE on line-item
3. Deletes DB row

**Business Role Mapping (Sound only):**
```typescript
Tier 'jefe' (from -R suffix) → "18da92ec-b04f-11df-b8d5-00e08175e43e"
Tier 'tecnico' (from -E suffix) → "3c19bc3c-b050-11df-b8d5-00e08175e43e"
Tier 'ayudante' (from -T suffix) → "4c1e3c14-b050-11df-b8d5-00e08175e43e"
```

---

### 7. `persist-flex-elements`

**Purpose:** Bulk-persists Flex element metadata (folders, crew calls, etc.) created by frontend helpers into Supabase tables for faster lookups.

**Endpoint:** `POST /functions/v1/persist-flex-elements`

**Request Payload:**
```typescript
{
  created: Array<{
    kind: 'job_root_folder' | 'job_department_folder' | 'tour_date_folder' | 
          'crew_call' | 'pull_sheet' | 'doc_tecnica' | 'hoja_gastos' | 
          'hoja_info_sx' | 'hoja_info_lx' | 'hoja_info_vx';
    elementId: string;
    jobId?: string;
    tourId?: string;
    tourDateId?: string;
    department?: Dept;
    parentElementId?: string;
  }>
}
```

**Flex API Endpoints:**
- None (local DB persistence only)

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Database Operations:**

*Writes:*
- `flex_crew_calls` - Upserts by (job_id, department), stores `flex_element_id`
- `flex_folders` - Inserts rows with mapped `folder_type`:
  - `job_root_folder` → 'main_event'
  - `job_department_folder` → 'department'
  - `tour_date_folder` → 'tourdate'
  - `pull_sheet` → 'pull_sheet'
  - `doc_tecnica` → 'doc_tecnica'
  - `hoja_gastos` → 'hoja_gastos'
  - `hoja_info_sx` / `hoja_info_lx` / `hoja_info_vx` → same
- `jobs` - Sets `flex_folders_created=true` when root folder persisted

**Logic:**
- Resolves parent_id by querying flex_folders for parentElementId
- Skips duplicates (checks element_id uniqueness)
- Continues on per-item errors (non-blocking)

---

### 8. `secure-flex-api`

**Purpose:** Generic authenticated proxy for Flex API calls. Validates user authentication and whitelists allowed endpoints.

**Endpoint:** `POST /functions/v1/secure-flex-api`

**Request Payload:**
```typescript
{
  endpoint: string;      // e.g., "/element"
  method?: string;       // default: 'POST'
  payload?: any;         // Request body for Flex
}
```

**Flex API Endpoints:**
- Currently whitelisted: `/element` (for manual tour folder creation)

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN`

**Database Operations:**

*Reads:*
- `auth.users` - Validates bearer token

**Security:**
- Requires valid Authorization header
- Validates endpoint against allowlist (`['/element']`)
- Logs user_id for audit trail

**Use Cases:**
- Called by frontend `createTourRootFoldersManual` for manual tour folder provisioning
- Allows authenticated users to create Flex elements without exposing token

---

### 9. `sync-flex-crew-for-job`

**Purpose:** Comprehensive crew synchronization between Supabase `job_assignments` and Flex crew calls. Ensures Flex reflects current assignments by adding missing, removing extra, and setting business roles.

**Endpoint:** `POST /functions/v1/sync-flex-crew-for-job`

**Request Payload:**
```typescript
{
  job_id: string;
  departments?: ('sound' | 'lights' | 'video')[];
}
```

**Flex API Endpoints:**
- `POST /line-item/{crewCallElementId}/add-resource/{resourceId}`
- `GET /line-item/{crewCallElementId}/row-data/?codeList=...&node=root` - Lists current contacts
- `GET /element/{crewCallElementId}/line-items?...` - Alternative contact listing (multiple fallback attempts)
- `GET /line-item/{crewCallElementId}/children?...`
- `POST /line-item/{crewCallElementId}/row-data/` - Sets business-role
- `DELETE /line-item/{lineItemId}` - Removes contact
- `DELETE /line-item?lineItemIds={id1}&lineItemIds={id2}...` - Bulk removal (tries multiple param names)

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_AUTH_TOKEN` (with fallback to get-secret)

**Database Operations:**

*Reads:*
- `flex_crew_calls` - Maps job/dept to crew call element IDs
- `job_assignments` → `profiles` - Loads desired assignments with flex_resource_ids
- `flex_crew_assignments` - Loads current DB view of assignments

*Writes:*
- `flex_crew_assignments` - Inserts new, deletes stale/removed

**Synchronization Logic:**
1. **Desired Set:** Query job_assignments for technicians with roles/dept match
2. **Current DB Set:** Load flex_crew_assignments for crew call
3. **Current Flex Set:** Scan Flex line-items to detect contacts present in Flex
4. **Prune Stale:** Delete DB rows for line items no longer in Flex
5. **Add Missing:** Add technicians in desired but not current
6. **Remove Extra:** Remove technicians in current but not desired
7. **Set Roles:** Apply business-role for SOUND dept (jefe/técnico/ayudante from role code)
8. **Discover & Delete Extras:** Scan all Flex contacts, delete any not in desired set

**Result Summary:**
```typescript
{
  ok: true,
  job_id: string,
  summary: {
    [dept]: {
      added: number,
      removed: number,
      kept: number,
      rolesSet: number,
      failedAdds: number,
      desired_count: number,
      current_count: number,
      scanned_items: number,
      planned_delete_count: number,
      errors?: string[]
    }
  }
}
```

---

## Environment Variables

### Required for all Flex functions:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `X_AUTH_TOKEN` - Flex API authentication token (some functions accept `FLEX_X_AUTH_TOKEN` as alias)

### Optional:
- `FLEX_API_BASE_URL` - Flex API base (default: `https://sectorpro.flexrentalsolutions.com/f5/api`)
- `FLEX_UPLOAD_MODE` - Upload strategy for archive-to-flex ('url' | 'content', default: content-first)

---

## Database Dependencies

### Tables

#### `flex_folders`
- **Purpose:** Mirrors Flex element hierarchy locally for fast lookups
- **Columns:** `id`, `job_id`, `tour_date_id`, `parent_id`, `element_id`, `folder_type`, `department`, `current_status`
- **folder_type values:**
  - `'main_event'` / `'main'` - Root job folder
  - `'department'` - Department-level folder
  - `'tourdate'` / `'tour_date'` - Tour date folder
  - `'doc_tecnica'` - Documentación Técnica remote file list
  - `'hoja_info_sx'` / `'hoja_info_lx'` / `'hoja_info_vx'` - Hoja Info elements
  - `'hoja_gastos'` - Hoja de Gastos
  - `'pull_sheet'` - Pull Sheet
  - `'crew_call'` - Crew Call line item
  - `'work_orders'` - Work Orders folder
  - `'dryhire'` - Dry hire folder
- **Used by:** All Flex functions for element ID resolution

#### `flex_crew_calls`
- **Purpose:** Maps job departments to Flex crew call line items
- **Columns:** `id`, `job_id`, `department`, `flex_element_id`
- **Used by:** `manage-flex-crew-assignments`, `sync-flex-crew-for-job`

#### `flex_crew_assignments`
- **Purpose:** Tracks technician assignments to crew calls
- **Columns:** `id`, `crew_call_id`, `technician_id`, `flex_line_item_id`
- **Used by:** `manage-flex-crew-assignments`, `sync-flex-crew-for-job`

#### `flex_status_log`
- **Purpose:** Audit log for status transitions
- **Columns:** `id`, `folder_id`, `previous_status`, `new_status`, `action_type`, `processed_by`, `success`, `flex_response`, `error`, `created_at`
- **Used by:** `apply-flex-status`

#### `tours`
- **Purpose:** Stores tour-level Flex folder IDs
- **Columns:** `flex_folders_created`, `flex_main_folder_id`, `flex_sound_folder_id`, `flex_lights_folder_id`, `flex_video_folder_id`, `flex_production_folder_id`, `flex_personnel_folder_id`, `flex_comercial_folder_id`
- **Used by:** `create-flex-folders`

#### `tour_dates`
- **Purpose:** Tour show dates
- **Used by:** `create-flex-folders` (enumerates dates for folder creation)

#### `jobs`
- **Purpose:** Job records
- **Columns:** `flex_folders_created`, `tour_id`
- **Used by:** All job-scoped functions

#### `job_departments`
- **Purpose:** Selected departments per job
- **Used by:** `create-flex-folders` (via `getTourDepartments`), `archive-to-flex`

#### `job_assignments`
- **Purpose:** Technician assignments with role codes
- **Columns:** `job_id`, `technician_id`, `sound_role`, `lights_role`, `video_role`
- **Used by:** `manage-flex-crew-assignments`, `sync-flex-crew-for-job`

#### `job_documents`
- **Purpose:** Uploaded job documents
- **Used by:** `archive-to-flex` (exports to Flex, then deletes)

#### `profiles`
- **Purpose:** User profiles
- **Columns:** `flex_resource_id`, `department`, `role`
- **Used by:** `fetch-flex-contact-info` (authorization), crew functions (resource mapping)

### RPCs

#### `log_activity_as`
- **Purpose:** Logs user activity events with visibility scopes
- **Parameters:**
  - `_actor_id` (uuid)
  - `_code` (text) - Activity code
  - `_job_id` (uuid, nullable)
  - `_entity_type` (text)
  - `_entity_id` (text)
  - `_payload` (jsonb)
  - `_visibility` ('management' | 'job_participants' | 'house_plus_job' | 'actor_only' | null)
- **Used by:** `create-flex-folders`, `manage-flex-crew-assignments`

---

## Flex API Endpoints Used

### Element Management
- `POST /element` - Create folder/element
- `GET /element/{elementId}/tree` - Get hierarchical element structure
- `GET /element/{elementId}/line-items?...` - List line items under element

### Workflow Actions
- `POST /workflow-action/{elementId}/process/{workflowActionId}?bulkProcess=false` - Apply status transition

### Remote Files
- `PUT /remote-file/{remoteFileListId}/add-line` - Upload file to remote file list
  - Body: `{ filename, mimetype, filesize, content?: number[][], url?: string, notes?: string }`

### Line Items (Crew Calls)
- `POST /line-item/{lineItemId}/add-resource/{resourceId}` - Add contact to line item
- `DELETE /line-item/{lineItemId}` - Remove line item
- `DELETE /line-item?lineItemIds={id}...` - Bulk delete (param name varies: lineItemIds, lineItemId, ids)
- `GET /line-item/{lineItemId}` - Get line item details with children
- `GET /line-item/{lineItemId}/children?...` - List children with field codes
- `GET /line-item/{lineItemId}/row-data/?codeList=...&node=root` - Get tabular row data
- `GET /line-item/{lineItemId}/row-data/findRowData?codeList=...` - Alternative row data endpoint
- `POST /line-item/{lineItemId}/row-data/` - Set field value
  - Body: `{ lineItemId, fieldType: 'business-role', payloadValue: roleId }`

### Contacts
- `GET /contact/{contactId}/key-info/?_dc={timestamp}` - Fetch contact metadata

---

## Tour/Tour-Date Workflow Analysis

### Backend: `create-flex-folders`

**Root Folder Creation (`createRootFolders: true`):**

Located in: `supabase/functions/create-flex-folders/index.ts` (L171–235)

**Flow:**
1. Calls `getTourDepartments(tourId)` to determine selected departments from first job's `job_departments` (L93–110)
2. Creates main tour folder with name: `{tour.name}` (L179–182)
3. Iterates all departments: `['sound', 'lights', 'video', 'production', 'personnel', 'comercial']` (L185)
4. For each department, evaluates `shouldCreateDepartmentFolder(dept, selectedDepartments)` (L115–130):
   - **Always create:** production, personnel, comercial
   - **Conditionally create:** sound, lights, video (only if in `selectedDepartments`)
5. Creates department folder as child of main (L195–200)
6. Updates `tours` table with created folder IDs (L204–222):
   - Sets `flex_folders_created=true`
   - Sets `flex_main_folder_id`
   - Conditionally sets `flex_sound_folder_id`, `flex_lights_folder_id`, etc. (only for created folders)
7. Logs activity: `'flex.folders.created'`, visibility='management' (L226–234)

**Date Folder Creation (`createDateFolders: true`):**

Located in: `supabase/functions/create-flex-folders/index.ts` (L238–338)

**Flow:**
1. Validates `tour.flex_main_folder_id` exists (L255–256)
2. Queries all `tour_dates` for tour, ordered by date (L242–252)
3. Calls `getTourDepartments(tourId)` again (L260–261)
4. For each tour_date (L265–304):
   - Creates date folder under tour main folder (L270–274)
     - Name: `{YYYY-MM-DD} - {tour.name}`
   - Iterates departments: `['sound', 'lights', 'video', 'production', 'personnel', 'comercial']` (L277)
   - For each department passing `shouldCreateDepartmentFolder(dept, selectedDepartments)` (L280–282):
     - Creates **shallow** department subfolder under date folder (L285–289)
     - Department folder is **NOT** persisted in `flex_folders` table
   - Inserts **single** `flex_folders` row for the date folder (L293–301):
     - `tour_date_id: tourDate.id`
     - `job_id: null`
     - `element_id: {dateFolderId}`
     - `folder_type: 'tour_date'`
     - `department: null`
5. Broadcasts push notification: `'flex.tourdate_folder.created'` (L317–337)
6. Logs activity: `'flex.tourdate_folder.created'`, visibility='management' (L340–360)

**What is NOT created:**
- ❌ Per-department subfolder trees (doc técnica, hoja info, hojas de gastos, presupuestos, crew calls, extras, pull sheets)
- ❌ No `flex_folders` rows for department children under date folders
- ❌ No `flex_crew_calls` entries
- ❌ No department-level asset notifications
- ❌ No business role assignments

---

### Frontend: `createAllFoldersForJob`

**Standard Job Creation:**

Located in: `src/utils/flex-folders/folders.ts` (L206–740)

**Flow for standard (non-dry-hire, non-tour-date) jobs:**

1. Creates main event folder (L538–556):
   - Name: `{documentNumber} - {job.title}`
   - Inserts `flex_folders` row: `folder_type='main_event'`

2. Gets selected departments from `job_departments` (L558–567)

3. For each department, checks `shouldCreateDepartmentFolder(dept, selectedDepartments)` (L569–578):
   - Same logic: always production/personnel/comercial, conditional sound/lights/video

4. **Creates full department subfolder tree** (L580–737):

   **A. Department folder** (L593–609):
   - Name: `{documentNumber}{DEPARTMENT_SUFFIXES[dept]} - {dept} - {job.title}`
   - Inserts `flex_folders` row: `folder_type='department'`, `department={dept}`

   **B. Hoja Info (for sound/lights/video)** (L611–632):
   - Creates subfolder with definition ID specific to dept (hoja_info_sx, hoja_info_lx, hoja_info_vx)
   - Inserts `flex_folders` row: `folder_type='hoja_info_{dept}'`

   **C. Documentación Técnica** (L634–653):
   - Remote file list with definition ID `3787806c-af2d-11df-b8d5-00e08175e43e`
   - Inserts `flex_folders` row: `folder_type='doc_tecnica'`

   **D. Presupuesto (for sound/lights/video only)** (L655–674):
   - Creates subfolder
   - Inserts `flex_folders` row: `folder_type='presupuesto'`

   **E. Hoja de Gastos** (L676–695):
   - Creates subfolder
   - Inserts `flex_folders` row: `folder_type='hoja_gastos'`

   **F. Crew Call (for sound/lights only)** (L697–720):
   - Line-item element with definition ID `60f58b64-b050-11df-b8d5-00e08175e43e`
   - **Upserts `flex_crew_calls` table** (L506–533 in helper, invoked L697)
   - Inserts `flex_folders` row: `folder_type='crew_call'`

5. **Comercial department extras** (L722–732):
   - Calls `createComercialExtras(...)` (L254–374)
   - Creates "Extras" folder per technical dept (sound, lights)
   - Each extras folder gets presupuesto subfolder
   - Inserts `flex_folders` rows: `folder_type='extras_presupuesto'`

6. Marks job as complete:
   - Updates `jobs.flex_folders_created=true`

7. **Optional: Bulk-persist created elements** (L738–740):
   - Calls `persist-flex-elements` Edge Function with all created items

**What IS created (that backend tour/date flow does NOT create):**
- ✅ Hoja Info elements (SX/LX/VX)
- ✅ Documentación Técnica remote file lists per department
- ✅ Presupuestos per technical department
- ✅ Hojas de Gastos per department
- ✅ Crew Call line items (sound/lights) with `flex_crew_calls` persistence
- ✅ Comercial Extras with nested presupuestos
- ✅ Pull Sheets (for tour-date jobs, additional logic L416–505)
- ✅ Full `flex_folders` mirroring for every created element
- ✅ Per-department asset creation notifications (via activity logs & push)

---

## Delta: Backend vs Frontend Creation

| **Feature**                                         | **Backend (create-flex-folders)** | **Frontend (createAllFoldersForJob)** |
|-----------------------------------------------------|-----------------------------------|---------------------------------------|
| **Creates main/root folder**                        | ✅ Yes (tour main)                | ✅ Yes (job main_event)               |
| **Creates top-level dept folders**                  | ✅ Yes (shallow only)             | ✅ Yes (with full trees)              |
| **Creates date-specific folders**                   | ✅ Yes (tour_date folders)        | ❌ No (N/A for jobs)                  |
| **Creates Hoja Info (SX/LX/VX)**                    | ❌ No                             | ✅ Yes                                 |
| **Creates Documentación Técnica**                   | ❌ No                             | ✅ Yes (per dept, with metadata)      |
| **Creates Presupuestos**                            | ❌ No                             | ✅ Yes (tech depts)                    |
| **Creates Hojas de Gastos**                         | ❌ No                             | ✅ Yes (all depts)                     |
| **Creates Crew Calls**                              | ❌ No                             | ✅ Yes (sound/lights, line-items)     |
| **Creates Pull Sheets**                             | ❌ No                             | ✅ Yes (tour-date jobs)                |
| **Creates Comercial Extras**                        | ❌ No                             | ✅ Yes (with presupuesto subfolders)  |
| **Persists dept children in `flex_folders`**        | ❌ No (only date folder element)  | ✅ Yes (all elements)                  |
| **Updates `flex_crew_calls` table**                 | ❌ No                             | ✅ Yes                                 |
| **Sets responsible persons per dept**               | ❌ No                             | ✅ Yes (via constants)                 |
| **Broadcasts dept-level asset notifications**       | ❌ No                             | ✅ Yes (via log_activity_as)           |
| **Supports subfolder selection options**            | ❌ No                             | ✅ Yes (CreateFoldersOptions)          |
| **Custom pullsheet metadata (dates, names)**        | ❌ No                             | ✅ Yes (configurable per dept)         |
| **Dry hire workflow support**                       | ❌ No                             | ✅ Yes (separate logic L200–242)      |
| **Tour-date job workflow (dept under date folder)** | ❌ No                             | ✅ Yes (L252–533)                      |
| **Manual root folder creation path**                | ❌ No                             | ✅ Yes (via secure-flex-api proxy)    |

---

## Feature Gap Summary

### What the backend tour/tour-date workflow lacks compared to frontend job creation:

#### 1. **No Per-Department Subfolder Trees**

Backend creates **shallow** department folders under date folders but does not provision any children (doc técnica, hoja info, crew calls, etc.).

**Impact:**
- Users must manually create assets in Flex UI
- No local Supabase tracking for department-level elements
- `archive-to-flex` function cannot automatically discover doc técnica for tour-date jobs without manual backfill
- No crew call tracking for tour dates

**To achieve parity:**
- Backend must iterate selected departments and create:
  - Hoja Info (SX/LX/VX) per technical dept
  - Documentación Técnica remote file list per dept
  - Presupuestos (technical depts)
  - Hojas de Gastos
  - Crew Calls (sound/lights) with `flex_crew_calls` persistence
  - Comercial Extras structure

#### 2. **No Local Supabase Mirroring for Department Children**

Backend inserts **only one** `flex_folders` row per tour_date (`folder_type='tour_date'`), leaving department children unmapped.

**Impact:**
- Functions like `backfill-flex-doc-tecnica` and `archive-to-flex` must scan Flex API trees on every run (slow, fragile)
- No fast lookup for crew call IDs
- No status tracking for department-level elements

**To achieve parity:**
- Insert `flex_folders` rows for every created department subfolder:
  - `folder_type='department'`
  - `folder_type='doc_tecnica'`
  - `folder_type='hoja_info_sx'` / `'hoja_info_lx'` / `'hoja_info_vx'`
  - `folder_type='hoja_gastos'`
  - `folder_type='presupuesto'`
  - `folder_type='crew_call'`

#### 3. **No Crew Call Creation**

Backend does not create Flex line-item elements for crew calls.

**Impact:**
- `manage-flex-crew-assignments` and `sync-flex-crew-for-job` functions fail (no crew call mapping)
- No automated crew management for tour dates
- Users must manually create crew calls in Flex

**To achieve parity:**
- Create crew call line-items for sound/lights departments
- Insert `flex_crew_calls` rows: `(job_id, department, flex_element_id)`

#### 4. **No Department-Level Asset Notifications**

Backend broadcasts single `flex.tourdate_folder.created` push event; no granular notifications per department asset.

**Impact:**
- Users don't receive targeted notifications (e.g., "Doc técnica created for Sound")
- Activity feed lacks detail

**To achieve parity:**
- Call `log_activity_as` for each department folder creation
- Use department-specific activity codes (e.g., `flex.doc_tecnica.created`)

#### 5. **No Subfolder Selection Options**

Backend always creates all departments (conditional technical, always admin). No per-department subfolder opt-in/opt-out.

**Impact:**
- Cannot skip presupuestos or crew calls if not needed
- Inflexible compared to frontend `CreateFoldersOptions`

**To achieve parity:**
- Accept `CreateFoldersOptions` payload
- Respect subfolder selection flags per department

#### 6. **No Custom Pull Sheet Metadata**

Frontend supports custom pullsheet names and dates per department. Backend has no pull sheet logic.

**Impact:**
- Tour-date jobs can't leverage specialized pullsheet workflows
- Metadata must be manually entered in Flex

**To achieve parity:**
- Add pull sheet creation logic with metadata support

#### 7. **No Responsible Person Assignment**

Backend does not set `personResponsibleId` on created elements.

**Impact:**
- Elements appear unowned in Flex
- No automatic notifications to responsible persons

**To achieve parity:**
- Use `RESPONSIBLE_PERSON_IDS` constants per department when creating elements

---

## Recommendations for Backend Refactor

### High Priority (Blocking for tour-date automation)
1. **Create per-department subfolder trees** matching job creation logic
2. **Insert all department children into `flex_folders`** for local mirroring
3. **Create crew calls** and persist `flex_crew_calls` mappings
4. **Set responsible persons** using department-specific constants

### Medium Priority (Improves UX, observability)
5. **Add department-level activity logs** for granular notifications
6. **Support subfolder selection options** via request payload
7. **Broadcast per-asset push notifications** (e.g., doc_tecnica.created per dept)

### Low Priority (Nice-to-have, advanced features)
8. **Add custom pull sheet metadata** for tour-date jobs
9. **Support dry hire workflow** for tour contexts (if applicable)
10. **Unify tour root creation path** (deprecate manual vs edge function split)

---

## Related Documentation

- [Flex Folder Workflows](./flex-folder-workflows.md) - Overview of all folder creation entry points
- [Flex Frontend Architecture](./flex-frontend-architecture.md) - Comprehensive frontend module analysis
- [Push Notifications Summary](./PUSH_NOTIFICATIONS_SUMMARY.md) - Push notification patterns

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-29  
**Maintainer:** Sector Pro Engineering
