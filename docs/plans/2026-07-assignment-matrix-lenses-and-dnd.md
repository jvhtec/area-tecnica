# Assignment Matrix: Coverage Heatmap, Workload & Cost Lenses, Drag-and-Drop

**Status**: Proposed
**Date**: 2026-07-11
**Scope**: Four extensions to the Job Assignment Matrix (`src/pages/JobAssignmentMatrix.tsx`, `src/components/matrix/`):

- **A. Coverage heatmap header** — per-date, per-department demand (needed vs filled) rendered above the grid.
- **B. Workload & fairness lens** — consecutive-day streaks, trailing workload, and fair-distribution signals per technician.
- **C. Cost lens** — projected/approved cost overlaid on cells, rows, dates, and jobs (management only).
- **D. Drag-and-drop assignment** — move an assignment between technicians; drag a job onto a cell to assign.

A, B and C are "lenses": alternative read-only visual layers over the same grid. D is an interaction change. A shared lens foundation (Phase 0) is built first; D is independent and can be developed in parallel.

---

## 1. Architectural context (verified against current code)

Facts the plan builds on — all confirmed in the codebase as of this writing:

| Fact | Where |
|------|-------|
| Matrix cells are **timesheet-row-backed** (timesheets = source of truth for scheduling), joined with `job_assignments` metadata | `src/hooks/useOptimizedMatrixData.ts` (`fetchMatrixTimesheetAssignments`) |
| The grid is a **hand-rolled virtualized grid**: `translate3d`-positioned rows/cells, three synced scroll containers, `visibleRows`/`visibleCols` windows | `optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx`, `useMatrixScrollState.ts` |
| `HEADER_HEIGHT`, `CELL_WIDTH`, `CELL_HEIGHT` are props/constants used by scroll math — layout changes must go through them | `OptimizedAssignmentMatrix.tsx:91-94` |
| Per-job staffing/cost rollups already reach the client: `assigned_count`, `worked_count`, `total_cost_eur`, `approved_cost_eur` are merged into every `MatrixJob` via the `get_job_staffing_summary` RPC (materialized view `v_job_staffing_summary`) | `useOptimizedMatrixData.ts:144,181-193` |
| Per-department demand exists: `job_required_roles_summary` view (`job_id`, `department`, `total_required`, `roles` jsonb) | `00000000000000_production_schema.sql:6050` |
| `DateHeader` already computes an "open slots" figure — but with **N+1 `useQuery`s per visible header** (`matrix-open-slots`, `matrix-date-confirmed-count`, plus per-job engagement counts) | `src/components/matrix/DateHeader.tsx` |
| `timesheets` carries `amount_eur` (server-computed via `compute_timesheet_hours()` / `recalc-timesheet-amount`), `amount_breakdown`, `status`, `start_time`, `end_time`, `break_minutes`, `overtime_hours` — **exactly cell grain** (tech × date) | production schema `timesheets` table |
| Year-scoped timesheet counts per technician are already fetched (twice: current + last year) for the medal system | `useMatrixTechnicianOrdering.ts` (`get_active_timesheet_counts_by_technician` RPC) |
| Assignment creation inserts into `job_assignments`; timesheets are auto-generated/cascaded server-side (documented invariant) | `AssignJobDialog.tsx:469`, CLAUDE.md "Assignment System" |
| Assignment removal flow exists | `optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts` |
| Conflict pre-check utility exists and is already used before staffing sends | `checkTimeConflictEnhanced` in `src/utils/technicianAvailability.ts` |
| Role/permission gating: `isManagementRole(userRole)`, `allowDirectAssign` UI toggle, fridge blocking, `declinedJobsByTech` | `OptimizedAssignmentMatrix.tsx` |
| Page-level toolbar where new controls belong | `src/pages/job-assignment-matrix/MatrixPageControls.tsx` |
| The staffing orchestrator can be opened targeted at a job+department (`staffingOrchestratorTarget`) | `JobAssignmentMatrix.tsx:57` |

**Governance constraints**: file-size budget blocks new/grown god files — all new logic goes in new files under `src/components/matrix/lenses/` and `src/hooks/matrix/`. UI strings in Spanish (run `/i18n-check`). No new heavy dependencies (drag-and-drop is implemented with native pointer/HTML5 events, not `@dnd-kit`).

---

## 2. Phase 0 — Shared lens foundation

Small, boring, and required by A/B/C.

### 2.1 Lens state

