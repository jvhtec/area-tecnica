# Wallboard – Structure, Deployment & Status

_Last updated: 2025‑11‑15 (session with Codex CLI)_

This document captures how the wallboard is structured, what we changed in this session, and how it is currently deployed and configured (including the new `produccion` preset stub).

---

## 1. High‑level Structure

- **Entry point:** `src/pages/Wallboard.tsx`
  - Uses `useParams<{ presetSlug?: string }>()` to read a `presetSlug`.
  - Guards access via `useRoleGuard(['admin','management','wallboard'])`.
  - Drives which panels are visible and how they rotate based on the `wallboard_presets` row for the given slug.

- **Panels (`PanelKey`):**
  - `overview` – “Trabajos – Próximos días”
  - `crew` – “Asignaciones de Equipo”
  - `logistics` – “Logística – Próximos días”
  - `pending` – “Acciones Pendientes”
  - `calendar` – “Calendario de Trabajos”
  - Each panel is wrapped in `AutoScrollWrapper` for continuous vertical scrolling.

- **Data model (client side):**
  - `JobsOverviewFeed`, `CrewAssignmentsFeed`, `DocProgressFeed`, `PendingActionsFeed`, `CalendarFeed`, `LogisticsItem`.
  - Jobs and logistics now carry a `color?: string | null` so UI cards can be tinted using the DB color.
  - Crew jobs also include `jobType`, `start_time`, `end_time` for badges and date‑type icons.

---

## 2. Data Sources & RLS

### 2.1. Tables and views used

The wallboard reads from:

- Core job data:
  - `jobs` (with `job_type`, `status`, `color`, `tour_id`, `timezone`)
  - `job_departments`
  - `job_assignments`
  - `job_required_roles_summary`
  - `locations`
  - `wallboard_doc_counts` (view)
  - `wallboard_doc_requirements` (view)
  - `wallboard_profiles` (view)
  - `wallboard_timesheet_status` (view)
  - `job_documents`
  - `timesheets`
- Logistics:
  - `logistics_events` (with `color`, `event_type`, `transport_type`)
  - `logistics_event_departments`
- Meta / presets / announcements:
  - `wallboard_presets`
  - `announcements`

These are wired through the client using the shared Supabase client `supabase` from `@/lib/supabase`.

### 2.2. Wallboard RLS for the `wallboard` user

RLS is defined across several migration files:

- `20250927090000_wallboard_least_privilege.sql`
  - Enables RLS and adds `wb_*_select` policies for:
    - `jobs`, `job_assignments`, `announcements`, `required_docs`
  - Adds views:
    - `wallboard_profiles`
    - `wallboard_timesheet_status`
    - `wallboard_doc_counts`
    - `wallboard_doc_requirements`
  - All policies use:
    ```sql
    public.get_current_user_role() = any (array['admin','management','wallboard'])
    ```

- `20250927103000_wallboard_rls_more_tables.sql`
  - Extends RLS for:
    - `job_departments`, `locations`, `profiles`, `job_documents`, `timesheets`
  - Same `admin/management/wallboard` read rules.

- `20250927105500_wallboard_rls_logistics_events.sql`
  - Enables RLS for:
    - `logistics_events`, `logistics_event_departments`
  - Select policy for `admin/management/wallboard`.

- `20251115120000_adjust_locations_policy_for_techs.sql`
  - Replaces `wb_locations_select` so that:
    - `admin/management/wallboard` can read all locations.
    - Technicians assigned to a job at a location can read that location as well (for other parts of the app).

- `20251015060224_30df69cb-51c8-42a8-8830-ceafb7d8d0aa.sql`
  - Sets `security_invoker = true` and `security_barrier = true` on all wallboard views so they respect underlying table RLS.

In this session we also provided a consolidated SQL snippet (not committed as a migration) to re‑establish wallboard read access if needed; the actual canonical behavior is already captured in the migrations above.

---

## 3. Visual & UX Behavior

### 3.1. Auto‑scrolling

