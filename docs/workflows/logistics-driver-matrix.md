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
| Live tracking | `/logistics?tab=tracking` (`DriverTrackingPanel`) | admin/management/house_tech |
| Driver licence card | `/profile` (`ConductorProfileCard`) | the driver, read-only |

Code: `src/features/logistics/fleet/` (model, RPC wrappers, hooks), `src/features/logistics/events/` (event place hook) and
`src/components/logistics/fleet/`. Schema: `supabase/migrations/20260924100000_add_conductor_role.sql`,
`20260924100500_logistics_fleet_and_driver_assignments.sql`,
`20260924110000_harden_logistics_driver_matrix.sql` and
`20260924120000_logistics_matrix_operational_fields.sql`; pgTAP in
`supabase/tests/database/logistics_fleet_driver_assignments.sql`.

The calendar tab and the day panel (`LogisticsEventCard` via `useEventDriverSummaries`)
also show who is driving each transport, reusing the matrix query for the visible range.

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
- Licence/CAP/tachograph checks and vehicle ITV/insurance expiry remain soft warnings
  because document data may simply not be entered yet. Known employee unavailability
  (vacation/travel/sick/day off/warehouse/unavailable) is a real assignment conflict:
  `assign_transport_driver` returns `kind: "availability"` and management must use
  the explicit `p_force` / *Guardar igualmente* override to schedule it anyway. There
  is deliberately no staffing availability-request phase for conductors.
- The matrix header counts assignments still waiting for the driver's answer that start
  within 48 h (`countPendingConfirmations`), so dispatch knows whom to chase.

## Data model

- `fleet_vehicles` — own fleet. Plate uniqueness ignores spaces/dashes/case. Carries
  `itv_expiry`, `insurance_expiry` and `has_tail_lift` (plataforma elevadora). A vehicle
  with assignment history cannot be deleted (FK `restrict`); deactivate it instead.
- `driver_details` — one row per conductor: licence categories (`B…D+E`), licence, CAP
  and tachograph-card expiry, ADR, usual vehicle, notes. **Notes are visible to the driver.**
- `transport_driver_assignments` — event × driver and/or vehicle, window, status
  `assigned → confirmed | declined`, and an optional `decline_reason` (≤ 500 chars) the
  driver gave. A declined row is kept as history but releases its driver/vehicle slot
  (the unique indexes and conflict checks skip it). A material change or a confirmation
  clears the reason.
- **Days off** are not stored here: `get_logistics_matrix()` projects the canonical
  availability sources (`technician_availability`, `availability_schedules`, approved
  `vacation_requests`). The matrix greys those cells out, and the assignment RPC itself
  refuses an accidental save unless management explicitly overrides the conflict.
- **Dispatch contact**: `get_logistics_matrix()` returns a driver's `phone` only when the
  caller is admin/management (null for house_tech). The day dialog turns it into
  WhatsApp / `tel:` shortcuts through `@/utils/phoneLinks`. Never read `profiles.phone`
  directly for this.

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
  the instructions (`notes`). It also clears a stale `decline_reason`.
- **Nothing here touches staffing.** Drivers are employees receiving direct work
  assignments: no `staffing_requests`, availability campaigns, offers, `job_assignments`,
  timesheets or rates are created. The state machine is simply
  `assigned → confirmed | declined`.

## Notifications

Assignments and material updates use three delivery channels. Push is fire-and-forget
from `fleetApi.ts` and resolved server-side in
`supabase/functions/push/broadcast/families/driverEvents.ts`. In parallel,
`send-driver-assignment-notification` sends Brevo email + WAHA WhatsApp (when the
driver has those contact details and the assigning manager has WAHA configured).
Successful channel sends are deduped per `assignment_id + updated_at + channel` in
`driver_assignment_delivery_log`. Email/WhatsApp link straight to `/conductor`;
they do not create staffing requests or action tokens.

| Event | Sent by | Recipient | Opens |
| --- | --- | --- | --- |
| `logistics.driver.assigned` / `.updated` | admin/management | the stored driver | `/conductor` |
| `logistics.driver.removed` | admin/management | the driver (verified `conductor` role) | `/conductor` |
| `logistics.driver.confirmed` / `.declined` | the driver, own assignment, only once that status is stored | logistics management + whoever assigned it | `/logistics?tab=drivers` |