```
src/components/matrix/lenses/types.ts
```

```ts
export type MatrixLens = 'default' | 'coverage' | 'workload' | 'cost';
```

- State lives in `JobAssignmentMatrix.tsx` (`useState<MatrixLens>`), persisted per user in `localStorage` (`matrix-lens-preference`), passed down through `OptimizedAssignmentMatrix` → view.
- Toggle UI: a segmented control in `MatrixPageControls.tsx` (icons + Spanish labels: *Normal*, *Cobertura*, *Carga*, *Coste*). The *Coste* option renders only for `isManagementRole(userRole)`.
- `coverage` is both a lens (cell tinting optional, v2) **and** an always-available header row — see A. For v1, selecting the coverage lens simply shows/hides the heatmap row.

### 2.2 Cell overlay contract (performance-critical)

`OptimizedMatrixCell` is memoized and must stay that way. Lenses never pass new object/closure props per render. Instead:

- Each lens hook produces **stable `Map`s keyed by `${technicianId}-${dateKey}`** (same key format the matrix already uses) at the container level.
- The view resolves the per-cell value *outside* the cell (like `staffingMaps` already does at `OptimizedAssignmentMatrixView.tsx:342-348`) and passes **primitives** down: e.g. `overlayAmount?: number`, `overlayStreak?: number`, `overlayTone?: 'ok' | 'warn' | 'high'`.
- A single new optional prop cluster on `OptimizedMatrixCell` renders a small corner badge / background tint. Rendering lives in a new `lenses/CellLensBadge.tsx` so the cell file doesn't grow past budget.

### 2.3 Lens data hooks are lazy

Each lens hook takes `enabled: lens === 'x'` so inactive lenses cost zero queries. All use `queryKeys.scope(...)` factories per repo convention.

**Deliverable**: `MatrixLens` plumbing, toolbar control, no-op default lens. ~1 short PR-sized commit inside PR 1.

---

## 3. Feature A — Coverage heatmap header (idea #3)

**Goal**: answer "where am I short?" at a glance: one row of per-date coverage chips between the date headers and the grid, colored by fill ratio, with per-department drill-down and a one-click path into the staffing orchestrator.

### 3.1 Data

New hook `src/hooks/matrix/useMatrixCoverage.ts`:

1. Inputs: `jobs` (already windowed by the page), `dates`, `enabled`.
2. Two batched queries for **all** job ids in the window (chunked at 100, same pattern as `fetchMatrixTimesheetAssignments`):
   - `job_required_roles_summary` → `job_id`, `department`, `total_required`, `roles`.
   - `job_assignments` filtered to those jobs → count filled roles per job/department (`sound_role`/`lights_role`/`video_role` non-null), intersected with scheduled techs from the timesheet rows the matrix already holds (`allAssignments`) — no third query needed.
3. Output maps:
   - `coverageByDateDept: Map<dateKey, Map<Department, { required: number; filled: number }>>` (a job contributes to every date it spans, using the existing `getJobsForDate` bucketing).
   - `coverageByJob: Map<jobId, Map<Department, { required, filled, roles }>>` for the drill-down popover.
4. `staleTime` 30s; invalidated by the existing `assignment-updated` event and `job_assignments` realtime subscription (piggyback on `invalidateAssignmentQueries` — add the new query key scope there).

### 3.2 Rendering

New `src/components/matrix/lenses/CoverageHeatmapRow.tsx`:

- A horizontally-scrolling row synced with the date headers (rendered inside the existing `matrix-date-headers` scroll container, below the `DateHeader` strip). **`HEADER_HEIGHT` grows by a fixed `COVERAGE_ROW_HEIGHT` (28px) when the row is visible** — pass the adjusted value from `OptimizedAssignmentMatrix` so `useMatrixScrollState` math stays consistent; no other scroll changes needed.
- Per date: one chip per department with demand that day (max 3 visible + "+n" overflow), text `filled/required`, background on a 3-step scale:
  - complete (`filled >= required`) → muted green
  - partial → amber
  - `filled == 0` with demand → red
  - no demand → empty cell
- Colors via Tailwind semantic classes consistent with existing badge styles; dark-mode variants included.
- Click chip → `Popover` listing each job on that date for that department: required roles breakdown (`roles` jsonb), filled count, and a button **«Abrir staffing»** wired to the existing `setStaffingOrchestratorTarget({ jobId, department, jobTitle })`.
- Virtualization: reuse `visibleCols` slicing exactly like `DateHeader` mapping does.

