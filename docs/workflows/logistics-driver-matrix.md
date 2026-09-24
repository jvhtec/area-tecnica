# Logistics driver matrix, fleet and the `conductor` role

The logistics department's own assignment matrix. It reuses the crew matrix idea
(people × days, colour-coded status, conflict detection) but its rows are **drivers**
and **fleet vehicles**, and the work assigned is **scheduled transports**
(`logistics_events` — the loads/unloads created by transport planning or the
logistics calendar), not jobs.

## Where it lives

| Surface | Path | Who |
| --- | --- | --- |
| Matrix | `/logistics?tab=drivers` (`LogisticsDriverMatrix`) | admin/management edit, house_tech read-only |
| Fleet + driver licences | `/logistics?tab=fleet` (`FleetManagementPanel`) | admin/management edit, house_tech read-only |
| Driver dashboard | `/conductor` (`ConductorDashboard`) | `conductor` only |
| Driver licence card | `/profile` (`ConductorProfileCard`) | the driver, read-only |

Code: `src/features/logistics/fleet/` (model, RPC wrappers, hooks) and
`src/components/logistics/fleet/`. Schema: `supabase/migrations/20260924100000_add_conductor_role.sql`
and `20260924100500_logistics_fleet_and_driver_assignments.sql`; pgTAP in
`supabase/tests/database/logistics_fleet_driver_assignments.sql`.

## Granularity: time windows, not day cells

A driver can run several transports on the same day, so a
`transport_driver_assignments` row carries its own `starts_at`/`ends_at` window
(defaulting to the event's local time + 2 h). A matrix cell lists every assignment
whose window touches that Madrid day, in start order; an overnight haul appears on
each day it spans. Double booking is checked per **window** for both the driver and
the vehicle:

- `assign_transport_driver` returns `{status: "conflict", conflicts}` without writing
  when a window overlaps another non-declined assignment for the same driver or
  vehicle; the UI shows the clash and can resend with `p_force => true`.
- The matrix rings overlapping chips in red (`findDoubleBookedAssignmentIds`).
- Licence/CAP checks (`driverVehicleWarnings`) are soft warnings only — licence data
  may simply not be entered yet.

## Data model

- `fleet_vehicles` — own fleet. Plate uniqueness ignores spaces/dashes/case. A vehicle
  with assignment history cannot be deleted (FK `restrict`); deactivate it instead.
- `driver_details` — one row per conductor: licence categories (`B…D`), licence and
  CAP expiry, ADR, usual vehicle, notes. **Notes are visible to the driver.**
- `transport_driver_assignments` — event × driver and/or vehicle, window, status
  `assigned → confirmed | declined`. A declined row is kept as history but releases
  its driver/vehicle slot (the unique indexes and conflict checks skip it).

## Invariants

- **Writes only through RPCs.** `authenticated` has `SELECT` on assignments but no
  `INSERT/UPDATE/DELETE`; use `assign_transport_driver`,
  `remove_transport_driver_assignment` and `respond_transport_assignment`.
- **Concurrent saves are serialized** per driver and per vehicle with transaction-scoped
  advisory locks, so two managers cannot both pass the overlap check at once.
- **The `logistics` role has no access**: the matrix read set is admin/management/house_tech,
  the same as who can open `/logistics`.
- **Drivers see only their own transports**, through RLS and
  `get_my_transport_assignments()` (deliberately narrow: time, place, route, vehicle,
  notes — no rates, crew or other jobs). They cannot read the matrix RPC.
- **Replanning/cancelling cannot silently drop a live assignment.** A `BEFORE DELETE`
  guard on `logistics_events` refuses deleting an event while it has an upcoming,
  non-declined driver/vehicle assignment. Remove or reassign it in the matrix first;
  that explicit path owns the driver notification. Declined or finished history may
  still cascade with an event.
- **A busy conductor keeps the role and account.** Triggers on `profiles` refuse both
  changing a conductor's role and deleting a profile while upcoming, non-declined
  assignments exist. The `delete-user` edge function performs the same check early
  so the admin gets a useful conflict instead of a failed auth cascade.
- **Any change a driver must act on resets confirmation**: driver, vehicle, window or
  the instructions (`notes`).
- **Nothing here touches staffing.** No `job_assignments`, timesheets or rates are
  created for drivers.

## Notifications

Fire-and-forget pushes from `fleetApi.ts`, resolved server-side in
`supabase/functions/push/broadcast/families/driverEvents.ts`:

| Event | Sent by | Recipient | Opens |
| --- | --- | --- | --- |
| `logistics.driver.assigned` / `.updated` | admin/management | the stored driver | `/conductor` |
| `logistics.driver.removed` | admin/management | the driver (verified `conductor` role) | `/conductor` |
| `logistics.driver.confirmed` / `.declined` | the driver, own assignment, only once that status is stored | logistics management + whoever assigned it | `/logistics?tab=drivers` |

Drivers enable push on their profile like crew do (`canViewProfilePushControls`).

## Giving someone the role

Set the user's role to **Conductor** in the user editor. The `ConductorRouteGuard`
limits them to `/conductor`, `/profile` and `/notifications`.
