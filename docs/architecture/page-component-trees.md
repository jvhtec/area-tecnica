# Detailed Page Component Trees

This document provides detailed component hierarchies for all major pages in the application.

## Table of Contents

1. [Dashboard Pages](#dashboard-pages)
2. [Availability Page](#availability-page)
3. [Agenda Page](#agenda-page)
4. [Projects Page](#projects-page)
5. [Incidencias Page](#incidencias-page)
6. [Rates Page](#rates-page)
7. [Tours Pages](#tours-pages)
8. [Logistics Pages](#logistics-pages)
9. [Festivals Pages](#festivals-pages)
10. [Job Matrix Page](#job-matrix-page)
11. [Wallboard Page](#wallboard-page)
12. [Activity Page](#activity-page)
13. [Announcements Page](#announcements-page)
14. [Video Page](#video-page)
15. [Profile Page](#profile-page)

---

## Dashboard Pages

### Admin Dashboard
**File**: `src/pages/Dashboard/AdminDashboard.tsx:1`
**Access**: admin only

```
AdminDashboard
 ├─ PageHeader
 │   ├─ Title: "Dashboard Administrativo"
 │   └─ Subtitle: System overview
 │
 ├─ <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 │   ├─ StatCard: Total Users
 │   ├─ StatCard: Active Tours
 │   ├─ StatCard: Pending Incidents
 │   └─ StatCard: Active Projects
 │
 ├─ <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 │   ├─ Card: Recent Activity
 │   │   ├─ CardHeader
 │   │   └─ ActivityFeed
 │   │       └─ ActivityItem[] (latest 10)
 │   │
 │   └─ Card: System Health
 │       ├─ CardHeader
 │       └─ HealthMetrics
 │           ├─ DatabaseStatus
 │           ├─ APIStatus
 │           └─ CacheStatus
 │
 ├─ Card: Quick Actions
 │   └─ ActionButtons
 │       ├─ Button: New Project
 │       ├─ Button: New Tour
 │       ├─ Button: New Announcement
 │       └─ Button: User Management
 │
 └─ Card: Upcoming Events
     └─ EventsList
         └─ EventItem[]
```

### Management Dashboard
**File**: `src/pages/Dashboard/ManagementDashboard.tsx:1`
**Access**: management

```
ManagementDashboard
 ├─ PageHeader
 │   ├─ Title: "Dashboard de Gestión"
 │   └─ DateRangeFilter
 │
 ├─ <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 │   ├─ MetricCard: Revenue (Month)
 │   ├─ MetricCard: Active Projects
 │   └─ MetricCard: Resource Utilization
 │
 ├─ <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 │   ├─ Card: Project Status Overview
 │   │   ├─ CardHeader
 │   │   └─ ProjectStatusChart
 │   │       └─ PieChart (by status)
 │   │
 │   └─ Card: Revenue by Department
 │       ├─ CardHeader
 │       └─ RevenueChart
 │           └─ BarChart (Sound, Light, Video, Logistics)
 │
 ├─ Card: Team Availability
 │   └─ AvailabilityCalendar
 │       └─ TeamMemberAvailability[]
 │
 └─ Card: Recent Tours
     └─ ToursTable
         ├─ TableHeader
         └─ TourRow[]
             ├─ TourName
             ├─ Client
             ├─ Dates
             └─ Status
```

### House Tech Dashboard
**File**: `src/pages/Dashboard/HouseTechDashboard.tsx:1`
**Access**: house_tech
**Department Specific**: Shows data for user's department only

```
HouseTechDashboard
 ├─ PageHeader
 │   ├─ Title: "{Department} Dashboard"
 │   └─ DepartmentBadge
 │
 ├─ <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 │   ├─ StatCard: Active Events
 │   ├─ StatCard: Equipment Out
 │   └─ StatCard: Pending Tasks
 │
 ├─ Card: My Schedule
 │   └─ WeeklySchedule
 │       └─ ScheduleDay[]
 │           └─ EventSlot[]
 │
 ├─ Card: Department Equipment Status
 │   └─ EquipmentList
 │       └─ EquipmentItem[]
 │           ├─ ItemName
 │           ├─ Status (available/in-use/maintenance)
 │           └─ Location
 │
 ├─ Card: Recent Incidents
 │   └─ IncidentsList
 │       └─ IncidentItem[]
 │           ├─ Title
 │           ├─ Priority
 │           ├─ Status
 │           └─ AssignedTo
 │
 └─ Card: Upcoming Events
     └─ EventsList
         └─ EventCard[]
```

### Technician Dashboard
**File**: `src/pages/Dashboard/TechnicianDashboard.tsx:1`
**Access**: technician

```
TechnicianDashboard
 ├─ PageHeader
 │   ├─ Title: "Mi Panel"
 │   └─ Avatar
 │
 ├─ <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 │   ├─ StatCard: Today's Events
 │   ├─ StatCard: This Week's Events
 │   └─ StatCard: My Incidents
 │
 ├─ Card: Today's Schedule
 │   └─ TodaySchedule
 │       └─ EventTimeline[]
 │           ├─ Time
 │           ├─ Event
 │           ├─ Venue
 │           └─ Role
 │
 ├─ Card: My Assigned Incidents
 │   └─ IncidentsList
 │       └─ IncidentItem[]
 │
 ├─ Card: My Tours
 │   └─ ToursList
 │       └─ TourCard[]
 │           ├─ TourName
 │           ├─ Dates
 │           ├─ Role
 │           └─ Status
 │
 └─ Card: Quick Actions
     └─ ActionButtons
         ├─ Button: Report Incident
         ├─ Button: View Full Schedule
         └─ Button: Check Equipment
```

---

## Availability Page
**File**: `src/pages/Availability/AvailabilityPage.tsx:1`
**Route**: `/availability`
**Access**: admin, management

```
AvailabilityPage
 ├─ PageHeader
 │   ├─ Title: "Disponibilidad del Equipo"
 │   └─ Actions
 │       └─ Button: Export to CSV
 │
 ├─ FilterBar
 │   ├─ DepartmentFilter
 │   ├─ RoleFilter
 │   ├─ DateRangeFilter
 │   └─ SearchInput
 │
 ├─ Card: Availability Calendar
 │   └─ AvailabilityCalendar
 │       ├─ CalendarHeader
 │       │   ├─ MonthNavigation
 │       │   └─ ViewToggle (month/week/day)
 │       │
 │       └─ CalendarGrid
 │           └─ CalendarDay[]
 │               └─ UserAvailabilitySlot[]
 │                   ├─ UserAvatar
 │                   ├─ UserName
 │                   └─ AvailabilityStatus
 │                       ├─ Available (green)
 │                       ├─ Partially Available (yellow)
 │                       ├─ Unavailable (red)
 │                       └─ On Tour (blue)
 │
 └─ Card: Team Members List
     └─ TeamTable
         ├─ TableHeader
         │   ├─ Name
         │   ├─ Department
         │   ├─ Role
         │   └─ Current Status
         │
         └─ TeamMemberRow[]
             ├─ Avatar + Name
             ├─ DepartmentBadge
             ├─ RoleBadge
             ├─ StatusIndicator
             └─ Actions
                 └─ Button: View Details
```

---

## Agenda Page
**File**: `src/pages/Agenda/AgendaPage.tsx:1`
**Route**: `/agenda`
**Access**: admin, management, house_tech

```
AgendaPage
 ├─ PageHeader
 │   ├─ Title: "Agenda"
 │   └─ Actions
 │       ├─ Button: New Event
 │       └─ Button: Export
 │
 ├─ FilterBar
 │   ├─ ViewToggle (calendar/list)
 │   ├─ DepartmentFilter (house_tech: auto-filtered)
 │   ├─ EventTypeFilter
 │   └─ DateRangeFilter
 │
 ├─ CalendarView (if view === 'calendar')
 │   └─ FullCalendar
 │       ├─ CalendarToolbar
 │       │   ├─ MonthNavigation
 │       │   └─ ViewSelector (month/week/day/agenda)
 │       │
 │       └─ CalendarEvents
 │           └─ EventComponent[]
 │               ├─ EventTitle
 │               ├─ EventTime
 │               ├─ Venue
 │               ├─ DepartmentBadge
 │               └─ onClick → EventDetailsModal
 │
 └─ ListView (if view === 'list')
     └─ EventsTable
         ├─ TableHeader
         │   ├─ Date
         │   ├─ Event
         │   ├─ Venue
         │   ├─ Department
         │   └─ Status
         │
         └─ EventRow[]
             └─ onClick → EventDetailsModal

EventDetailsModal
 ├─ ModalHeader
 │   ├─ EventTitle
 │   └─ CloseButton
 │
 ├─ ModalBody
 │   ├─ EventInfo
 │   │   ├─ Date & Time
 │   │   ├─ Venue
 │   │   ├─ Client
 │   │   ├─ Department
 │   │   └─ Event Type
 │   │
 │   ├─ AssignedTeam
 │   │   └─ TeamMemberChip[]
 │   │
 │   ├─ EquipmentList
 │   │   └─ EquipmentItem[]
 │   │
 │   └─ Notes
 │
 └─ ModalFooter
     ├─ Button: Edit (if has permission)
     ├─ Button: Delete (if has permission)
     └─ Button: Close
```

---

## Projects Page
**File**: `src/pages/Projects/ProjectsPage.tsx:1`
**Route**: `/projects`
**Access**: admin, management

```
ProjectsPage
 ├─ PageHeader
 │   ├─ Title: "Proyectos"
 │   └─ Actions
 │       └─ Button: New Project
 │
 ├─ FilterBar
 │   ├─ StatusFilter (all/active/completed/on-hold)
 │   ├─ DepartmentFilter
 │   ├─ ClientFilter
 │   └─ SearchInput
 │
 ├─ ViewToggle
 │   ├─ Button: Kanban View
 │   └─ Button: List View
 │
 ├─ KanbanView (if view === 'kanban')
 │   └─ KanbanBoard
 │       ├─ Column: Propuesta
 │       │   └─ ProjectCard[]
 │       ├─ Column: Confirmado
 │       │   └─ ProjectCard[]
 │       ├─ Column: En Progreso
 │       │   └─ ProjectCard[]
 │       ├─ Column: Completado
 │       │   └─ ProjectCard[]
 │       └─ Column: Cancelado
 │           └─ ProjectCard[]
 │
 └─ ListView (if view === 'list')
     └─ ProjectsTable
         ├─ TableHeader
         │   ├─ Project Name
         │   ├─ Client
         │   ├─ Department
         │   ├─ Dates
         │   ├─ Budget
         │   ├─ Status
         │   └─ Actions
         │
         └─ ProjectRow[]
             ├─ ProjectName (clickable)
             ├─ ClientName
             ├─ DepartmentBadge[]
             ├─ DateRange
             ├─ BudgetAmount
             ├─ StatusBadge
             └─ ActionsDropdown
                 ├─ View Details
                 ├─ Edit
                 └─ Delete

ProjectCard (used in Kanban)
 ├─ CardHeader
 │   ├─ ProjectName
 │   └─ DepartmentBadge[]
 │
 ├─ CardBody
 │   ├─ Client
 │   ├─ DateRange
 │   ├─ Budget
 │   └─ AssignedTeam (avatars)
 │
 └─ CardFooter
     ├─ StatusBadge
     └─ ActionsDropdown
```

---

## Incidencias Page
**File**: `src/pages/Incidencias/IncidenciasPage.tsx:1`
**Route**: `/incidencias`
**Access**: admin, management, house_tech, technician

```
IncidenciasPage
 ├─ PageHeader
 │   ├─ Title: "Incidencias"
 │   └─ Actions
 │       └─ Button: New Incident
 │
 ├─ FilterBar
 │   ├─ StatusFilter (all/open/in-progress/resolved/closed)
 │   ├─ PriorityFilter (all/critical/high/medium/low)
 │   ├─ DepartmentFilter
 │   ├─ AssignedToFilter
 │   └─ SearchInput
 │
 ├─ StatsBar
 │   ├─ Stat: Open Incidents
 │   ├─ Stat: In Progress
 │   ├─ Stat: Critical Priority
 │   └─ Stat: Avg Resolution Time
 │
 └─ IncidentsTable
     ├─ TableHeader
     │   ├─ ID
     │   ├─ Title
     │   ├─ Priority
     │   ├─ Status
     │   ├─ Department
     │   ├─ Assigned To
     │   ├─ Created
     │   └─ Actions
     │
     └─ IncidentRow[]
         ├─ IncidentID
         ├─ Title (clickable → IncidentDetailsModal)
         ├─ PriorityBadge
         ├─ StatusBadge
         ├─ DepartmentBadge
         ├─ AssignedUserAvatar
         ├─ CreatedDate
         └─ ActionsDropdown
             ├─ View Details
             ├─ Edit
             ├─ Change Status
             └─ Delete

IncidentDetailsModal
 ├─ ModalHeader
 │   ├─ IncidentTitle
 │   ├─ IncidentID
 │   └─ CloseButton
 │
 ├─ ModalBody
 │   ├─ IncidentInfo
 │   │   ├─ Status
 │   │   ├─ Priority
 │   │   ├─ Department
 │   │   ├─ ReportedBy
 │   │   ├─ AssignedTo
 │   │   ├─ CreatedDate
 │   │   └─ LastUpdated
 │   │
 │   ├─ Description
 │   │
 │   ├─ Attachments[]
 │   │   └─ FilePreview
 │   │
 │   └─ ActivityTimeline
 │       └─ TimelineItem[]
 │           ├─ User
 │           ├─ Action
 │           ├─ Timestamp
 │           └─ Comment
 │
 └─ ModalFooter
     ├─ StatusSelector (if has permission)
     ├─ Button: Add Comment
     ├─ Button: Edit
     └─ Button: Close
```

---

## Rates Page
**File**: `src/pages/Rates/RatesPage.tsx:1`
**Route**: `/rates`
**Access**: admin, management

```
RatesPage
 ├─ PageHeader
 │   ├─ Title: "Tarifas"
 │   └─ Actions
 │       ├─ Button: New Rate
 │       └─ Button: Import Rates
 │
 ├─ Tabs
 │   ├─ Tab: Personal (daily rates)
 │   ├─ Tab: Equipment
 │   └─ Tab: Services
 │
 ├─ PersonalRatesTab (if active)
 │   ├─ FilterBar
 │   │   ├─ DepartmentFilter
 │   │   ├─ RoleFilter
 │   │   └─ SearchInput
 │   │
 │   └─ RatesTable
 │       ├─ TableHeader
 │       │   ├─ Role
 │       │   ├─ Department
 │       │   ├─ Daily Rate
 │       │   ├─ Half Day Rate
 │       │   ├─ Hourly Rate
 │       │   └─ Actions
 │       │
 │       └─ RateRow[]
 │           └─ ActionsDropdown
 │               ├─ Edit
 │               └─ Delete
 │
 ├─ EquipmentRatesTab (if active)
 │   ├─ FilterBar
 │   │   ├─ CategoryFilter
 │   │   ├─ DepartmentFilter
 │   │   └─ SearchInput
 │   │
 │   └─ EquipmentRatesTable
 │       ├─ TableHeader
 │       │   ├─ Item
 │       │   ├─ Category
 │       │   ├─ Department
 │       │   ├─ Daily Rate
 │       │   ├─ Weekly Rate
 │       │   └─ Actions
 │       │
 │       └─ EquipmentRateRow[]
 │
 └─ ServicesRatesTab (if active)
     └─ ServicesRatesTable
         ├─ TableHeader
         │   ├─ Service
         │   ├─ Unit
         │   ├─ Rate
         │   └─ Actions
         │
         └─ ServiceRateRow[]
```

---

## Tours Pages

### Tours List Page
**File**: `src/pages/Tours/ToursPage.tsx:1`
**Route**: `/tours`
**Access**: admin, management, house_tech, technician

```
ToursPage
 ├─ PageHeader
 │   ├─ Title: "Giras"
 │   └─ Actions
 │       └─ Button: New Tour (admin, management only)
 │
 ├─ FilterBar
 │   ├─ StatusFilter (all/planned/active/completed/cancelled)
 │   ├─ DepartmentFilter
 │   ├─ YearFilter
 │   └─ SearchInput
 │
 ├─ StatsBar
 │   ├─ Stat: Active Tours
 │   ├─ Stat: Upcoming Tours
 │   ├─ Stat: This Month Events
 │   └─ Stat: Total Revenue
 │
 └─ ToursGrid
     └─ TourCard[]
         ├─ CardHeader
         │   ├─ TourName
         │   └─ StatusBadge
         │
         ├─ CardBody
         │   ├─ Artist/Client
         │   ├─ DateRange
         │   ├─ EventCount
         │   ├─ Departments[]
         │   └─ TeamMembers (avatars)
         │
         └─ CardFooter
             ├─ Button: View Details
             └─ ActionsDropdown
                 ├─ Edit
                 ├─ Duplicate
                 └─ Delete
```

### Tour Details Page
**File**: `src/pages/Tours/TourDetailsPage.tsx:1`
**Route**: `/tours/:tourId`
**Access**: admin, management, house_tech, technician

```
TourDetailsPage
 ├─ PageHeader
 │   ├─ Breadcrumb: Tours > {TourName}
 │   ├─ Title: {TourName}
 │   ├─ StatusBadge
 │   └─ Actions
 │       ├─ Button: Edit (if has permission)
 │       └─ Button: Export PDF
 │
 ├─ Tabs
 │   ├─ Tab: Overview
 │   ├─ Tab: Events
 │   ├─ Tab: Team
 │   ├─ Tab: Equipment
 │   ├─ Tab: Documents
 │   └─ Tab: Finances (admin, management only)
 │
 ├─ OverviewTab (if active)
 │   ├─ Card: Tour Information
 │   │   ├─ Artist/Client
 │   │   ├─ DateRange
 │   │   ├─ Departments
 │   │   ├─ TourManager
 │   │   └─ Description
 │   │
 │   ├─ Card: Statistics
 │   │   ├─ Total Events
 │   │   ├─ Cities/Venues
 │   │   ├─ Team Members
 │   │   └─ Equipment Items
 │   │
 │   └─ Card: Timeline
 │       └─ TourTimeline
 │           └─ EventMarker[]
 │
 ├─ EventsTab (if active)
 │   ├─ Button: Add Event (if has permission)
 │   └─ EventsTable
 │       ├─ TableHeader
 │       │   ├─ Date
 │       │   ├─ Venue
 │       │   ├─ City
 │       │   ├─ Type
 │       │   ├─ Status
 │       │   └─ Actions
 │       │
 │       └─ EventRow[]
 │           ├─ Expandable (shows event details)
 │           └─ ActionsDropdown
 │
 ├─ TeamTab (if active)
 │   ├─ DepartmentFilter
 │   ├─ Button: Assign Team Member (if has permission)
 │   └─ TeamMembersGrid
 │       └─ TeamMemberCard[]
 │           ├─ Avatar
 │           ├─ Name
 │           ├─ Role
 │           ├─ Department
 │           ├─ EventsCount
 │           └─ Actions
 │
 ├─ EquipmentTab (if active)
 │   ├─ DepartmentFilter
 │   ├─ Button: Assign Equipment (if has permission)
 │   └─ EquipmentList
 │       └─ EquipmentItem[]
 │           ├─ ItemName
 │           ├─ Quantity
 │           ├─ Department
 │           └─ Status
 │
 ├─ DocumentsTab (if active)
 │   ├─ Button: Upload Document (if has permission)
 │   └─ DocumentsList
 │       └─ DocumentItem[]
 │           ├─ FileName
 │           ├─ FileType
 │           ├─ UploadedBy
 │           ├─ UploadDate
 │           └─ Actions
 │               ├─ Download
 │               ├─ Preview
 │               └─ Delete
 │
 └─ FinancesTab (if active && has permission)
     ├─ Card: Budget Summary
     │   ├─ TotalBudget
     │   ├─ TotalExpenses
     │   ├─ Remaining
     │   └─ ProfitMargin
     │
     ├─ Card: Revenue Breakdown
     │   └─ RevenueChart
     │
     └─ Card: Expenses
         └─ ExpensesTable
             └─ ExpenseRow[]
```

---

## Logistics Pages

### Logistics Dashboard
**File**: `src/pages/Logistics/LogisticsPage.tsx:1`
**Route**: `/logistics`
**Access**: admin, management, logistics, house_tech (view-only)

```
LogisticsPage
 ├─ PageHeader
 │   ├─ Title: "Logística"
 │   └─ Actions (if not house_tech)
 │       └─ Button: New Equipment
 │
 ├─ Tabs
 │   ├─ Tab: Inventory
 │   ├─ Tab: Warehouse
 │   └─ Tab: Vehicles
 │
 ├─ InventoryTab (if active)
 │   ├─ FilterBar
 │   │   ├─ DepartmentFilter
 │   │   ├─ CategoryFilter
 │   │   ├─ StatusFilter (all/available/in-use/maintenance/retired)
 │   │   └─ SearchInput
 │   │
 │   ├─ StatsBar
 │   │   ├─ Stat: Total Items
 │   │   ├─ Stat: Available
 │   │   ├─ Stat: In Use
 │   │   └─ Stat: Maintenance
 │   │
 │   └─ InventoryTable
 │       ├─ TableHeader
 │       │   ├─ Item Code
 │       │   ├─ Name
 │       │   ├─ Category
 │       │   ├─ Department
 │       │   ├─ Quantity
 │       │   ├─ Status
 │       │   ├─ Location
 │       │   └─ Actions
 │       │
 │       └─ InventoryRow[]
 │           ├─ ItemInfo
 │           ├─ StatusBadge
 │           └─ ActionsDropdown
 │               ├─ View Details
 │               ├─ Edit (if has permission)
 │               ├─ Change Status
 │               └─ View History
 │
 ├─ WarehouseTab (if active)
 │   ├─ LocationFilter
 │   └─ WarehouseGrid
 │       └─ LocationCard[]
 │           ├─ LocationName
 │           ├─ Capacity
 │           ├─ ItemsCount
 │           └─ ItemsList
 │
 └─ VehiclesTab (if active)
     ├─ Button: Add Vehicle (if has permission)
     └─ VehiclesGrid
         └─ VehicleCard[]
             ├─ VehicleInfo
             │   ├─ Type
             │   ├─ License Plate
             │   └─ Capacity
             ├─ Status
             ├─ CurrentLocation
             └─ Actions
```

---

## Festivals Pages

### Festivals List Page
**File**: `src/pages/Festivals/FestivalsPage.tsx:1`
**Route**: `/festivals`
**Access**: admin, management, house_tech (Sound dept), technician (Sound dept)

```
FestivalsPage
 ├─ PageHeader
 │   ├─ Title: "Festivales"
 │   └─ Actions
 │       └─ Button: New Festival (admin, management only)
 │
 ├─ FilterBar
 │   ├─ StatusFilter (all/upcoming/active/completed)
 │   ├─ YearFilter
 │   └─ SearchInput
 │
 ├─ ViewToggle
 │   ├─ Button: Grid View
 │   └─ Button: Calendar View
 │
 ├─ GridView (if view === 'grid')
 │   └─ FestivalsGrid
 │       └─ FestivalCard[]
 │           ├─ CardHeader
 │           │   ├─ FestivalLogo/Image
 │           │   └─ StatusBadge
 │           │
 │           ├─ CardBody
 │           │   ├─ FestivalName
 │           │   ├─ DateRange
 │           │   ├─ Location
 │           │   ├─ StagesCount
 │           │   └─ ArtistsCount
 │           │
 │           └─ CardFooter
 │               ├─ Button: View Details
 │               └─ ActionsDropdown
 │
 └─ CalendarView (if view === 'calendar')
     └─ FestivalsCalendar
         └─ FestivalEvent[]
```

### Festival Details Page
**File**: `src/pages/Festivals/FestivalDetailsPage.tsx:1`
**Route**: `/festivals/:festivalId`

```
FestivalDetailsPage
 ├─ PageHeader
 │   ├─ Breadcrumb: Festivals > {FestivalName}
 │   ├─ Title: {FestivalName}
 │   └─ Actions
 │       ├─ Button: Edit (if has permission)
 │       └─ Button: Export PDF
 │
 ├─ Tabs
 │   ├─ Tab: Overview
 │   ├─ Tab: Stages
 │   ├─ Tab: Schedule
 │   ├─ Tab: Team
 │   └─ Tab: Equipment
 │
 ├─ OverviewTab (if active)
 │   ├─ Card: Festival Information
 │   │   ├─ Dates
 │   │   ├─ Location/Venue
 │   │   ├─ Organizer
 │   │   └─ Description
 │   │
 │   └─ Card: Statistics
 │       ├─ Total Stages
 │       ├─ Total Artists
 │       ├─ Team Members
 │       └─ Equipment Items
 │
 ├─ StagesTab (if active)
 │   ├─ Button: Add Stage (if has permission)
 │   └─ StagesGrid
 │       └─ StageCard[]
 │           ├─ StageName
 │           ├─ Capacity
 │           ├─ TechnicalSpecs
 │           └─ AssignedCrew
 │
 ├─ ScheduleTab (if active)
 │   └─ ScheduleTimeline
 │       └─ StageTimeline[]
 │           ├─ StageName
 │           └─ PerformanceSlot[]
 │               ├─ Time
 │               ├─ Artist
 │               ├─ Duration
 │               └─ Setup Notes
 │
 ├─ TeamTab (if active)
 │   └─ TeamAssignments
 │       └─ StageAssignment[]
 │           ├─ StageName
 │           └─ CrewMembers[]
 │
 └─ EquipmentTab (if active)
     └─ EquipmentByStage
         └─ StageEquipment[]
             ├─ StageName
             └─ EquipmentList[]
```

---

## Job Matrix Page
**File**: `src/pages/Matrix/JobMatrixPage.tsx:1`
**Route**: `/matrix`
**Access**: admin, users with matrixAccess != 'none'

```
JobMatrixPage
 ├─ PageHeader
 │   ├─ Title: "Matriz de Trabajos"
 │   └─ Actions
 │       └─ Button: Export to Excel
 │
 ├─ FilterBar
 │   ├─ MonthSelector
 │   ├─ DepartmentFilter
 │   └─ UserFilter
 │
 ├─ MatrixToolbar
 │   ├─ LegendPanel
 │   │   ├─ Available
 │   │   ├─ Assigned
 │   │   ├─ Confirmed
 │   │   └─ Unavailable
 │   │
 │   └─ ViewOptions
 │       ├─ ShowWeekends
 │       └─ CompactView
 │
 └─ MatrixGrid
     ├─ TableHeader
     │   ├─ Column: Name
     │   ├─ Column: Role
     │   └─ Columns: Days[] (1-31)
     │
     └─ MatrixRow[] (users)
         ├─ UserInfo
         │   ├─ Avatar
         │   ├─ Name
         │   └─ Role
         │
         └─ DayCell[]
             ├─ onClick → CellDetailsModal (if has event)
             └─ Cell Status Indicators
                 ├─ Color-coded background
                 ├─ Event abbreviation
                 └─ Tooltip with event details

CellDetailsModal
 ├─ ModalHeader
 │   ├─ Date
 │   ├─ UserName
 │   └─ CloseButton
 │
 ├─ ModalBody
 │   ├─ EventInfo
 │   │   ├─ EventName
 │   │   ├─ Venue
 │   │   ├─ Role
 │   │   └─ Department
 │   │
 │   └─ AssignmentStatus
 │       └─ StatusSelector (if matrixAccess === 'edit')
 │
 └─ ModalFooter
     ├─ Button: Save (if matrixAccess === 'edit')
     └─ Button: Close
```

---

## Wallboard Page
**File**: `src/pages/Wallboard/WallboardPage.tsx:1`
**Route**: `/wallboard`
**Access**: Public (no auth) OR admin

```
WallboardPage (Fullscreen Display Mode)
 ├─ SplashScreen (initial 3 seconds)
 │   ├─ CompanyLogo
 │   └─ LoadingSpinner
 │
 └─ WallboardDisplay
     ├─ Header (minimal)
     │   ├─ CurrentDateTime
     │   └─ CompanyLogo
     │
     ├─ MainContent
     │   ├─ Section: Today's Events
     │   │   └─ EventCard[]
     │   │       ├─ Time
     │   │       ├─ EventName
     │   │       ├─ Venue
     │   │       ├─ Department
     │   │       └─ AssignedCrew (avatars)
     │   │
     │   ├─ Section: This Week's Schedule
     │   │   └─ WeeklyCalendar
     │   │       └─ DayColumn[]
     │   │           └─ CompactEventCard[]
     │   │
     │   └─ Section: Announcements
     │       └─ AnnouncementCard[]
     │           ├─ Title
     │           ├─ Message
     │           └─ Posted Date
     │
     └─ Footer
         └─ LastUpdated timestamp

Note: Auto-refreshes every 5 minutes
      Designed for large display screens
      No user interaction required
```

---

## Activity Page
**File**: `src/pages/Activity/ActivityPage.tsx:1`
**Route**: `/activity`
**Access**: admin only

```
ActivityPage
 ├─ PageHeader
 │   ├─ Title: "Registro de Actividad"
 │   └─ Actions
 │       ├─ Button: Export Logs
 │       └─ Button: Clear Old Logs
 │
 ├─ FilterBar
 │   ├─ DateRangeFilter
 │   ├─ UserFilter
 │   ├─ ActionTypeFilter
 │   │   ├─ CREATE
 │   │   ├─ UPDATE
 │   │   ├─ DELETE
 │   │   ├─ LOGIN
 │   │   └─ LOGOUT
 │   ├─ EntityTypeFilter
 │   │   ├─ User
 │   │   ├─ Project
 │   │   ├─ Tour
 │   │   ├─ Event
 │   │   ├─ Incident
 │   │   └─ Equipment
 │   └─ SearchInput
 │
 ├─ StatsBar
 │   ├─ Stat: Total Actions Today
 │   ├─ Stat: Active Users Today
 │   ├─ Stat: Most Active User
 │   └─ Stat: Most Common Action
 │
 └─ ActivityTimeline
     └─ ActivityGroup[] (grouped by date)
         ├─ DateHeader
         └─ ActivityItem[]
             ├─ Timestamp
             ├─ UserAvatar
             ├─ UserName
             ├─ ActionBadge
             ├─ EntityLink
             ├─ Description
             └─ Button: View Details
                 └─ Shows JSON diff modal
```

---

## Announcements Page
**File**: `src/pages/Announcements/AnnouncementsPage.tsx:1`
**Route**: `/announcements`
**Access**: admin only

```
AnnouncementsPage
 ├─ PageHeader
 │   ├─ Title: "Anuncios"
 │   └─ Actions
 │       └─ Button: New Announcement
 │
 ├─ FilterBar
 │   ├─ StatusFilter (all/active/scheduled/archived)
 │   ├─ TargetFilter (all users/specific departments/specific roles)
 │   └─ DateRangeFilter
 │
 └─ AnnouncementsList
     └─ AnnouncementCard[]
         ├─ CardHeader
         │   ├─ Title
         │   ├─ StatusBadge
         │   └─ ActionsDropdown
         │       ├─ Edit
         │       ├─ Archive
         │       └─ Delete
         │
         ├─ CardBody
         │   ├─ Message (rich text)
         │   ├─ TargetAudience
         │   ├─ PublishedDate
         │   └─ ExpiryDate
         │
         └─ CardFooter
             ├─ ViewCount
             └─ CreatedBy

NewAnnouncementModal
 ├─ ModalHeader
 │   └─ Title: "New Announcement"
 │
 ├─ ModalBody
 │   ├─ Form
 │   │   ├─ Input: Title
 │   │   ├─ RichTextEditor: Message
 │   │   ├─ Select: Priority (info/warning/critical)
 │   │   ├─ MultiSelect: Target Departments
 │   │   ├─ MultiSelect: Target Roles
 │   │   ├─ DatePicker: Publish Date
 │   │   ├─ DatePicker: Expiry Date
 │   │   └─ Checkbox: Show on Wallboard
 │   │
 │   └─ Preview
 │       └─ AnnouncementPreview
 │
 └─ ModalFooter
     ├─ Button: Save Draft
     ├─ Button: Schedule
     └─ Button: Publish Now
```

---

## Video Page
**File**: `src/pages/Video/VideoPage.tsx:1`
**Route**: `/video`
**Access**: admin, users with video_user flag

```
VideoPage
 ├─ PageHeader
 │   ├─ Title: "Video Department"
 │   └─ Actions
 │       └─ Button: New Project (if has permission)
 │
 ├─ Tabs
 │   ├─ Tab: Projects
 │   ├─ Tab: Equipment
 │   └─ Tab: Team
 │
 ├─ ProjectsTab (if active)
 │   ├─ FilterBar
 │   │   ├─ StatusFilter
 │   │   └─ SearchInput
 │   │
 │   └─ VideoProjectsGrid
 │       └─ VideoProjectCard[]
 │           ├─ Thumbnail
 │           ├─ ProjectName
 │           ├─ Client
 │           ├─ DateRange
 │           ├─ Status
 │           └─ AssignedTeam
 │
 ├─ EquipmentTab (if active)
 │   ├─ CategoryFilter
 │   │   ├─ Cameras
 │   │   ├─ Lenses
 │   │   ├─ Lighting
 │   │   ├─ Audio
 │   │   └─ Accessories
 │   │
 │   └─ VideoEquipmentList
 │       └─ EquipmentItem[]
 │           ├─ Image
 │           ├─ Name
 │           ├─ Model
 │           ├─ Status
 │           └─ Actions
 │
 └─ TeamTab (if active)
     └─ VideoTeamGrid
         └─ TeamMemberCard[]
             ├─ Avatar
             ├─ Name
             ├─ Role
             ├─ Skills
             └─ Availability
```

---

## Profile Page
**File**: `src/pages/Profile/ProfilePage.tsx:1`
**Route**: `/profile`
**Access**: All authenticated users

```
ProfilePage
 ├─ PageHeader
 │   └─ Title: "Mi Perfil"
 │
 ├─ Tabs
 │   ├─ Tab: Personal Info
 │   ├─ Tab: Security
 │   ├─ Tab: Preferences
 │   └─ Tab: Activity (own activity log)
 │
 ├─ PersonalInfoTab (if active)
 │   ├─ Card: Profile Picture
 │   │   ├─ AvatarDisplay
 │   │   └─ Button: Change Photo
 │   │
 │   └─ Card: Personal Information
 │       ├─ Form
 │       │   ├─ Input: Full Name
 │       │   ├─ Input: Email (read-only)
 │       │   ├─ Input: Phone
 │       │   ├─ Select: Department (read-only for non-admin)
 │       │   ├─ Select: Role (read-only for non-admin)
 │       │   └─ Textarea: Bio
 │       │
 │       └─ Button: Save Changes
 │
 ├─ SecurityTab (if active)
 │   ├─ Card: Change Password
 │   │   ├─ Form
 │   │   │   ├─ Input: Current Password
 │   │   │   ├─ Input: New Password
 │   │   │   └─ Input: Confirm Password
 │   │   │
 │   │   └─ Button: Update Password
 │   │
 │   └─ Card: Active Sessions
 │       └─ SessionsList
 │           └─ SessionItem[]
 │               ├─ Device
 │               ├─ Location
 │               ├─ LastActive
 │               └─ Button: Revoke
 │
 ├─ PreferencesTab (if active)
 │   ├─ Card: Display Settings
 │   │   ├─ Select: Language
 │   │   ├─ Select: Theme (light/dark/auto)
 │   │   └─ Select: Date Format
 │   │
 │   ├─ Card: Notification Settings
 │   │   ├─ Toggle: Email Notifications
 │   │   ├─ Toggle: Push Notifications
 │   │   ├─ Toggle: Event Reminders
 │   │   └─ Toggle: Incident Assignments
 │   │
 │   └─ Card: Calendar Settings
 │       ├─ Select: Default View
 │       ├─ Select: Week Start Day
 │       └─ Toggle: Show Weekends
 │
 └─ ActivityTab (if active)
     └─ UserActivityTimeline
         └─ ActivityItem[] (filtered to current user)
```

---

## Common Components Used Across Pages

### Reusable UI Components
All pages extensively use shadcn/ui components:

- `Button` - src/components/ui/button.tsx
- `Card`, `CardHeader`, `CardContent`, `CardFooter` - src/components/ui/card.tsx
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` - src/components/ui/table.tsx
- `Dialog`, `DialogTrigger`, `DialogContent` - src/components/ui/dialog.tsx
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - src/components/ui/tabs.tsx
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` - src/components/ui/select.tsx
- `Input` - src/components/ui/input.tsx
- `Badge` - src/components/ui/badge.tsx
- `Avatar`, `AvatarImage`, `AvatarFallback` - src/components/ui/avatar.tsx
- `DropdownMenu` - src/components/ui/dropdown-menu.tsx
- `Calendar` - src/components/ui/calendar.tsx
- `Popover` - src/components/ui/popover.tsx

### Custom Shared Components

- `PageHeader` - src/components/common/PageHeader.tsx
- `FilterBar` - src/components/common/FilterBar.tsx
- `StatusBadge` - src/components/common/StatusBadge.tsx
- `UserAvatar` - src/components/common/UserAvatar.tsx
- `LoadingSpinner` - src/components/common/LoadingSpinner.tsx
- `EmptyState` - src/components/common/EmptyState.tsx
- `ConfirmDialog` - src/components/common/ConfirmDialog.tsx

---

## File Location Reference

All page components are located in: `/home/user/area-tecnica/src/pages/`

```
src/pages/
├── Dashboard/
│   ├── AdminDashboard.tsx
│   ├── ManagementDashboard.tsx
│   ├── HouseTechDashboard.tsx
│   └── TechnicianDashboard.tsx
├── Availability/
│   └── AvailabilityPage.tsx
├── Agenda/
│   └── AgendaPage.tsx
├── Projects/
│   └── ProjectsPage.tsx
├── Incidencias/
│   └── IncidenciasPage.tsx
├── Rates/
│   └── RatesPage.tsx
├── Tours/
│   ├── ToursPage.tsx
│   └── TourDetailsPage.tsx
├── Logistics/
│   └── LogisticsPage.tsx
├── Festivals/
│   ├── FestivalsPage.tsx
│   └── FestivalDetailsPage.tsx
├── Matrix/
│   └── JobMatrixPage.tsx
├── Wallboard/
│   └── WallboardPage.tsx
├── Activity/
│   └── ActivityPage.tsx
├── Announcements/
│   └── AnnouncementsPage.tsx
├── Video/
│   └── VideoPage.tsx
└── Profile/
    └── ProfilePage.tsx
```