### 3.3 Refactor (piggyback, keeps net query count down)

`DateHeader`'s three ad-hoc hooks (`useJobEngagementCounts`, open-slots query, `useDateConfirmedCount`) issue N+1 queries per visible header. Once `useMatrixCoverage` exists:

- Replace the **open-slots** query with the shared coverage map (prop-drilled per date, primitives only).
- Leave engagement counts (invitations/offers) as-is for v1 — they come from a different source (`staffing_requests`) and are popover-lazy anyway.

### 3.4 Tests

- Unit: coverage aggregation (multi-day jobs spanning dates, jobs with zero requirements, department bucketing) in `src/hooks/matrix/__tests__/useMatrixCoverage.test.ts` (pure aggregation function extracted for testability).
- Component: `CoverageHeatmapRow` renders chips/colors from a fixture map; popover opens orchestrator callback.
- E2E smoke: extend `tests/e2e` matrix spec with mocked `job_required_roles_summary` table via `bootstrapApp`.

**Estimate**: ~3–4 days. No migration needed (v1 is two batched reads of existing views/tables). Optional later optimization: a `get_matrix_coverage(p_job_ids)` RPC collapsing to one round trip.

---

## 4. Feature B — Workload & fairness lens (idea #5)

**Goal**: make overload visible before it happens — streaks, trailing load, and fair distribution — and warn (non-blocking) at assignment time.

### 4.1 Data

New hook `src/hooks/matrix/useMatrixWorkload.ts` (enabled when lens active **or** when an assign dialog is open, so warnings work without the lens):

1. Query `timesheets` for the window technicians over `[windowStart − 21 días, windowEnd]` selecting `technician_id, date` only (`is_active = true`; include schedule-only rows — a scheduled day is load). Chunked `.in()` batches like existing code. The 21-day lookback is what makes streak computation correct at the left edge of the window.
2. Pure computation (new `src/components/matrix/lenses/workload.ts`, fully unit-testable):
   - `streakEndingAt(techId, date)` — consecutive worked/scheduled days ending at `date`.
   - `daysInTrailing7(techId, date)`.
   - `daysInMonth(techId, monthOfWindow)`.
   - Thresholds as named constants: `STREAK_WARN = 6`, `STREAK_HIGH = 10`, `TRAILING7_WARN = 6` (single place to tune; per-company config is v2).
3. Fairness reuses data that already exists: `techConfirmedCounts` (year counts per tech + department) from `useMatrixTechnicianOrdering` — lift the fetch into a shared hook `useTechnicianYearCounts` consumed by both, and compute department percentile per tech.

### 4.2 Rendering

- **Cells** (workload lens active): background tint intensity by that day's streak value (3 steps: none / `warn` amber / `high` red-tinted), tiny streak number badge on assigned cells (`CellLensBadge`).
- **Technician column**: under the lens, `TechnicianRow` shows a compact line: `«↯ 5 días seguidos · 14 este mes»` plus a percentile bar (e.g. 4px wide vertical bar) for year-to-date jobs vs department median — the fairness signal. Rendered by `lenses/TechnicianWorkloadSummary.tsx` to keep `TechnicianRow` small.
- **New sort option**: add `workload-desc` to `TechSortMethod` cycle (most-loaded first) — trivial once maps exist.

### 4.3 Assignment-time warnings (works in any lens)

- In `AssignJobDialog` confirm step and in the staffing offer send path (`handleStaffingActionSelected`), consult the workload map: if the prospective assignment would extend a streak past `STREAK_WARN`, show a warning line in the dialog (not a blocker): *«Con esta asignación, {nombre} llevaría {n} días seguidos trabajando.»*
- No schema changes, no server logic; purely advisory. Blocking rules (if ever wanted) are a policy decision for later.

### 4.4 Tests

- Unit: streak/trailing math (edge cases: gaps, lookback boundary, month boundaries, overnight `ends_next_day` irrelevant at date grain) — this is the bulk of the test value.
- Component: `TechnicianWorkloadSummary` fixture render; dialog warning appears at threshold.

**Estimate**: ~3 days. No migrations.

---

## 5. Feature C — Cost lens (idea #6)

**Goal**: "money mode" for management — what does this week/job/person cost, directly in the grid.

### 5.1 Data

Cheapest possible: the matrix already fetches the exact rows needed.