- Implemented in `AutoScrollWrapper`:
  - Uses `requestAnimationFrame` to scroll at `speed` px/sec.
  - Tracks fractional scroll position independently (`position` variable) so sub‑pixel movements accumulate.
  - Bounces between top and bottom with a short pause at each end (1s), then reverses direction.
  - `resetKey` + `speed` control when the scroll resets to top; panels pass:
    - For paged panels: `resetKey={page}`
    - For calendar: `resetKey` derived from calendar range + job count.
  - In producción mode we reduce `scrollSpeed` for the calendar to be slower/smoother.

### 3.2. Panel details

- **Jobs Overview (`overview`):**
  - Cards show:
    - Job title
    - Status dot (`green/yellow/red`)
    - Location name
    - Date/time range
    - Per‑department staffing counts
    - Docs summary per department
    - Job type badge (`Evento único`, `Fecha de gira`, `Festival`, `Dry hire`, etc.)
    - Date span badge (`1 día` / `N días`)
    - Card background tinted from `jobs.color`.
  - For tourdate jobs, a small date‑type icon (show/rehearsal/travel/setup) appears in the status area.

- **Crew Assignments (`crew`):**
  - One card per job; per‑technician rows inside.
  - Each job header shows:
    - Job title
    - Job type and date span badges
    - Background tinted by `jobs.color`.
  - Per‑technician row:
    - Department icon (🎧 / 💡 / 📹 / 👤)
    - Role & name
    - Timesheet status badge in Spanish:
      - `aprobado`, `enviado`, `borrador`, `faltante`, `rechazado`
    - Timesheet badges are hidden for `tourdate` jobs.

- **Doc Progress (`docs`):**
  - Job cards tinted by `jobs.color`.
  - Per‑department blocks with percent bars and missing docs list.
  - Job header includes date‑type icon same as crew panel.

- **Pending Actions (`pending`):**
  - Derived from jobs with under‑staffing and missing timesheets.
  - Cards tinted red or amber using the same `getJobCardBackground` helper for consistency.

- **Logistics (`logistics`):**
  - Rows display:
    - ISO date + HH:mm
    - Bold Spanish day name (e.g. `LUNES`, `MARTES`, `MIÉRCOLES`).
    - Transport icon chosen from `transport_type`:
      - Trailer/9m/8m/6m/4m → 🚛
      - `furgoneta`/van → 🚐
      - `rv` → 🏕️
      - Plane → ✈️
      - Train → 🚆
      - Fallback → 🚚
    - Icon faces left for `load` events and is mirrored (CSS `scaleX(-1)`) for `unload`.
  - Card background tinted from `logistics_events.color`.

- **Calendar (`calendar`):**
  - Month‑view grid with:
    - Day number, count badge, and highlight ring/blue ring for today + highlight jobs.
  - For each day:
    - Uses `jobsByDate` built by spanning multi‑day jobs over all days in the visible window.
    - `CalendarCellJobsList` shows up to 3 jobs at a time per cell; if more, rotates through slices every 5s.
    - Job chips are tinted by `job.color`, show status dot, time, departments, and a small date‑type icon in a square on the right for tourdates.
  - Auto‑scrolls the whole calendar panel vertically via `AutoScrollWrapper`.

- **Ticker + Footer logo:**
  - Ticker polls `announcements` and scrolls horizontally; height is measured to keep main content from being covered.
  - `FooterLogo` now uses:
    - Primary: Supabase storage `public logos/sectorpro.png`.
    - Fallbacks: `/sector pro logo.png`, `/icon.png`.

---

## 4. Presets & the `produccion` Stub

### 4.1. `wallboard_presets` table

- Defined in `20260215010000_add_wallboard_presets.sql`.
- Fields:
  - `slug`, `name`, `description`, `panel_order`, `panel_durations` (JSON),
    `rotation_fallback_seconds`, `highlight_ttl_seconds`, `ticker_poll_interval_seconds`, `created_at`, `updated_at`.
- RLS:
  - `wb_presets_select` – select allowed for `admin/management/wallboard`.
  - `wb_presets_admin_write` – insert/update/delete restricted to `admin/management`.

