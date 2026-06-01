# Fleet Management & Driver's Log — Implementation Plan

**Status:** Proposed
**PRD Date:** 2026-02-16
**Surface:** Logistics page (`/logistics`)
**Phases:** 3 (see rollout at end)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema](#2-database-schema)
3. [Phase 1 — Vehicle Master Data + Assignment + Driver's Log](#3-phase-1)
4. [Phase 2 — Inspections + Expense Integration](#4-phase-2)
5. [Phase 3 — Reporting + Policy Automation](#5-phase-3)
6. [Permissions & RLS](#6-permissions--rls)
7. [UI/UX Design Notes](#7-uiux-design-notes)
8. [File Map (New & Modified)](#8-file-map)
9. [Migration Plan](#9-migration-plan)
10. [Risks & Open Questions](#10-risks--open-questions)

---

## 1. Overview

Add a first-class vehicle layer to the Logistics surface. Vehicles become real resources: managed, assigned to jobs, tracked via driver's logs, inspected, and integrated into expense reporting.

**Core entities:**
- `vehicles` — master data
- `vehicle_categories` + `vehicle_category_assignments` — tagging / filtering
- `vehicle_assignments` — job-level assignment with driver + passengers
- `driver_logs` — odometer-based mileage tracking per job
- `vehicle_inspections` — compliance / maintenance records
- Expense integration via existing `job_expenses` + new `driver_log_expenses` bridge

**Patterns to follow:**
- Equipment CRUD: `src/components/equipment/EquipmentCreationManager.tsx`, `src/hooks/useEquipmentModels.ts`
- Job assignment + realtime: `src/hooks/useJobAssignmentsRealtime.ts`
- Expense workflow: `docs/expenses-workflow.md`, `src/components/expenses/`
- Logistics calendar: `src/components/logistics/LogisticsCalendar.tsx`

---

## 2. Database Schema

### 2.1 Enums

```sql
CREATE TYPE vehicle_type AS ENUM (
  'car', 'van', 'truck', 'minibus', 'trailer', 'other'
);

CREATE TYPE vehicle_status AS ENUM ('active', 'archived', 'restricted');

CREATE TYPE inspection_type AS ENUM (
  'itv', 'safety', 'internal', 'insurance', 'other'
);

CREATE TYPE inspection_result AS ENUM ('ok', 'fail', 'conditional');

CREATE TYPE driver_log_status AS ENUM ('pending', 'complete');
```

### 2.2 `vehicles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `description` | `text NOT NULL` | Display name |
| `license_plate` | `text NOT NULL UNIQUE` | |
| `vehicle_type` | `vehicle_type NOT NULL` | |
| `branch` | `text` | Base / location |
| `seats` | `integer NOT NULL DEFAULT 5` | Including driver |
| `payload_kg` | `numeric(10,2)` | Payload capacity |
| `mileage_allowance_rate` | `numeric(8,4)` | EUR per km |
| `status` | `vehicle_status NOT NULL DEFAULT 'active'` | Soft delete via `archived` |
| `image_path` | `text` | Storage bucket path |
| `notes` | `text` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `created_by` | `uuid FK profiles` | |

Indexes: `license_plate` (unique), `status`, `vehicle_type`.

### 2.3 `vehicle_categories`

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `name` | `text NOT NULL UNIQUE` |
| `created_at` | `timestamptz` |

### 2.4 `vehicle_category_assignments`

| Column | Type |
|--------|------|
| `vehicle_id` | `uuid FK vehicles ON DELETE CASCADE` |
| `category_id` | `uuid FK vehicle_categories ON DELETE CASCADE` |

Composite PK: `(vehicle_id, category_id)`.

### 2.5 `vehicle_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `job_id` | `uuid FK jobs ON DELETE CASCADE` | |
| `vehicle_id` | `uuid FK vehicles ON DELETE RESTRICT` | |
| `driver_id` | `uuid FK profiles` | |
| `passenger_ids` | `uuid[]` | Array of profile IDs |
| `start_time` | `timestamptz` | |
| `end_time` | `timestamptz` | |
| `notes` | `text` | |
| `created_at` | `timestamptz` | |
| `created_by` | `uuid FK profiles` | |

Constraints:
- Unique: `(job_id, vehicle_id)` — one assignment per vehicle per job.
- Check: `array_length(passenger_ids, 1) + 1 <= (SELECT seats FROM vehicles WHERE id = vehicle_id)` — enforced via trigger, not raw check (cross-table reference).
- Double-booking prevention: trigger or exclusion constraint on `(vehicle_id, tstzrange(start_time, end_time))`.

### 2.6 `driver_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `vehicle_id` | `uuid FK vehicles` | |
| `driver_id` | `uuid FK profiles` | |
| `job_id` | `uuid FK jobs` | Nullable (non-job trips) |
| `assignment_id` | `uuid FK vehicle_assignments` | Nullable |
| `start_time` | `timestamptz` | |
| `end_time` | `timestamptz` | |
| `odometer_start` | `integer` | |
| `odometer_end` | `integer` | |
| `distance_km` | `integer GENERATED ALWAYS AS (odometer_end - odometer_start) STORED` | Derived, never user-editable |
| `gps_start` | `point` | Optional |
| `gps_end` | `point` | Optional |
| `status` | `driver_log_status NOT NULL DEFAULT 'pending'` | |
| `locked` | `boolean NOT NULL DEFAULT false` | Immutable after expense submission |
| `notes` | `text` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraints:
- `CHECK (odometer_end >= odometer_start)` (when both present).
- `distance_km` is generated — no direct updates allowed.
- Trigger: set `locked = true` when referenced by an expense; reject updates to odometer fields when locked.

### 2.7 `vehicle_inspections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `vehicle_id` | `uuid FK vehicles ON DELETE CASCADE` | |
| `inspection_type` | `inspection_type NOT NULL` | |
| `inspection_date` | `date NOT NULL` | |
| `mileage_at_inspection` | `integer` | |
| `result` | `inspection_result NOT NULL` | |
| `auditor_id` | `uuid FK profiles` | |
| `notes` | `text` | |
| `document_paths` | `text[]` | Storage bucket paths |
| `next_due_date` | `date` | |
| `next_due_mileage` | `integer` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### 2.8 `driver_log_expenses` (bridge)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `driver_log_id` | `uuid FK driver_logs` | |
| `expense_id` | `uuid FK job_expenses` | Links to existing expense system |
| `distance_km` | `integer NOT NULL` | Snapshot at submission time |
| `rate` | `numeric(8,4) NOT NULL` | Rate used for calculation |
| `amount_eur` | `numeric(10,2) NOT NULL` | `distance_km * rate` |
| `created_at` | `timestamptz` | |

This table creates an immutable snapshot when a driver log is imported into an expense report, following the PRD requirement that expense imports are immutable snapshots.

### 2.9 Storage

New bucket: `vehicle-documents` (private).
- Vehicle images: `vehicles/{vehicle_id}/image.*`
- Inspection documents: `vehicles/{vehicle_id}/inspections/{inspection_id}/*`

---

## 3. Phase 1 — Vehicle Master Data + Assignment + Driver's Log

### 3.1 Vehicle Management (CRUD)

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/VehicleList.tsx` | Table/grid of all vehicles with filtering by type, status, category |
| `src/components/vehicles/VehicleDialog.tsx` | Create/edit dialog. Fields: description, license plate, type, branch, seats, payload, rate, image upload, categories |
| `src/components/vehicles/VehicleCard.tsx` | Compact card for use in assignment selectors and lists |
| `src/components/vehicles/VehicleStatusBadge.tsx` | Badge showing active/archived/restricted status |
| `src/components/vehicles/VehicleCategoryManager.tsx` | Manage vehicle categories (admin) |
| `src/hooks/useVehicles.ts` | React Query hook: `queryKey: ['vehicles']`. CRUD mutations. Pattern: `src/hooks/useEquipmentModels.ts` |
| `src/hooks/useVehicleCategories.ts` | React Query hook for categories |

**Modified files:**

| File | Change |
|------|--------|
| `src/pages/Logistics.tsx` | Add tab/section for Vehicles alongside the existing calendar |
| `src/App.tsx` | No route change needed — vehicles live within `/logistics` |

**UX:**
- Vehicles tab on Logistics page, next to the existing calendar view.
- Table with columns: license plate, description, type, seats, payload, status.
- Filters: type (dropdown), status (active/archived), category (multi-select).
- Click row → edit dialog.
- Archive instead of delete (soft delete).

### 3.2 Vehicle Assignment in Planning

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/VehicleAssignmentDialog.tsx` | Assign vehicle to job: vehicle selector, driver selector, passenger multi-select, date/time range. Seat limit enforcement inline. |
| `src/components/vehicles/VehicleAssignmentCard.tsx` | Shows assigned vehicle on job detail page |
| `src/components/vehicles/VehicleAvailabilityCheck.tsx` | Inline availability indicator — shows conflicts when selecting vehicle + date range |
| `src/hooks/useVehicleAssignments.ts` | React Query + realtime subscription. Pattern: `src/hooks/useJobAssignmentsRealtime.ts` but simpler (no Flex sync needed). Query key: `['vehicle-assignments', jobId]` |

**Modified files:**

| File | Change |
|------|--------|
| `src/components/jobs/JobAssignments.tsx` (or parent) | Add vehicle assignment section below crew assignments |
| `src/components/logistics/LogisticsCalendar.tsx` | Show vehicle assignments as a layer/indicator on calendar events |

**Double-booking prevention:**
- Server-side: trigger on `vehicle_assignments` INSERT/UPDATE that checks for overlapping `tstzrange(start_time, end_time)` on the same `vehicle_id`. Raises exception on conflict.
- Client-side: `VehicleAvailabilityCheck` component queries existing assignments for the selected vehicle and date range, shows warning before submission.

**Seat limit enforcement:**
- Trigger on `vehicle_assignments` validates `array_length(passenger_ids, 1) + 1 <= vehicles.seats`.
- Client-side: dynamic seat counter in `VehicleAssignmentDialog`.

### 3.3 Driver's Log

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/DriverLogForm.tsx` | Mobile-first form. Start: select vehicle (pre-filled from assignment), enter odometer start. End: enter odometer end. Distance auto-calculated and displayed. Supports deferred entry (save start, come back for end). |
| `src/components/vehicles/DriverLogList.tsx` | List of driver logs for a job or vehicle. Shows status, distance, driver, timestamps. |
| `src/components/vehicles/DriverLogCard.tsx` | Compact card for individual log entry |
| `src/hooks/useDriverLogs.ts` | React Query hook. Query keys: `['driver-logs', jobId]`, `['driver-logs', vehicleId]`. CRUD mutations. |

**Modified files:**

| File | Change |
|------|--------|
| `src/pages/Logistics.tsx` | Driver log access point (or accessible from job detail) |

**Flow:**
1. Driver navigates to assigned job (or Logistics → Driver's Log).
2. Sees assigned vehicle pre-selected.
3. Taps "Start Trip" → enters odometer start (number input, large touch target).
4. Optional: capture GPS start via browser Geolocation API.
5. After trip, taps "End Trip" → enters odometer end.
6. Distance calculated and displayed. Status → `complete`.
7. Validation: odometer_end >= odometer_start.
8. Deferred entry: driver can save with only start, return later to complete.

**Mobile-first considerations:**
- Large numeric input for odometer.
- One-tap start/end flow.
- Camera icon to photograph odometer (future, not Phase 1).
- Offline support via service worker queue (future, not Phase 1).

---

## 4. Phase 2 — Inspections + Expense Integration

### 4.1 Inspections & Maintenance

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/InspectionList.tsx` | List of inspections per vehicle, sortable by date |
| `src/components/vehicles/InspectionDialog.tsx` | Create/edit inspection: type, date, mileage, result, auditor, notes, document upload |
| `src/components/vehicles/InspectionReminders.tsx` | Dashboard widget showing upcoming/overdue inspections |
| `src/hooks/useVehicleInspections.ts` | React Query hook. Query key: `['vehicle-inspections', vehicleId]` |

**Reminder system:**
- Supabase Edge Function (cron or scheduled): query inspections where `next_due_date <= NOW() + interval '30 days'` or `next_due_mileage <= latest_odometer + 1000`.
- Insert into `notifications` table for relevant admins.
- Overdue inspections: trigger sets `vehicles.status = 'restricted'` when an inspection is past due.

**Restricted vehicle behavior:**
- `restricted` status shown as warning badge on vehicle card.
- Assignment dialog shows warning when selecting a restricted vehicle (soft block, admin can override).

### 4.2 Expense Integration

**How it works:**
- Driver completes a log → log appears in "Import to Expenses" flow.
- Driver or admin selects completed logs → system creates `job_expenses` records via `submit_job_expense()` RPC with category `transporte`.
- Simultaneously creates `driver_log_expenses` bridge records (immutable snapshot of distance, rate, amount).
- Sets `driver_logs.locked = true` — no further edits to odometer values.

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/DriverLogExpenseImport.tsx` | UI to select completed logs and import them as expenses. Shows distance, rate, calculated amount. Confirm to submit. |
| `src/hooks/useDriverLogExpenses.ts` | Handles the import flow: creates expense + bridge record in a transaction. |

**Modified files:**

| File | Change |
|------|--------|
| `src/components/expenses/ExpenseList.tsx` | Show source indicator when expense originated from a driver log |
| `src/components/expenses/ExpenseSummaryCard.tsx` | Include mileage-based expenses in totals |

**New RPC:**
```sql
CREATE FUNCTION import_driver_log_expense(
  p_driver_log_id uuid,
  p_job_id uuid
) RETURNS job_expenses AS $$
-- 1. Validate log is complete and not locked
-- 2. Get vehicle mileage_allowance_rate
-- 3. Calculate amount = distance_km * rate
-- 4. Call submit_job_expense() with category 'transporte'
-- 5. Insert driver_log_expenses bridge record
-- 6. Set driver_logs.locked = true
-- 7. Return the created expense
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Receipt handling:**
- Driver logs that import to expenses can optionally attach receipts (tolls, parking) via the existing `ReceiptUploadField` component.
- The driver log expense bridge stores the mileage calculation; additional receipts attach to the `job_expenses` record normally.

---

## 5. Phase 3 — Reporting + Policy Automation

### 5.1 Reporting Views

**New materialized view:** `v_vehicle_usage_summary`
```sql
-- Per vehicle: total distance, total trips, avg distance per trip,
-- total expense amount, active driver count, last used date
```

**New view:** `v_driver_mileage_summary`
```sql
-- Per driver: total distance, total trips, total expenses,
-- vehicles used, date range
```

**New files:**

| File | Purpose |
|------|---------|
| `src/components/vehicles/VehicleReportDashboard.tsx` | Charts and tables: fleet utilization, mileage trends, cost per vehicle, inspection compliance rate |
| `src/components/vehicles/DriverMileageReport.tsx` | Per-driver mileage summary with export to PDF/XLS |
| `src/utils/pdf/vehicleReports.ts` | PDF generation for vehicle reports (follows `src/utils/pdf/` patterns) |

### 5.2 Policy Automation

- **Auto-restrict on overdue inspection:** Trigger on `vehicle_inspections` that checks all vehicles and sets status to `restricted` when `next_due_date < NOW()`.
- **Mileage alerts:** Edge Function that flags vehicles approaching maintenance mileage thresholds.
- **Usage anomaly detection:** Flag driver logs with unusually high distance for a given job (configurable threshold).

### 5.3 Success Metrics Tracking

Queries to power a metrics dashboard:
```sql
-- % of jobs with assigned vehicle
SELECT count(*) FILTER (WHERE va.id IS NOT NULL) * 100.0 / count(*)
FROM jobs j LEFT JOIN vehicle_assignments va ON va.job_id = j.id
WHERE j.start_date >= date_trunc('month', NOW());

-- % of driver logs completed same day
SELECT count(*) FILTER (WHERE dl.end_time::date = dl.start_time::date) * 100.0 / count(*)
FROM driver_logs dl WHERE dl.status = 'complete';

-- Inspection compliance rate
SELECT count(*) FILTER (WHERE v.status != 'restricted') * 100.0 / count(*)
FROM vehicles v WHERE v.status != 'archived';
```

---

## 6. Permissions & RLS

### Role Matrix

| Role | Vehicles | Assignments | Driver Logs | Inspections | Expenses |
|------|----------|-------------|-------------|-------------|----------|
| `admin` | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| `management` | Full CRUD | Full CRUD | Read all | Full CRUD | Read all, approve |
| `logistics` | Read, create, update | Create, read, update | Read all | Read | — |
| `house_tech` | Read | Read own | Read/write own | — | Submit own |
| `technician` | Read | Read own | Read/write own | — | Submit own |

### RLS Policies

Follow the pattern from `expense_permissions` / `job_expenses`:

```sql
-- vehicles: readable by all authenticated, writable by admin/management/logistics
-- vehicle_assignments: readable by all authenticated, writable by admin/management/logistics
-- driver_logs: management reads all; drivers read/write own
-- vehicle_inspections: management full CRUD; others read
-- driver_log_expenses: follows job_expenses RLS (management full; tech reads own)
```

Realtime: enable on `vehicle_assignments` and `driver_logs` for live updates on logistics calendar and job detail.

---

## 7. UI/UX Design Notes

### Logistics Page Layout

```
/logistics
├── [Tab: Calendar]      ← existing LogisticsCalendar
├── [Tab: Vehicles]      ← NEW — vehicle list + management
├── [Tab: Driver's Log]  ← NEW — log list, filterable by vehicle/driver/job
└── [Tab: Inspections]   ← Phase 2 — inspection dashboard
```

Tabs implemented via existing pattern (see other tabbed pages in the app — use shadcn `Tabs` component).

### Vehicle Assignment on Job Detail

Below crew assignments section:
```
Vehículo asignado
┌─────────────────────────────────────┐
│ 🚐 Furgoneta ABC-1234              │
│ Conductor: Juan García              │
│ Pasajeros: María López, Pedro Ruiz  │
│ 08:00 - 18:00                       │
│ [Editar] [Eliminar]                 │
└─────────────────────────────────────┘
[+ Asignar vehículo]
```

### Driver's Log Mobile Flow

```
┌──────────────────────┐
│ Registro de Conducción│
│                      │
│ Vehículo: ABC-1234   │  ← pre-filled from assignment
│                      │
│ ┌──────────────────┐ │
│ │ Km inicio        │ │  ← large numeric input
│ │ [    45,230    ]  │ │
│ └──────────────────┘ │
│                      │
│ [  Iniciar Viaje  ]  │  ← primary action button
│                      │
│ ── or after trip ──  │
│                      │
│ ┌──────────────────┐ │
│ │ Km final         │ │
│ │ [    45,387    ]  │ │
│ └──────────────────┘ │
│                      │
│ Distancia: 157 km    │  ← auto-calculated
│                      │
│ [  Finalizar Viaje ]  │
└──────────────────────┘
```

### Language

All UI text in Spanish, following existing conventions:
- "Vehículos" (Vehicles)
- "Registro de Conducción" (Driver's Log)
- "Conductor" (Driver)
- "Pasajeros" (Passengers)
- "Km inicio / Km final" (Start/End odometer)
- "Inspecciones" (Inspections)
- "Matrícula" (License plate)

---

## 8. File Map (New & Modified)

### New Files

```
src/
├── components/vehicles/
│   ├── VehicleList.tsx                  # Vehicle table with filters
│   ├── VehicleDialog.tsx                # Create/edit vehicle
│   ├── VehicleCard.tsx                  # Compact vehicle display
│   ├── VehicleStatusBadge.tsx           # Status indicator
│   ├── VehicleCategoryManager.tsx       # Category CRUD (admin)
│   ├── VehicleAssignmentDialog.tsx      # Assign vehicle to job
│   ├── VehicleAssignmentCard.tsx        # Show assignment on job page
│   ├── VehicleAvailabilityCheck.tsx     # Conflict detection inline
│   ├── DriverLogForm.tsx               # Start/end trip form (mobile-first)
│   ├── DriverLogList.tsx               # Log listing + filters
│   ├── DriverLogCard.tsx               # Individual log card
│   ├── DriverLogExpenseImport.tsx       # Phase 2: import to expenses
│   ├── InspectionList.tsx              # Phase 2: inspection list
│   ├── InspectionDialog.tsx            # Phase 2: create/edit inspection
│   ├── InspectionReminders.tsx         # Phase 2: overdue dashboard
│   ├── VehicleReportDashboard.tsx      # Phase 3: reporting
│   └── DriverMileageReport.tsx         # Phase 3: per-driver reports
├── hooks/
│   ├── useVehicles.ts                   # Vehicle CRUD + query
│   ├── useVehicleCategories.ts          # Category management
│   ├── useVehicleAssignments.ts         # Assignment CRUD + realtime
│   ├── useDriverLogs.ts                # Log CRUD + query
│   ├── useVehicleInspections.ts        # Phase 2: inspection CRUD
│   └── useDriverLogExpenses.ts         # Phase 2: expense import
├── utils/pdf/
│   └── vehicleReports.ts              # Phase 3: PDF generation

supabase/migrations/
├── 20260217000000_vehicle_management_enums.sql
├── 20260217000100_vehicle_management_tables.sql
├── 20260217000200_vehicle_management_rls.sql
├── 20260217000300_vehicle_assignment_triggers.sql
├── 20260217000400_driver_log_functions.sql
# Phase 2:
├── 20260XXX000000_vehicle_inspections.sql
├── 20260XXX000100_driver_log_expense_bridge.sql
├── 20260XXX000200_import_driver_log_expense_rpc.sql
# Phase 3:
├── 20260XXX000000_vehicle_reporting_views.sql
```

### Modified Files

| File | Change | Phase |
|------|--------|-------|
| `src/pages/Logistics.tsx` | Add Tabs component wrapping calendar + vehicles + driver's log | 1 |
| `src/components/logistics/LogisticsCalendar.tsx` | Optional vehicle layer on calendar events | 1 |
| `src/components/jobs/JobAssignments.tsx` (or parent) | Vehicle assignment section | 1 |
| `src/lib/optimized-react-query.ts` | Add query key factories for vehicles, driver-logs | 1 |
| `src/components/expenses/ExpenseList.tsx` | Source indicator for driver-log expenses | 2 |
| `src/components/expenses/ExpenseSummaryCard.tsx` | Include mileage totals | 2 |
| `src/integrations/supabase/types.ts` | Auto-regenerated after migrations | 1 |

---

## 9. Migration Plan

### Phase 1 Migrations

**Migration 1: Enums** (`20260217000000_vehicle_management_enums.sql`)
```sql
CREATE TYPE vehicle_type AS ENUM ('car', 'van', 'truck', 'minibus', 'trailer', 'other');
CREATE TYPE vehicle_status AS ENUM ('active', 'archived', 'restricted');
CREATE TYPE driver_log_status AS ENUM ('pending', 'complete');
```

**Migration 2: Tables** (`20260217000100_vehicle_management_tables.sql`)
- `vehicles`, `vehicle_categories`, `vehicle_category_assignments`
- `vehicle_assignments`, `driver_logs`
- All FK constraints, indexes, defaults
- Enable realtime on `vehicle_assignments`, `driver_logs`

**Migration 3: RLS** (`20260217000200_vehicle_management_rls.sql`)
- RLS policies per role matrix above
- Storage bucket `vehicle-documents` with policies

**Migration 4: Triggers** (`20260217000300_vehicle_assignment_triggers.sql`)
- Double-booking prevention trigger on `vehicle_assignments`
- Seat limit validation trigger on `vehicle_assignments`
- `updated_at` auto-update triggers

**Migration 5: Functions** (`20260217000400_driver_log_functions.sql`)
- `validate_driver_log()` — ensures odometer_end >= odometer_start
- `lock_driver_log()` — sets locked flag, prevents further edits
- RPC: `get_vehicle_availability(vehicle_id, start_time, end_time)` → returns conflicting assignments

### Phase 2 Migrations

- Inspection enums + `vehicle_inspections` table + RLS
- `driver_log_expenses` bridge table
- `import_driver_log_expense()` RPC
- Trigger: auto-restrict vehicle on overdue inspection
- Add `transporte` to `expense_categories` if not already present

### Phase 3 Migrations

- Materialized views for reporting
- Refresh function for materialized views (cron via Edge Function)

---

## 10. Risks & Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| User friction logging mileage | Low adoption of driver's log | Deferred entry, pre-filled vehicle from assignment, one-tap flow |
| Incorrect odometer data | Bad mileage calculations | Validation (end >= start), audit trail, admin override |
| Over-engineering Phase 1 | Delayed delivery | Strict phase boundaries — inspections and expenses are Phase 2 |
| Double-booking edge cases | Conflicting assignments | Server-side trigger as source of truth, client-side warning as UX aid |
| Migration complexity | Deployment risk | Split into multiple small migrations, test each independently |
| Supabase type regeneration | Build breaks | Regenerate types immediately after migration, verify build |

### Open Questions

1. **Vehicle images**: Use existing storage bucket pattern or create a dedicated `vehicle-documents` bucket?
   - **Recommendation:** Dedicated bucket for cleaner organization and separate RLS policies.

2. **GPS capture**: Browser Geolocation API is available but requires user permission. Include in Phase 1 as optional, or defer entirely?
   - **Recommendation:** Include as optional in Phase 1 (just lat/lng capture on start/end). No map display until Phase 3.

3. **Transport requests integration**: The existing `transport_requests` table tracks vehicle type requests. Should vehicle assignments link to fulfilled transport requests?
   - **Recommendation:** Add optional `transport_request_id` FK to `vehicle_assignments` in Phase 1 for traceability.

4. **Multi-vehicle per job**: PRD says "one vehicle per job" but some jobs may need multiple vehicles (e.g., one for crew, one for equipment).
   - **Recommendation:** Allow multiple vehicle assignments per job (the schema supports this via separate rows). The "one per job" constraint from the PRD can be a UI default, not a hard constraint.

5. **Rate source for expense calculation**: Use vehicle's `mileage_allowance_rate` or a global company rate?
   - **Recommendation:** Vehicle-level rate with company-level fallback default.

6. **Existing `license_plate` field on `logistics_events`**: Should this reference the new `vehicles` table?
   - **Recommendation:** Phase 1 adds an optional `vehicle_id` FK to `logistics_events`. Keep `license_plate` text field for backward compatibility with events that reference external vehicles.

---

## Appendix: PRD Traceability

| PRD Section | Plan Section | Phase |
|-------------|-------------|-------|
| 4.1 Vehicle Management | 3.1 Vehicle Management | 1 |
| 4.2 Vehicle Categories | 2.3, 2.4 Schema + 3.1 | 1 |
| 4.3 Vehicle Assignment | 3.2 Vehicle Assignment | 1 |
| 4.4 Driver's Log | 3.3 Driver's Log | 1 |
| 4.5 Inspections | 4.1 Inspections | 2 |
| 4.6 Expense Integration | 4.2 Expense Integration | 2 |
| §5 Permissions | §6 Permissions & RLS | 1 |
| §6 UX/UI Notes | §7 UI/UX Design Notes | 1 |
| §7 Technical Notes | §2 Schema, §6 RLS | 1-2 |
| §8 Success Metrics | 5.3 Success Metrics | 3 |
| §10 Phase Rollout | Phases 1-3 | 1-3 |