A `.declined` push appends the driver's reason (`Motivo: …`) when they gave one. On
`/conductor`, **No puedo** opens `DeclineTransportDialog` to ask for it (optional, so a
driver on the road is never blocked) before `respond_transport_assignment(id, 'declined', reason)`.

Drivers enable push on their profile like crew do (`canViewProfilePushControls`).

## Driver dashboard (`/conductor`)

What a driver gets per transport (`ConductorAssignmentCard`), all from
`get_my_transport_assignments()`:

- **Next run first**: the first upcoming non-declined assignment is highlighted with a
  static map tile (`static-map` edge function, fetched once per venue) and a countdown
  (`describeTimeUntil`: "Empieza en 2 h 15 min", "En curso"…).
- **Navigation** (`src/features/logistics/fleet/navigation.ts`): *Cómo llegar* (Google
  Maps, driving), *Waze*, *Apple Maps* on Apple devices, and *Ruta completa* from the
  transport request's origin when there is one. Links use the venue coordinates from
  `locations` and fall back to name + address. *Copiar* puts the address on the
  clipboard for a truck's own sat-nav.
- **Responsable de producción** for job-backed transports, with WhatsApp / call
  shortcuts. `get_job_producer_contacts()` releases the rows to a driver who holds a
  live (non-declined) assignment on one of the job's transports — see
  `docs/workflows/job-producer-claims.md`.
- **Where "the place" comes from**: `logistics_events.location_id` when the transport
  names its own place (picked with `PlaceAutocomplete` in the event dialog: a supplier,
  a pickup point, the warehouse), otherwise the job's `jobs.location_id`. Both are
  `locations` rows, so coordinates come for free. Transport requests' *Origen* /
  *Destino* use `AddressAutocomplete`, so a picked suggestion stores a full address the
  route link can resolve.
- Vehicle line shows *Plataforma* when the vehicle has a tail lift; a declined card shows
  the driver's own reason.
- **Transportes anteriores**: the last 30 days, collapsed by default.

## Live tracking (`Seguimiento`)

Opt-in, foreground-only position sharing from the driver's phone to the logistics map.

- **Driver side**: the switch on `/conductor` (`ConductorLocationSharingCard` →
  `useDriverLocationSharing`). Positions are sent only while `currentSharingAssignment`
  finds a non-declined transport that is running or starts within
  `SHARING_LEAD_MINUTES` (2 h); otherwise the switch waits. Fixes are throttled
  (`shouldReportPosition`: 30 s or 50 m) and go through `report_driver_location()`,
  which checks the caller is a conductor and that the attached assignment is their own.
  Turning the switch off calls `stop_sharing_driver_location()`, which deletes the row.
- **Storage**: `driver_locations` holds **one row per driver — the latest position, no
  trail**. A row is deleted as soon as its assignment is declined, reassigned, moved
  out of the sharing window or removed (`cleanup_driver_location_for_assignment`
  trigger), and `cleanup_driver_locations()` sweeps leftovers hourly **when `pg_cron`
  is installed** (without it, rows past their window stay hidden but are not deleted).
  The read model ignores anything older than 12 h or outside the assignment window,
  and the UI greys positions past `STALE_AFTER_MINUTES` (10). RLS: the driver reads
  their own row; matrix viewers read only rows inside an active assignment window;
  nobody writes directly.
- **Logistics side**: `get_driver_locations()` (matrix viewers only) feeds the tab: a
  Mapbox GL map (`DriverTrackingMap`, lazy-loaded, marker per driver + pin for the
  destination of their current transport) and a list that works without a token. Route
  subscriptions invalidate the `driver_locations` query key on every change, with a
  30 s poll as fallback; positions deliberately do **not** share the matrix key.
- **PWA, not native**: drivers use the installed web app, so there is no background
  location. While sharing is active the hook holds a Screen Wake Lock
  (`useScreenWakeLock`, re-acquired on every return to the foreground), sends a fresh
  fix on `visibilitychange`, and keeps a fix that failed to upload (tunnel, no coverage)
  to re-send on `online`. The card tells the driver to keep the app on screen. On iOS
  Safari the site must be allowed to use location in Settings → Safari → Location, and
  the wake lock needs iOS 16.4+.

## Giving someone the role

Set the user's role to **Conductor** in the user editor. The `ConductorRouteGuard`
limits them to `/conductor`, `/profile` and `/notifications`.
