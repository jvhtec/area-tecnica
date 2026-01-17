# Detailed Page Component Trees with Permission Annotations

This document provides detailed component hierarchies for all major pages with **complete permission annotations** for every component, dialog, button, form field, and interactive element.

## Permission Legend

- **[All]** - All authenticated users
- **[Admin]** - Admin only
- **[Mgmt]** - Management only
- **[Admin+Mgmt]** - Admin and Management
- **[Admin+Mgmt+Log]** - Admin, Management, and Logistics
- **[HT]** - House Tech only
- **[Tech]** - Technician only
- **[Dept]** - Department-filtered (house_tech/technician see only their department)
- **[Sound]** - Sound department users only
- **[Read-Only]** - View only, no edit capability
- **[Conditional]** - Role-specific conditions apply
- **🔒** - Protected/restricted access
- **👁️** - View-only access

---

## Table of Contents

1. [Department Pages](#department-pages)
2. [Personal/House Tech Calendar](#personalhouse-tech-calendar)
3. [Project Management](#project-management)
4. [Festival Management](#festival-management)
5. [Job Card Actions (Shared Component)](#job-card-actions-shared-component)
6. [User Management](#user-management)
7. [SoundVision Files](#soundvision-files)
8. [Common Dialogs & Modals](#common-dialogs--modals)

---

## Department Pages

### Sound Department Page
**File**: `src/pages/Sound.tsx`
**Route**: `/sound`
**Access**: **[All]** authenticated users

```
SoundDepartmentPage
 ├─ PageHeader **[All]**
 │   ├─ Title: "Sound Department"
 │   └─ Actions
 │       └─ Button: "New Job" **[Admin+Mgmt]** (line 162)
 │           └─ Opens: CreateJobDialog **[Admin+Mgmt]**
 │
 ├─ JobsGrid **[All]**
 │   └─ JobCard[] **[All]** - List of all sound jobs
 │       ├─ JobInfo **[All]** - Basic job information
 │       └─ JobCardActions **[Conditional]** (see detailed breakdown below)
 │           ├─ Delete Button **[Admin+Mgmt]** 🔒 (lines 118-125)
 │           ├─ Edit Button **[Admin+Mgmt]** 🔒
 │           ├─ Assign Button **[Admin+Mgmt+Log]** 🔒
 │           ├─ Upload Docs **[Admin+Mgmt+Log]** 🔒
 │           ├─ View Details **[All]**
 │           └─ ... (see JobCardActions section)
 │
 ├─ ToolsPanel **[All]**
 │   ├─ Button: Weight Calculator **[All]**
 │   ├─ Button: Power Calculator **[All]**
 │   ├─ Button: SV Report Generator **[All]**
 │   ├─ Button: Amplifier Calculator **[All]**
 │   ├─ Button: Memoria Técnica **[All]**
 │   ├─ Button: Incident Report **[All]**
 │   └─ Button: Festivals **[All]** → navigates to /festivals
 │
 └─ SoundVisionPanel **[Conditional]** (lines 265-285)
     ├─ Button: "Archivos SoundVision" **[Has SV Access]**
     │   └─ navigates to /soundvision-files
     └─ Button: "Request SoundVision Access" **[No SV Access]**
         └─ Opens: RequestAccessDialog **[No SV Access]**
```

### Lights Department Page
**File**: `src/pages/Lights.tsx`
**Route**: `/lights`
**Access**: **[All]** authenticated users

```
LightsDepartmentPage
 ├─ PageHeader **[All]**
 │   ├─ Title: "Lights Department"
 │   └─ Actions
 │       └─ Button: "New Job" **[Admin+Mgmt]** 🔒 (line 160)
 │           └─ Opens: CreateJobDialog **[Admin+Mgmt]**
 │
 ├─ JobsGrid **[All]**
 │   └─ JobCard[] **[All]**
 │       ├─ JobInfo **[All]**
 │       └─ JobCardActions **[Conditional]**
 │           ├─ Delete Button **[Admin+Mgmt]** 🔒 (lines 117-124)
 │           ├─ Edit Button **[Admin+Mgmt]** 🔒
 │           ├─ Assign Button **[Admin+Mgmt+Log]** 🔒
 │           └─ ... (see JobCardActions section)
 │
 └─ ToolsPanel **[All]**
     ├─ Button: Light Planner **[All]**
     ├─ Button: Fixture Library **[All]**
     └─ Button: DMX Calculator **[All]**
```

### Video Department Page
**File**: `src/pages/Video.tsx`
**Route**: `/video`
**Access**: **[All]** authenticated users
**⚠️ SECURITY ISSUE**: Delete has no permission check (lines 128-151)

```
VideoDepartmentPage
 ├─ PageHeader **[All]**
 │   ├─ Title: "Video Department"
 │   └─ Actions
 │       └─ Button: "New Job" **[Admin+Mgmt]** 🔒 (line 158)
 │           └─ Opens: CreateJobDialog **[Admin+Mgmt]**
 │
 ├─ JobsGrid **[All]**
 │   └─ JobCard[] **[All]**
 │       ├─ JobInfo **[All]**
 │       └─ JobCardActions **[Conditional]**
 │           ├─ Delete Button **[⚠️ All]** NO PERMISSION CHECK! (lines 128-151)
 │           ├─ Edit Button **[Admin+Mgmt]** 🔒
 │           ├─ Assign Button **[Admin+Mgmt+Log]** 🔒
 │           └─ ... (see JobCardActions section)
 │
 └─ ToolsPanel **[All]**
     ├─ Button: Video Catalog **[All]**
     └─ Button: Streaming Calculator **[All]**
```

---

## Personal/House Tech Calendar

**File**: `src/pages/Personal.tsx`
**Route**: `/personal`
**Access**: **[Admin+Mgmt+HT]** - Technicians redirected to /technician-dashboard

```
PersonalCalendarPage
 ├─ Redirect Check **[Tech]** (lines 25-30)
 │   └─ IF role === 'technician' → navigate('/technician-dashboard')
 │
 ├─ PageHeader **[Admin+Mgmt+HT]**
 │   ├─ Title: "House Tech Calendar"
 │   └─ Actions
 │       └─ MonthSelector **[Admin+Mgmt+HT]**
 │
 ├─ CalendarGrid **[Admin+Mgmt+HT]**
 │   ├─ Permission Check (line 79):
 │   │   canEditDates = userRole === 'admin' || userRole === 'management'
 │   │
 │   ├─ CalendarHeader **[Admin+Mgmt+HT]**
 │   │   ├─ WeekdayLabels **[Admin+Mgmt+HT]**
 │   │   └─ HouseTechNames **[Admin+Mgmt+HT]**
 │   │
 │   └─ CalendarDays[] **[Admin+Mgmt+HT]**
 │       └─ DayCell **[Conditional]**
 │           ├─ Date Display **[Admin+Mgmt+HT]**
 │           ├─ Status Indicators **[Admin+Mgmt+HT]**
 │           │   ├─ Available (green)
 │           │   ├─ Unavailable (red)
 │           │   ├─ Vacation (blue)
 │           │   └─ Working (yellow)
 │           │
 │           └─ Click Handler **[Admin+Mgmt]** 🔒
 │               ├─ IF canEditDates → Mark availability
 │               └─ IF !canEditDates → View only
 │
 ├─ VacationRequestsPanel **[Admin+Mgmt+HT]** (lines 57-64)
 │   ├─ Title: "Vacation Requests"
 │   ├─ VacationRequestsList **[Admin+Mgmt+HT]**
 │   │   └─ VacationRequestItem[] **[Admin+Mgmt+HT]**
 │   │       ├─ RequestInfo **[Admin+Mgmt+HT]**
 │   │       └─ Actions
 │   │           ├─ Approve Button **[Admin+Mgmt]** 🔒
 │   │           ├─ Reject Button **[Admin+Mgmt]** 🔒
 │   │           └─ View Button **[Admin+Mgmt+HT]**
 │   │
 │   └─ Button: "Submit Vacation Request" **[Admin+Mgmt+HT]**
 │       └─ Opens: VacationRequestDialog **[Admin+Mgmt+HT]**
 │
 └─ NoAccessMessage **[Tech+Log]**
     └─ "Vacation request features are available for house technicians, admins, and management only"
```

---

## Project Management

**File**: `src/pages/ProjectManagement.tsx`
**Route**: `/project-management`
**Access**: **[Admin+Mgmt+Log+Tech]** - Technicians see festivals only (view-only)

```
ProjectManagementPage
 ├─ Permission Check (line 76):
 │   canCreateItems = ['admin', 'management', 'logistics'].includes(userRole)
 │
 ├─ PageHeader **[All]**
 │   ├─ Title: "Project Management"
 │   └─ Actions
 │       └─ Button: "New Festival Job" **[Admin+Mgmt+Log]** 🔒
 │           └─ Opens: CreateFestivalJobDialog **[Admin+Mgmt+Log]**
 │
 ├─ FilterBar **[All]**
 │   ├─ StatusFilter **[All]**
 │   ├─ DateRangeFilter **[All]**
 │   └─ SearchInput **[All]**
 │
 ├─ AutoCompleteSection **[Admin+Mgmt+Log]** 🔒
 │   └─ Button: "Auto-complete Jobs" **[Admin+Mgmt+Log]**
 │       └─ Marks jobs as complete automatically
 │
 ├─ JobsGrid **[All]**
 │   └─ JobCard[] **[Conditional]**
 │       ├─ JobInfo **[All]**
 │       │   ├─ FestivalName **[All]**
 │       │   ├─ Dates **[All]**
 │       │   ├─ Status **[All]**
 │       │   └─ AssignedCrew **[All]**
 │       │
 │       └─ JobCardActions **[Conditional]**
 │           ├─ Tasks Button **[Admin+Mgmt+Log]** (lines 731-742)
 │           │   └─ IF isProjectManagementPage && job_type !== 'dryhire'
 │           │
 │           ├─ WhatsApp Group **[Admin+Mgmt]** 🔒 (lines 754-766)
 │           │   └─ IF isProjectManagementPage && (management || admin) && job_type not in ['tourdate', 'dryhire']
 │           │
 │           ├─ Almacén Message **[Admin+Mgmt]** 🔒 (lines 767-782)
 │           │   └─ IF isProjectManagementPage && (management || admin)
 │           │
 │           ├─ View Details **[All]** (lines 784-794)
 │           │
 │           ├─ Manage Festival **[Conditional]** (lines 796-807)
 │           │   ├─ IF job_type === 'festival' && isProjectManagementPage && canManageArtists
 │           │   ├─ Label: "View Festival" **[Tech+HT]** 👁️
 │           │   └─ Label: "Manage Festival" **[Admin+Mgmt+Log]**
 │           │
 │           ├─ Assign Button **[Admin+Mgmt+Log]** 🔒 (lines 820-831)
 │           │   └─ Hidden for house_tech (!isHouseTech)
 │           │
 │           ├─ Refresh Button **[All]** (lines 832-839)
 │           │
 │           ├─ Timesheet **[All]** (lines 852-862)
 │           │   └─ IF job_type not in ['dryhire', 'tourdate']
 │           │
 │           ├─ Calculators **[Mgmt]** 🔒 (lines 864-889)
 │           │   ├─ Permission: userRole === 'management' && isProjectManagementPage
 │           │   ├─ Pesos Calculator **[Mgmt]**
 │           │   └─ Consumos Calculator **[Mgmt]**
 │           │
 │           ├─ Technician Incident Report **[Tech]** 🔒 (lines 890-895)
 │           │   └─ IF userRole === 'technician' && job_type !== 'dryhire'
 │           │
 │           ├─ Edit/Delete **[Admin+Mgmt]** 🔒 (lines 896-916)
 │           │   └─ IF canEditJobs (admin, management)
 │           │
 │           ├─ Flex Folder **[Admin+Mgmt+Log]** 🔒 (lines 917-971)
 │           │   └─ IF canCreateFlexFolders
 │           │
 │           ├─ Archive **[All]** (lines 991-1002)
 │           │   └─ IF job_type !== 'dryhire'
 │           │
 │           └─ Upload Documents **[Admin+Mgmt+Log]** 🔒 (lines 1014-1026)
 │               └─ IF canUploadDocuments && showUpload && job_type !== 'dryhire'
 │
 └─ TechnicianView **[Tech]** 👁️
     └─ Filtered to festival jobs only (line 157 comment)
```

---

## Festival Management

**File**: `src/pages/FestivalManagement.tsx`
**Route**: `/festivals` or `/festival-management/:festivalId`
**Access**: **[Admin+Mgmt+Log]** + **[Sound HT+Tech]** 👁️ (view-only for Sound dept)

```
FestivalManagementPage
 ├─ Permission Check (line 106):
 │   userRole from useOptimizedAuth()
 │   Sound department house_tech/technician get view-only access
 │
 ├─ PageHeader **[All with access]**
 │   ├─ Title: Festival Name
 │   ├─ FestivalDetails **[All with access]**
 │   │   ├─ Dates
 │   │   ├─ Venue
 │   │   └─ Status
 │   │
 │   └─ Actions
 │       ├─ Button: "Add Artist" **[Admin+Mgmt+Log]** 🔒
 │       │   └─ Permission: canManageFestivalArtists(role)
 │       │   └─ Opens: AddArtistDialog **[Admin+Mgmt+Log]**
 │       │
 │       ├─ Button: "Upload Documents" **[Admin+Mgmt+Log]** 🔒
 │       │   └─ Permission: canUploadDocuments(role)
 │       │   └─ Opens: UploadDialog **[Admin+Mgmt+Log]**
 │       │
 │       └─ Button: "Sync to Flex" **[Admin+Mgmt]** 🔒
 │           └─ Permission: ['admin', 'management'].includes(role)
 │
 ├─ Tabs **[All with access]**
 │   ├─ Tab: Overview **[All with access]**
 │   ├─ Tab: Artists **[All with access]**
 │   ├─ Tab: Documents **[All with access]**
 │   └─ Tab: Tools **[All with access]**
 │
 ├─ OverviewTab **[All with access]**
 │   ├─ FestivalStats **[All with access]**
 │   │   ├─ TotalArtists
 │   │   ├─ TotalDocuments
 │   │   └─ CrewAssigned
 │   │
 │   └─ QuickActions **[Conditional]**
 │       ├─ Button: "Send WhatsApp" **[Admin+Mgmt]** 🔒
 │       └─ Button: "Create Flex Folders" **[Admin+Mgmt+Log]** 🔒
 │
 ├─ ArtistsTab **[All with access]**
 │   ├─ ArtistsList **[All with access]**
 │   │   └─ ArtistCard[] **[All with access]**
 │   │       ├─ ArtistInfo **[All with access]**
 │   │       │   ├─ Name
 │   │       │   ├─ Performance Time
 │   │       │   └─ Stage
 │   │       │
 │   │       └─ Actions **[Conditional]**
 │   │           ├─ Edit Button **[Admin+Mgmt+Log]** 🔒
 │   │           │   └─ Opens: EditArtistDialog **[Admin+Mgmt+Log]**
 │   │           ├─ Delete Button **[Admin+Mgmt]** 🔒
 │   │           │   └─ Permission: canDeleteDocuments(role)
 │   │           └─ View Details **[All with access]**
 │   │
 │   └─ ViewOnlyMessage **[Sound HT+Tech]** 👁️
 │       └─ "You have view-only access to festival data"
 │
 ├─ DocumentsTab **[All with access]**
 │   ├─ DocumentsList **[All with access]**
 │   │   └─ DocumentItem[] **[All with access]**
 │   │       ├─ DocumentInfo **[All with access]**
 │   │       │   ├─ FileName
 │   │       │   ├─ FileSize
 │   │       │   └─ UploadDate
 │   │       │
 │   │       └─ Actions **[Conditional]**
 │   │           ├─ Download **[All with access]**
 │   │           ├─ Delete **[Admin+Mgmt]** 🔒
 │   │           │   └─ Permission: canDeleteDocuments(role)
 │   │           └─ Archive **[Admin+Mgmt]** 🔒
 │   │               └─ Opens: ArchiveDialog **[Admin+Mgmt]**
 │   │
 │   └─ Button: "Upload Document" **[Admin+Mgmt+Log]** 🔒
 │       └─ Permission: canUploadDocuments(role)
 │
 └─ ToolsTab **[All with access]**
     ├─ Button: "Pesos Calculator" **[Mgmt]** 🔒
     ├─ Button: "Consumos Calculator" **[Mgmt]** 🔒
     └─ Button: "Festival Report" **[All with access]**
```

---

## Job Card Actions (Shared Component)

**File**: `src/components/jobs/cards/JobCardActions.tsx`
**Used in**: Sound, Lights, Video, Project Management pages
**Props-based Permissions** (lines 83-122):

```typescript
interface JobCardActionsProps {
  userRole: string | null
  canEditJobs: boolean           // [Admin+Mgmt]
  canCreateFlexFolders: boolean  // [Admin+Mgmt+Log]
  canUploadDocuments: boolean    // [Admin+Mgmt+Log]
  canManageArtists: boolean      // [All except wallboard]
  isHouseTech: boolean           // Hides assign button
  isProjectManagementPage: boolean  // Context flag
}
```

### Complete Action Buttons Breakdown

```
JobCardActions **[Conditional based on props]**
 ├─ Tasks Button **[Conditional]** (lines 731-742)
 │   ├─ Render: IF isProjectManagementPage && job.job_type !== 'dryhire'
 │   └─ Opens: TaskManagerDialog **[Same as button access]**
 │
 ├─ WhatsApp Group Button **[Admin+Mgmt]** 🔒 (lines 754-766)
 │   ├─ Render: IF isProjectManagementPage
 │   │          && (userRole === 'management' || userRole === 'admin')
 │   │          && job.job_type not in ['tourdate', 'dryhire']
 │   └─ Action: Creates WhatsApp group link
 │
 ├─ Almacén Message Button **[Admin+Mgmt]** 🔒 (lines 767-782)
 │   ├─ Render: IF isProjectManagementPage
 │   │          && (userRole === 'management' || userRole === 'admin')
 │   └─ Action: Sends message to warehouse
 │
 ├─ View Details Button **[All]** (lines 784-794)
 │   ├─ Render: IF onJobDetailsClick provided
 │   └─ Opens: JobDetailsModal **[All]**
 │
 ├─ Manage Festival Button **[Conditional]** (lines 796-807)
 │   ├─ Render: IF job.job_type === 'festival'
 │   │          && isProjectManagementPage
 │   │          && canManageArtists
 │   ├─ Label: "View Festival" **[Tech+HT]** 👁️
 │   ├─ Label: "Manage Festival" **[Admin+Mgmt+Log]**
 │   └─ Opens: FestivalManagementPage
 │
 ├─ Manage Job Button **[Conditional]** (lines 808-819)
 │   ├─ Render: IF job.job_type not in ['festival', 'dryhire']
 │   │          && isProjectManagementPage
 │   │          && canManageArtists
 │   └─ Opens: JobManagementDialog
 │
 ├─ Assign Button **[Admin+Mgmt+Log]** 🔒 (lines 820-831)
 │   ├─ Render: IF !isHouseTech
 │   │          && job.job_type !== 'dryhire'
 │   │          && isProjectManagementPage
 │   └─ Opens: AssignPersonnelDialog **[Admin+Mgmt+Log]**
 │
 ├─ Refresh Button **[All]** (lines 832-839)
 │   └─ Action: Refreshes job data
 │
 ├─ Timesheet Button **[All]** (lines 852-862)
 │   ├─ Render: IF job.job_type not in ['dryhire', 'tourdate']
 │   └─ Opens: TimesheetDialog **[All]**
 │
 ├─ Calculator Buttons **[Mgmt]** 🔒 (lines 864-889)
 │   ├─ Permission Check (line 307):
 │   │   canViewCalculators = isProjectManagementPage && userRole === 'management'
 │   │
 │   ├─ Render: IF canViewCalculators
 │   │          && job.job_type in ['single', 'festival', 'tourdate']
 │   │
 │   ├─ Pesos Calculator Button **[Mgmt]** 🔒
 │   │   ├─ Badge: Green dot if tour defaults exist
 │   │   └─ Opens: PesosCalculatorDialog **[Mgmt]**
 │   │
 │   └─ Consumos Calculator Button **[Mgmt]** 🔒
 │       └─ Opens: ConsumosCalculatorDialog **[Mgmt]**
 │
 ├─ Technician Incident Report **[Tech]** 🔒 (lines 890-895)
 │   ├─ Render: IF userRole === 'technician'
 │   │          && job.job_type !== 'dryhire'
 │   └─ Opens: IncidentReportDialog **[Tech]**
 │
 ├─ Edit/Delete Buttons **[Admin+Mgmt]** 🔒 (lines 896-916)
 │   ├─ Render: IF canEditJobs (admin, management)
 │   ├─ Edit Button **[Admin+Mgmt]** 🔒
 │   │   └─ Opens: EditJobDialog **[Admin+Mgmt]**
 │   └─ Delete Button **[Admin+Mgmt]** 🔒
 │       └─ Opens: DeleteConfirmDialog **[Admin+Mgmt]**
 │
 ├─ Flex Folder Buttons **[Admin+Mgmt+Log]** 🔒 (lines 917-971)
 │   ├─ Render: IF canCreateFlexFolders
 │   ├─ IF folders exist:
 │   │   └─ Button: "Open Flex" **[Admin+Mgmt+Log]**
 │   │       └─ Opens Flex in new tab
 │   └─ IF not exist:
 │       └─ Button: "Create Flex folders" **[Admin+Mgmt+Log]**
 │           └─ Creates folder structure in Flex
 │
 ├─ Create Local Folders **[All]** (lines 972-989)
 │   └─ Button: Creates local folder structure
 │
 ├─ Archive Button **[All]** (lines 991-1002)
 │   ├─ Render: IF job.job_type !== 'dryhire'
 │   └─ Opens: ArchiveToFlexDialog **[All]**
 │
 ├─ Backfill Button **[All]** (lines 1004-1013)
 │   └─ Action: Backfills missing job data
 │
 └─ Upload Documents **[Admin+Mgmt+Log]** 🔒 (lines 1014-1026)
     ├─ Render: IF job.job_type !== 'dryhire'
     │          && showUpload
     │          && canUploadDocuments
     └─ Opens: UploadDocumentsDialog **[Admin+Mgmt+Log]**
```

---

## User Management

### Edit User Dialog

**File**: `src/components/users/EditUserDialog.tsx`
**Access**: **[Admin+Mgmt]** - But field-level permissions vary

```typescript
// Permission Check (lines 30-31)
const isManagementUser = ['admin', 'management'].includes(userRole || '')
```

```
EditUserDialog **[Admin+Mgmt]**
 ├─ DialogHeader **[Admin+Mgmt]**
 │   ├─ Title: "Edit User"
 │   └─ CloseButton **[Admin+Mgmt]**
 │
 ├─ DialogBody **[Admin+Mgmt]**
 │   ├─ Form **[Admin+Mgmt]**
 │   │   ├─ Input: First Name **[Admin+Mgmt]**
 │   │   ├─ Input: Nickname **[Admin+Mgmt]**
 │   │   ├─ Input: Last Name **[Admin+Mgmt]**
 │   │   ├─ Input: Phone **[Admin+Mgmt]**
 │   │   ├─ Select: Department **[Admin+Mgmt]**
 │   │   ├─ Select: Role **[Admin+Mgmt]**
 │   │   ├─ Input: DNI **[Admin+Mgmt]**
 │   │   ├─ Input: Residencia **[Admin+Mgmt]**
 │   │   ├─ Checkbox: Assignable as Tech **[Admin+Mgmt]**
 │   │   │
 │   │   ├─ Checkbox: Autónomo **[Admin+Mgmt]**
 │   │   │   └─ Visible: IF user.role === 'technician'
 │   │   │
 │   │   ├─ Checkbox: SoundVision Access **[Mgmt ONLY]** 🔒 (lines 158-175)
 │   │   │   ├─ Visible: IF isManagementUser
 │   │   │   │          && (isSoundTechnician || isSoundHouseTech)
 │   │   │   ├─ Behavior for Sound House Tech:
 │   │   │   │   └─ Force-enabled (cannot disable)
 │   │   │   └─ Behavior for Sound Technician:
 │   │   │       └─ Editable toggle
 │   │   │
 │   │   ├─ Flex Resource ID Section **[Mgmt ONLY]** 🔒 (lines 194-247)
 │   │   │   ├─ Visible: IF isManagementUser
 │   │   │   ├─ Input: Flex Resource ID **[Mgmt]** 🔒
 │   │   │   ├─ Input: Paste Flex URL **[Mgmt]** 🔒
 │   │   │   │   └─ Helper to extract ID from URL
 │   │   │   └─ Button: Extract ID **[Mgmt]** 🔒
 │   │   │
 │   │   ├─ Button: Send Onboarding Email **[Mgmt ONLY]** 🔒 (lines 316-326)
 │   │   │   ├─ Visible: IF isManagementUser
 │   │   │   └─ Opens: SendEmailConfirmDialog **[Mgmt]** 🔒
 │   │   │
 │   │   └─ HouseTechRateEditor **[Mgmt ONLY]** 🔒 (lines 334-343)
 │   │       ├─ Visible: IF isManagementUser && user?.id
 │   │       └─ Component: Allows editing custom rates
 │   │
 │   └─ FormValidation **[Admin+Mgmt]**
 │       └─ Client-side validation for all fields
 │
 └─ DialogFooter **[Admin+Mgmt]**
     ├─ Button: Cancel **[Admin+Mgmt]**
     └─ Button: Save **[Admin+Mgmt]**
         └─ Submits user update
```

### Users List Component

**File**: `src/components/users/UsersListContent.tsx`
**Access**: **[Admin+Mgmt]**

```
UsersListContent **[Admin+Mgmt]**
 ├─ Permission Prop (lines 20-23):
 │   isManagementUser?: boolean  // Controls skills management access
 │
 ├─ TableHeader **[Admin+Mgmt]**
 │   ├─ Column: Name
 │   ├─ Column: Role
 │   ├─ Column: Department
 │   ├─ Column: Skills
 │   └─ Column: Actions
 │
 └─ TableBody **[Admin+Mgmt]**
     └─ UserRow[] **[Admin+Mgmt]**
         ├─ UserInfo **[Admin+Mgmt]**
         │   ├─ Avatar
         │   ├─ Name
         │   ├─ Email
         │   └─ Phone
         │
         ├─ RoleBadge **[Admin+Mgmt]**
         ├─ DepartmentBadge **[Admin+Mgmt]**
         ├─ SkillsList **[Admin+Mgmt]**
         │
         └─ Actions **[Conditional]**
             ├─ Button: Edit **[Admin+Mgmt]**
             │   └─ Opens: EditUserDialog **[Admin+Mgmt]**
             │
             ├─ Button: Manage Skills **[Mgmt ONLY]** 🔒 (lines 55, 112)
             │   ├─ Visible: IF isManagementUser === true
             │   └─ Opens: ManageSkillsDialog **[Mgmt]** 🔒
             │
             └─ Button: Delete **[Admin]** 🔒
                 └─ Opens: DeleteUserConfirmDialog **[Admin]**
```

---

## SoundVision Files

**File**: `src/components/soundvision/SoundVisionFilesList.tsx`
**Access**: **[All with soundvision_access_enabled flag]**

```typescript
// Permission Checks (lines 40-63)
const canDelete = canDeleteSoundVisionFiles(profile?.role)  // [Admin+Mgmt]
const isManagement = profile?.role === 'admin' || profile?.role === 'management'

// Review Access (lines 73-74)
const canOpenReviews = (file: SoundVisionFile) =>
  isManagement || file.hasDownloaded || file.hasReviewed
```

```
SoundVisionFilesPage **[Has SV Access]**
 ├─ PageHeader **[Has SV Access]**
 │   ├─ Title: "SoundVision Files"
 │   └─ Actions
 │       └─ Button: "Upload File" **[Admin+Mgmt+Log+HT+Tech]** 🔒
 │           └─ Permission: canUploadSoundVisionFiles(role)
 │           └─ Opens: UploadSVFileDialog
 │
 ├─ FilterBar **[Has SV Access]**
 │   ├─ DateFilter
 │   ├─ FileTypeFilter
 │   └─ SearchInput
 │
 └─ FilesList **[Has SV Access]**
     └─ FileCard[] **[Has SV Access]**
         ├─ FileInfo **[Has SV Access]**
         │   ├─ FileName
         │   ├─ FileSize
         │   ├─ UploadDate
         │   ├─ UploadedBy
         │   └─ DownloadStatus
         │       ├─ hasDownloaded indicator
         │       └─ hasReviewed indicator
         │
         └─ Actions **[Conditional]**
             ├─ Download Button **[Has SV Access]**
             │   └─ Downloads file and marks as downloaded
             │
             ├─ Reviews Button **[Conditional]** (lines 178, 284)
             │   ├─ Enabled: IF canOpenReviews(file)
             │   │   ├─ Management: Always enabled **[Admin+Mgmt]**
             │   │   └─ Others: Must download first **[Log+HT+Tech]**
             │   ├─ Disabled: IF !canOpenReviews(file)
             │   │   └─ Tooltip: "Download the file first to access reviews"
             │   └─ Opens: SVReviewDialog **[Conditional]**
             │
             └─ Delete Button **[Admin+Mgmt]** 🔒 (lines 198-220, 289-328)
                 ├─ Visible: IF canDelete === true
                 ├─ Permission: canDeleteSoundVisionFiles(role)
                 └─ Opens: DeleteConfirmDialog **[Admin+Mgmt]**
```

### SoundVision Review Dialog

```
SVReviewDialog **[Conditional Access]**
 ├─ Access Rules:
 │   ├─ Management: Always can access **[Admin+Mgmt]**
 │   └─ Others: Must download file first **[Log+HT+Tech after download]**
 │
 ├─ DialogHeader
 │   ├─ Title: File Name
 │   └─ FileInfo summary
 │
 ├─ DialogBody
 │   ├─ ReviewsList **[All with access]**
 │   │   └─ ReviewItem[] **[All with access]**
 │   │       ├─ ReviewerAvatar
 │   │       ├─ ReviewerName
 │   │       ├─ ReviewDate
 │   │       ├─ ReviewText
 │   │       └─ Actions
 │   │           └─ Delete **[Admin+Mgmt+Own Review]** 🔒
 │   │
 │   └─ AddReviewForm **[All with access]**
 │       ├─ Textarea: Review Comment
 │       └─ Button: Submit Review
 │           └─ Marks file as reviewed
 │
 └─ DialogFooter
     └─ Button: Close
```

---

## Common Dialogs & Modals

### Create Job Dialog
**Access**: **[Admin+Mgmt]** 🔒
**Used in**: Sound, Lights, Video department pages

```
CreateJobDialog **[Admin+Mgmt]** 🔒
 ├─ DialogHeader
 │   └─ Title: "Create New Job"
 │
 ├─ DialogBody
 │   ├─ Form
 │   │   ├─ Input: Job Name **[Admin+Mgmt]**
 │   │   ├─ Select: Job Type **[Admin+Mgmt]**
 │   │   ├─ Select: Department **[Admin+Mgmt]**
 │   │   ├─ DatePicker: Start Date **[Admin+Mgmt]**
 │   │   ├─ DatePicker: End Date **[Admin+Mgmt]**
 │   │   ├─ Input: Client **[Admin+Mgmt]**
 │   │   ├─ Input: Venue **[Admin+Mgmt]**
 │   │   └─ Textarea: Notes **[Admin+Mgmt]**
 │   │
 │   └─ FormValidation **[Admin+Mgmt]**
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Admin+Mgmt]**
     └─ Button: Create **[Admin+Mgmt]**
```

### Edit Job Dialog
**Access**: **[Admin+Mgmt]** 🔒

```
EditJobDialog **[Admin+Mgmt]** 🔒
 ├─ DialogHeader
 │   └─ Title: "Edit Job"
 │
 ├─ DialogBody
 │   └─ Form (same fields as CreateJobDialog)
 │       └─ All fields editable **[Admin+Mgmt]**
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Admin+Mgmt]**
     └─ Button: Save Changes **[Admin+Mgmt]**
```

### Assign Personnel Dialog
**Access**: **[Admin+Mgmt+Log]** 🔒
**Hidden for**: House Tech (via isHouseTech prop)

```
AssignPersonnelDialog **[Admin+Mgmt+Log]** 🔒
 ├─ DialogHeader
 │   └─ Title: "Assign Personnel to Job"
 │
 ├─ DialogBody
 │   ├─ UserSearch **[Admin+Mgmt+Log]**
 │   │   ├─ SearchInput
 │   │   ├─ DepartmentFilter
 │   │   └─ RoleFilter
 │   │
 │   ├─ AvailableUsersList **[Admin+Mgmt+Log]**
 │   │   └─ UserItem[]
 │   │       ├─ UserInfo
 │   │       ├─ AvailabilityStatus
 │   │       └─ Button: Assign **[Admin+Mgmt+Log]**
 │   │
 │   └─ AssignedUsersList **[Admin+Mgmt+Log]**
 │       └─ AssignedUserItem[]
 │           ├─ UserInfo
 │           ├─ RoleInJob
 │           └─ Button: Remove **[Admin+Mgmt+Log]**
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Admin+Mgmt+Log]**
     └─ Button: Save Assignments **[Admin+Mgmt+Log]**
```

### Task Manager Dialog
**Access**: **[Admin+Mgmt+Log]** (Project Management context)
**Shown for**: job_type !== 'dryhire'

```
TaskManagerDialog **[Admin+Mgmt+Log]**
 ├─ DialogHeader
 │   ├─ Title: "Job Tasks"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ TasksList **[Admin+Mgmt+Log]**
 │   │   └─ TaskItem[] **[Admin+Mgmt+Log]**
 │   │       ├─ Checkbox: Complete **[Admin+Mgmt+Log]**
 │   │       ├─ TaskDescription **[Admin+Mgmt+Log]**
 │   │       ├─ AssignedTo **[Admin+Mgmt+Log]**
 │   │       ├─ DueDate **[Admin+Mgmt+Log]**
 │   │       └─ Actions
 │   │           ├─ Edit **[Admin+Mgmt+Log]**
 │   │           └─ Delete **[Admin+Mgmt+Log]**
 │   │
 │   └─ AddTaskForm **[Admin+Mgmt+Log]**
 │       ├─ Input: Task Description
 │       ├─ Select: Assign To
 │       ├─ DatePicker: Due Date
 │       └─ Button: Add Task
 │
 └─ DialogFooter
     └─ Button: Close
```

### Technician Incident Report Dialog
**Access**: **[Tech]** 🔒
**Shown for**: userRole === 'technician' && job_type !== 'dryhire'

```
TechnicianIncidentReportDialog **[Tech]** 🔒
 ├─ DialogHeader
 │   ├─ Title: "Report Incident"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ Form **[Tech]**
 │   │   ├─ Select: Incident Type **[Tech]**
 │   │   │   ├─ Equipment Failure
 │   │   │   ├─ Safety Issue
 │   │   │   ├─ Personnel Issue
 │   │   │   └─ Other
 │   │   │
 │   │   ├─ Select: Severity **[Tech]**
 │   │   │   ├─ Low
 │   │   │   ├─ Medium
 │   │   │   ├─ High
 │   │   │   └─ Critical
 │   │   │
 │   │   ├─ Textarea: Description **[Tech]**
 │   │   ├─ FileUpload: Photos **[Tech]**
 │   │   │   └─ Max 5 photos
 │   │   │
 │   │   └─ Checkbox: Notify Management **[Tech]**
 │   │
 │   └─ FormValidation **[Tech]**
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Tech]**
     └─ Button: Submit Report **[Tech]**
         └─ Creates incident and optionally notifies management
```

### WhatsApp Group Creation
**Access**: **[Admin+Mgmt]** 🔒
**Context**: Project Management page only

```
WhatsAppGroupCreation **[Admin+Mgmt]** 🔒
 ├─ Trigger: Button in JobCardActions
 │   └─ Permission: userRole === 'management' || userRole === 'admin'
 │
 └─ Action Flow
     ├─ Fetches assigned personnel
     ├─ Formats WhatsApp group link
     ├─ Generates invite message
     └─ Opens WhatsApp with pre-filled group creation
```

### Archive to Flex Dialog
**Access**: **[All]** (but typically management context)
**Shown for**: job_type !== 'dryhire'

```
ArchiveToFlexDialog **[All]**
 ├─ DialogHeader
 │   ├─ Title: "Archive to Flex"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ ArchiveOptions
 │   │   ├─ Checkbox: Include Documents **[All]**
 │   │   ├─ Checkbox: Include Timesheets **[All]**
 │   │   ├─ Checkbox: Include Photos **[All]**
 │   │   └─ Checkbox: Mark job as archived **[All]**
 │   │
 │   ├─ FlexFolderPath **[All]**
 │   │   └─ Shows destination path
 │   │
 │   └─ ProgressIndicator
 │       └─ Shows during archiving process
 │
 └─ DialogFooter
     ├─ Button: Cancel **[All]**
     └─ Button: Start Archive **[All]**
```

### Upload Documents Dialog
**Access**: **[Admin+Mgmt+Log]** 🔒
**Shown for**: canUploadDocuments && job_type !== 'dryhire'

```
UploadDocumentsDialog **[Admin+Mgmt+Log]** 🔒
 ├─ DialogHeader
 │   ├─ Title: "Upload Documents"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ FileUploader **[Admin+Mgmt+Log]**
 │   │   ├─ DropZone **[Admin+Mgmt+Log]**
 │   │   ├─ FileList **[Admin+Mgmt+Log]**
 │   │   │   └─ FileItem[]
 │   │   │       ├─ FileName
 │   │   │       ├─ FileSize
 │   │   │       ├─ UploadProgress
 │   │   │       └─ Button: Remove
 │   │   │
 │   │   └─ Button: Browse Files **[Admin+Mgmt+Log]**
 │   │
 │   ├─ Select: Document Category **[Admin+Mgmt+Log]**
 │   │   ├─ Technical Rider
 │   │   ├─ Stage Plot
 │   │   ├─ Contract
 │   │   ├─ Invoice
 │   │   └─ Other
 │   │
 │   └─ Textarea: Notes **[Admin+Mgmt+Log]**
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Admin+Mgmt+Log]**
     └─ Button: Upload **[Admin+Mgmt+Log]**
```

### Vacation Request Dialog
**Access**: **[Admin+Mgmt+HT]**

```
VacationRequestDialog **[Admin+Mgmt+HT]**
 ├─ DialogHeader
 │   └─ Title: "Submit Vacation Request"
 │
 ├─ DialogBody
 │   ├─ Form **[Admin+Mgmt+HT]**
 │   │   ├─ DatePicker: Start Date **[Admin+Mgmt+HT]**
 │   │   ├─ DatePicker: End Date **[Admin+Mgmt+HT]**
 │   │   ├─ Select: Request Type **[Admin+Mgmt+HT]**
 │   │   │   ├─ Vacation
 │   │   │   ├─ Sick Leave
 │   │   │   └─ Personal Day
 │   │   │
 │   │   └─ Textarea: Reason **[Admin+Mgmt+HT]**
 │   │
 │   └─ ConflictWarning **[Admin+Mgmt+HT]**
 │       └─ Shows if dates conflict with events
 │
 └─ DialogFooter
     ├─ Button: Cancel **[Admin+Mgmt+HT]**
     └─ Button: Submit Request **[Admin+Mgmt+HT]**
```

### Pesos Calculator Dialog
**Access**: **[Mgmt]** 🔒
**Context**: Project Management page only

```
PesosCalculatorDialog **[Mgmt]** 🔒
 ├─ Permission: userRole === 'management' && isProjectManagementPage
 │
 ├─ DialogHeader
 │   ├─ Title: "Pesos Calculator"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ PersonnelCosts **[Mgmt]**
 │   │   └─ PersonnelRow[]
 │   │       ├─ Name
 │   │       ├─ Role
 │   │       ├─ Days
 │   │       ├─ Rate
 │   │       └─ Total
 │   │
 │   ├─ EquipmentCosts **[Mgmt]**
 │   │   └─ EquipmentRow[]
 │   │       ├─ Item
 │   │       ├─ Quantity
 │   │       ├─ Days
 │   │       ├─ Rate
 │   │       └─ Total
 │   │
 │   ├─ AdditionalCosts **[Mgmt]**
 │   │   ├─ Transport
 │   │   ├─ Accommodation
 │   │   ├─ Per Diems
 │   │   └─ Miscellaneous
 │   │
 │   └─ TotalSummary **[Mgmt]**
 │       ├─ Subtotal
 │       ├─ VAT
 │       ├─ Total
 │       └─ Profit Margin
 │
 └─ DialogFooter
     ├─ Button: Export PDF **[Mgmt]**
     ├─ Button: Save **[Mgmt]**
     └─ Button: Close **[Mgmt]**
```

### Consumos Calculator Dialog
**Access**: **[Mgmt]** 🔒
**Context**: Project Management page only

```
ConsumosCalculatorDialog **[Mgmt]** 🔒
 ├─ Permission: userRole === 'management' && isProjectManagementPage
 │
 ├─ DialogHeader
 │   ├─ Title: "Consumos Calculator"
 │   └─ JobInfo
 │
 ├─ DialogBody
 │   ├─ PowerConsumption **[Mgmt]**
 │   │   └─ EquipmentRow[]
 │   │       ├─ Equipment
 │   │       ├─ Quantity
 │   │       ├─ Power (W)
 │   │       ├─ Hours
 │   │       └─ Total kWh
 │   │
 │   ├─ PowerSummary **[Mgmt]**
 │   │   ├─ Total Power Draw
 │   │   ├─ Required Amperage
 │   │   ├─ Circuit Breaker Size
 │   │   └─ Cable Recommendations
 │   │
 │   └─ CostEstimate **[Mgmt]**
 │       ├─ Total kWh
 │       ├─ Cost per kWh
 │       └─ Total Cost
 │
 └─ DialogFooter
     ├─ Button: Export PDF **[Mgmt]**
     ├─ Button: Save **[Mgmt]**
     └─ Button: Close **[Mgmt]**
```

---

## Permission Summary Tables

### Dialog Access Matrix

| Dialog | Admin | Mgmt | Logistics | House Tech | Technician |
|--------|-------|------|-----------|------------|------------|
| **Create Job** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit Job** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Confirm** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assign Personnel** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Task Manager** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Upload Documents** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Pesos Calculator** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Consumos Calculator** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Technician Incident** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Vacation Request** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Edit User** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage Skills** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **SV Review** | ✅ | ✅ | 📥* | 📥* | 📥* |
| **Archive to Flex** | ✅ | ✅ | ✅ | ✅ | ✅ |

*📥 = After downloading file

### Button/Action Access Matrix

| Action | Admin | Mgmt | Logistics | House Tech | Technician |
|--------|-------|------|-----------|------------|------------|
| **Create Job** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit Job** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Job** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assign Personnel** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Upload Documents** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Documents** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create Flex Folders** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage Festival** | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| **Upload SV Files** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delete SV Files** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create WhatsApp Group** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Send Almacén Message** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Calculators** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Create Incident Report** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Edit Calendar Dates** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Submit Vacation Request** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Approve Vacation** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage User Skills** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Send Onboarding Email** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit User Rates** | ✅ | ✅ | ❌ | ❌ | ❌ |

### Field-Level Permissions (Edit User Dialog)

| Field | Admin | Mgmt | Who Can Edit |
|-------|-------|------|--------------|
| Basic Info (Name, Phone, etc.) | ✅ | ✅ | Admin, Management |
| Department, Role | ✅ | ✅ | Admin, Management |
| Assignable as Tech | ✅ | ✅ | Admin, Management |
| Autónomo (if technician) | ✅ | ✅ | Admin, Management |
| **SoundVision Access** | ✅ | ✅ | **Management ONLY** 🔒 |
| **Flex Resource ID** | ✅ | ✅ | **Management ONLY** 🔒 |
| **Flex URL Extract Helper** | ✅ | ✅ | **Management ONLY** 🔒 |
| **House Tech Rate Editor** | ✅ | ✅ | **Management ONLY** 🔒 |
| **Send Onboarding Email** | ✅ | ✅ | **Management ONLY** 🔒 |

---

## Security Notes

### ⚠️ Known Security Issues

1. **Video Page Delete Permission** (`src/pages/Video.tsx`, lines 128-151)
   - **Issue**: No permission check - any authenticated user can delete jobs
   - **Should be**: Restricted to `admin` and `management` like Sound/Lights
   - **Recommendation**: Add permission check:
   ```typescript
   if (!["admin", "management"].includes(userRole || "")) {
     toast({ title: "Permission denied" });
     return;
   }
   ```

2. **Client-Side Only Checks**
   - All permission checks shown are client-side only
   - **Must** be enforced server-side with Row-Level Security (RLS) policies
   - Client-side checks are for UX only, not security

### Best Practices

1. **Always check permissions** before rendering sensitive UI elements
2. **Double-check server-side** - Never trust client-side checks alone
3. **Use permission utility functions** for consistency
4. **Test all roles** when adding new features
5. **Document permission changes** when modifying access control

---

## Key Files Reference

- **Sound Page**: `src/pages/Sound.tsx`
- **Lights Page**: `src/pages/Lights.tsx`
- **Video Page**: `src/pages/Video.tsx`
- **Personal Calendar**: `src/pages/Personal.tsx`
- **Project Management**: `src/pages/ProjectManagement.tsx`
- **Festival Management**: `src/pages/FestivalManagement.tsx`
- **Job Card Actions**: `src/components/jobs/cards/JobCardActions.tsx`
- **Edit User Dialog**: `src/components/users/EditUserDialog.tsx`
- **Users List**: `src/components/users/UsersListContent.tsx`
- **SoundVision Files**: `src/components/soundvision/SoundVisionFilesList.tsx`
- **Permission Utils**: `src/utils/permissions.ts`