### 4.2. Default behavior (no preset / unknown slug)

- For `slug = 'default'` or missing presets (non‑producción):
  - `panelOrder = ['overview','crew','logistics','pending','calendar']`
  - `panelDurations` all set to 12s, fallback 12s.
  - Highlight TTL, ticker polling, etc. from constants.
  - A short banner explains that the default preset is being used when a custom slug is missing.

### 4.3. Producción stub: calendar‑only wallboard

- When `presetSlug` resolves to `produccion` and there is **no** `wallboard_presets` row:
  - `panelOrder` is forced to `['calendar']`.
  - `panelDurations.calendar = 30`, `rotationFallbackSeconds = 30`.
  - A banner indicates:
    > `Wallboard de producción: solo calendario (configurable en Presets).`
  - No other panels are shown.
  - `CalendarPanel` uses a reduced scroll speed (`scrollSpeed={20}`) for a slower, smoother scroll suited for production view.
  - The global rotation effect is effectively disabled when there is only one panel and a single page:
    - The rotation `useEffect` short‑circuits if `activePanels.length === 1 && pageCount <= 1`, so there are no timer‑driven re‑renders.

If you later create a `wallboard_presets` row with `slug = 'produccion'`, the standard preset logic takes over and you can re‑configure panels as needed.

---

## 5. Session Summary (Changes Made)

During this session, we:

1. **Built robust auto‑scrolling**:
   - Replaced the initial debug‑heavy wrapper with a smooth RAF‑based scroller that supports up/down bouncing and uses a `resetKey` to avoid accidental resets during rotations.
2. **Fixed height issues**:
   - Measured ticker + footer heights to compute the inner viewport height so panels are never covered by the ticker or logo.
3. **Corrected calendar job placement**:
   - Jobs now appear on every calendar day they span, not just their start date.
4. **Improved wallboard RLS and clarified policies**:
   - Adjusted the locations policy to avoid enum casting issues and documented the existing wallboard RLS migrations.
5. **Localized & cleaned up UI**:
   - Timesheet status badges translated to Spanish; hidden for tourdates.
   - Job type + date span badges added to jobs and crew panels.
   - Tinted cards based on `jobs.color` and `logistics_events.color`.
   - Added date‑type icons (show/rehearsal/travel/setup/off) reused across overview, crew, docs, and calendar cells.
6. **Refined logistics visuals**:
   - Transport icons now reflect `transport_type`, and the vehicle is mirrored for `load` vs `unload` instead of using a separate arrow.
   - Spanish weekday labels added under logistics dates.
7. **Added Producción calendar stub**:
   - `presetSlug = 'produccion'` now yields a calendar‑only wallboard with slower scroll and no rotation until a real preset is created.
8. **Updated branding**:
   - Footer logo now points to `sectorpro.png` (black text variant) from the public Supabase bucket with a local fallback.

---

## 6. PR Notes / How to Ship

When you’re ready to open a PR:

1. **Review & test locally**
   - Run: `npm run dev` and exercise:
     - `/wallboard` with `presetSlug=default`.
     - Wallboard as the dedicated `wallboard` user.
     - `/wallboard/produccion` slug to confirm calendar‑only behavior and slow scroll.
2. **Ensure migrations are applied**
   - Confirm that the wallboard RLS migrations listed above are applied to your Supabase instance.
   - If you adjusted policies manually in SQL, consider codifying them into new migrations.
3. **Commit and push**
   - Follow the repo workflow (from `agents.md`):
     ```bash
     git checkout dev
     git add src/pages/Wallboard.tsx WALLBOARD_STATUS.md supabase/migrations/*
     git commit -m "feat(wallboard): enhance calendar, logistics and producción preset"
     git push origin dev
     ```
4. **Open PR**
   - Target `main` from `dev`.
   - Link to this `WALLBOARD_STATUS.md` in the PR description as the implementation notes.

This file should serve as a living reference for future work on the wallboard, presets, and the dedicated production display. 