- Extend the select in `fetchMatrixTimesheetAssignments` (`useOptimizedMatrixData.ts:130`) with `amount_eur, status` — two cheap columns, avoids a parallel query and a second invalidation surface. RLS already governs who can read amounts; the UI additionally gates the lens by `isManagementRole`.
- Job-level totals need **zero work**: `total_cost_eur` / `approved_cost_eur` are already on every `MatrixJob`.
- Derived maps in `src/components/matrix/lenses/cost.ts` (pure, from `allAssignments`):
  - `amountByCell: Map<techId-dateKey, { amount: number | null; approved: boolean }>`
  - `totalByTech`, `totalByDate`, `windowTotal`, and `missingRateCountByTech` (cells with an active timesheet but `amount_eur == null`).

### 5.2 Rendering (lens = `cost`, management only)

- **Cells**: compact amount badge (`120 €`) via `CellLensBadge`; approved amounts solid, pending amounts outlined; `amount_eur == null` renders `—` with an amber dot (missing rate — an actionable signal, not noise).
- **Technician column**: window total per tech + `«{n} sin tarifa»` count when > 0.
- **Date header strip**: per-date total under the date (reuses the coverage row slot pattern — same `COVERAGE_ROW_HEIGHT` mechanism; coverage row and cost row are mutually exclusive since lenses are exclusive).
- **Corner cell**: window grand total (visible technicians × visible window), labeled *«Total ventana»* to avoid implying it's the full company spend.
- **DateHeader popover**: job rows gain `total_cost_eur` / `approved_cost_eur` (data already present on the job object).
- Number formatting: `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })` in one shared helper.

### 5.3 Cautions

- **Do not** color-scale cost red/green (cost is not bad/good); neutral badges only.
- Materialized-view staleness: `v_job_staffing_summary` job totals may lag cell sums slightly; the popover shows both sources — label the job figure *«total del trabajo»* and cell-derived figures *«en ventana»* so the mismatch is explicable rather than a bug report.
- Technicians/HR sensitivity: lens is management-gated; additionally respect the existing `hideStaffingEmailButtons`-style per-user preference pattern if managers ask to keep it off by default (default lens is always `default`).

### 5.4 Tests

- Unit: cost map derivation incl. null amounts, schedule-only exclusion (`is_schedule_only` rows carry no cost), approved vs pending split.
- Component: gate — non-management never sees the lens option (assert via `mockOptimizedAuth`).

**Estimate**: ~2 days. No migrations.

---

## 6. Feature D — Drag-and-drop assignment (idea #7)

**Goal**: spreadsheet-grade ergonomics for the most common correction: *this person can't do it, that person can*.

### 6.1 Scope (deliberately bounded v1)

| In v1 | Out (v2+) |
|-------|-----------|
| Drag an **assigned cell** → another technician's **empty cell on the same date** = move the assignment | Cross-date drags (ambiguous with multi-day jobs) |
| Drag a **job chip** from the `DateHeader` popover → a cell = open `AssignJobDialog` pre-filled with that job/tech/date | Swap between two occupied cells |
| Desktop only, `allowDirectAssign` on + management role | Touch/mobile DnD |
| Conflict pre-check + confirm dialog before commit | Multi-cell drag |

Restricting v1 moves to **same-date** turns the whole multi-day-job/timesheet-cascade problem into a single well-defined operation and still covers the dominant use case.

### 6.2 Mechanics

Native HTML5 drag events — no new dependency, works inside the custom scroll containers:

- New `src/components/matrix/dnd/useMatrixDrag.ts` holding drag state in a ref + a tiny Zustand-free reducer (`dragging: { jobId, fromTechId, dateKey, roles } | null`).
- `OptimizedMatrixCell` gains `draggable` when: assignment exists, same-day cell, DnD enabled. `onDragStart` sets `dataTransfer` payload + a drag image (job title chip).
- Drop targets: cells on the **same `dateKey`** compute validity from data already at the view level: target must have no assignment, tech not in `fridgeSet`, job not in `declinedJobsByTech`, availability cell not `unavailable`. Valid target → green ring; invalid → red ring + `dropEffect = 'none'`. Validity resolution happens in the view (primitives passed down), preserving cell memoization.
- Edge auto-scroll: on `dragover` near the main scroll container's edges, nudge `scrollLeft/Top` (small helper in `useMatrixDrag`; the three-pane sync already flows through existing scroll handlers).

### 6.3 The move mutation

New `src/components/matrix/dnd/useMoveAssignment.ts`:

1. `checkTimeConflictEnhanced(targetTechId, jobId, { targetDateIso, includePending: true })` — hard conflict → reuse the existing conflict dialog pattern (`conflictDialog` state) with an override option, mirroring the staffing email flow.
2. Confirmation dialog (Spanish): *«¿Mover la asignación de {jobTitle} de {origen} a {destino}?»* — with the workload warning from Feature B when applicable.
3. Commit = **delete + insert, in that order, via existing paths**: reuse the removal logic from `useMatrixCellAssignmentRemoval` (which respects the documented cascade: removing the assignment removes its timesheets) then insert a `job_assignments` row copying `sound_role`/`lights_role`/`video_role`/`status` from the source (server side regenerates timesheets — same invariant as `AssignJobDialog`). **Do not** hand-write timesheet rows; the assignment cascade is one of the five documented "don't bypass" invariants.
4. Optimistic update via existing `updateAssignmentOptimistically` + full `invalidateAssignmentQueries()` on settle; dispatch `assignment-updated` for other listeners. On insert failure after successful delete, surface a destructive toast telling the user the source assignment was removed and retry the insert once — and log; this is the one non-atomic seam (an RPC `move_job_assignment` wrapping both in a transaction is the v2 hardening, and would need a migration + pgTAP coverage).

### 6.4 Job-chip drag (cheap second entry point)

`JobRowWithCounts` in `DateHeader.tsx` becomes `draggable`; dropping on any cell (any date within the job span) opens the existing `AssignJobDialog` with job/tech pre-selected — no new mutation logic at all, full dialog validation preserved.

### 6.5 Tests

- Unit: drop-validity predicate (fridge/declined/occupied/unavailable/date-mismatch matrix of cases).
- Component: drag start sets payload; invalid target shows blocked state; move calls removal-then-insert in order (mocked supabase).
- E2E: Playwright drag simulation on the mock-auth harness for the happy path (`page.dragAndDrop`), desktop project only.
- Manual `/ui-check` pass; verify `/critical-invariant-check` (assignment cascade) before PR.

**Estimate**: ~4–5 days (validity + mutation are quick; polish, auto-scroll, and tests are the bulk).

---

## 7. Sequencing & PR breakdown

| PR | Contents | Depends on | Size |
|----|----------|------------|------|
| **PR 1** | Phase 0 lens infra + Feature A (coverage heatmap + DateHeader open-slots refactor) | — | M |
| **PR 2** | Feature B (workload lens + assignment-time warnings + shared year-counts hook refactor) | PR 1 | M |
| **PR 3** | Feature C (cost lens) | PR 1 | S |
| **PR 4** | Feature D (drag-and-drop, both entry points) | — (parallelizable; dialog warning integration touches PR 2's map but degrades gracefully) | M–L |

Each PR: branch from latest `main`, conventional commits (`feat: …`), `/i18n-check` on changed files, `npm run governance` before push (file-size budget matters here — hence the new-file layout under `lenses/` and `dnd/`), `npm run test:critical` + full run, `/ui-check` for visual verification at desktop + mobile viewports (lenses must at minimum not break mobile; DnD explicitly disabled there).

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Cell re-render storms from lens props | Maps resolved at view level; only primitives cross the `OptimizedMatrixCell` memo boundary (§2.2) |
| Header height change breaks scroll-sync math | Height always flows through the `HEADER_HEIGHT` prop; add a `useMatrixScrollState` test with the taller value |
| Coverage double-counting on multi-day jobs | A job's requirement counts once per date it spans by design (per-date view is "what's open *that day*"); unit-tested explicitly |
| `amount_eur` exposure | RLS is the real gate; UI gate is `isManagementRole`; no amounts ever placed in query keys or logs |
| Non-atomic move (delete+insert) | Ordered ops through existing invariant-respecting paths, retry + loud failure toast; RPC transaction as v2 hardening |
| N+1 regressions in headers | Feature A explicitly *removes* one of the existing N+1 patterns; engagement counts stay popover-lazy |
| Mat. view staleness confusing cost totals | Distinct labels for job-total vs window-derived figures (§5.3) |

## 9. Explicitly out of scope (this plan)

- Auto-plan/solver mode (matrix idea #1) and scenario/draft layer (#2) — separate plans; the lens infra here is a prerequisite they'll reuse.
- Sub-day timeline zoom (#4).
- Per-company configurable workload thresholds; blocking (vs advisory) overload rules.
- Touch drag-and-drop.
