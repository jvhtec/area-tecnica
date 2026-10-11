# Assignment Matrix UX overhaul roadmap

**Date:** 2026-10-04  
**Status:** approved (all decisions in §6 accepted as recommended)  
**Depends on:** PR #994 (atomic assignment commands), including its two open security findings  
**Baseline read:** `feat/matrix-hardening-commands@14d67f3`  
**Scope:** manual Matrix work: assign, modify, move, remove, confirm/decline, unavailability, manual availability/offer requests  
**Out of scope:** Carlos / campaign UX, tour cascade (as in `MATRIX_HARDENING_ROADMAP_2026-10-03.md` §10)

This is phase H ("UX simplification") of the hardening roadmap, made concrete.
Interactive mocks and the before/after comparison were reviewed in the approval
artifact; this document is the reference for implementation.

## 1. Problem

Nearly every Matrix action opens a dialog, and several open two:

| Task | Today | Dialogs |
| --- | --- | --- |
| Assign one technician, whole job, invited | 7 clicks | 2 (+ conflict alert) |
| Staff 6 technicians on a 3-day job | ≈37 clicks | 12 |
| Confirm an invited assignment | 2 clicks | 1 |
| Ask availability (email) | 4–5 clicks | 2 |
| Send an offer | 6 clicks | 2 |
| Remove one day of a multi-day job | 3 clicks | 1 |

Root causes, traced in code:

1. **Hidden modes decide what a click does.** With "Asignación directa" off (the default on every load) a cell click does nothing; "No disponible" mode turns a click into a write; the Email/WhatsApp chips decide which icons exist (`MatrixPageControls.tsx`, `OptimizedMatrixCell.handleCellClick`).
2. **Context is asked for again on every action.** Each flow re-asks job, then role, then coverage, even with one job that day and open slots that imply the role (`job_required_roles_summary` is only loaded for the staffing reminder).
3. **Dialogs chain into dialogs.** `SelectJobDialog → AssignJobDialog → AlertDialog`; `StaffingJobSelectionDialog → availability dialog | OfferDetailsDialog`. Eleven dialog surfaces sit on the grid.
4. **Confirmation dialogs stand in for undo.** Old browser-side writes were not atomic, so everything asked first. #994 removes that reason.
5. **No batch path.** Multi-select exists only for Stream Deck and the phone sheet.
6. **Coverage takes five controls** (three tabs, Añadir/Reemplazar, calendar) to say "which days of this job".

## 2. Principles

- **Act in place.** One shared inspector anchored to the cell (bottom sheet on phones) replaces the dialogs. Never modal, never chained, closes with Esc.
- **Set context once.** Job focus fixes the job for the session; a cell click then assigns with the next open matching role.
- **The server decides.** No client conflict preflight before writes. `conflict`, `stale_state` and `approved_timesheet` rejections render inline next to their fix (Forzar, Solo días libres, Recargar).
- **Undo for reversible changes, inline confirm for destructive ones.** Assign, add day, role change and confirm get an 8 s Deshacer, and their notifications wait until it expires. Decline and remove keep a two-step confirm inside the inspector (a tour decline hard-deletes; removal drops draft timesheets).
- **No modes.** Opening the inspector is harmless; permissions decide which actions it offers.
- **Keep the performance contract.** Inspector, selection and focus highlighting are single overlay layers; nothing new mounts per cell. The `matrix-performance` benchmark gates every phase.

## 3. Target interactions

### 3.1 Cell inspector (replaces SelectJob, AssignJob, AssignmentStatus, removal, retry/cancel dialogs)

- **Empty cell:** jobs that day (auto-selected if one) with open slots; role chips with the suggested role preselected; a day strip of the job's days (all on by default, "Solo este día" preset); `Asignar` (↵) and `Asignar confirmado` (⇧↵); a staffing entry; "Marcar no disponible" (N).
- **Assignment:** Confirmar (C) / Rechazar (X, inline confirm); role chips that apply immediately via `change_assignment_role` with Deshacer; day strip with "Guardar días" (one `apply_direct_assignment`, `mode: 'replace'`); "Mover a…" (one command with `fromJobId`); "Quitar este día" / "Quitar del trabajo" (inline confirm); who assigned and when, from the ledger.
- **Unavailable:** reason chips, remove unavailability.
- **Staffing in flight:** status, Reenviar (same channel), Cancelar, and "Enviar oferta" once availability is confirmed.
- **Rejections:** `conflict` lists the clashing days and offers Forzar (`conflictPolicy: 'allow'`) and "Solo días libres"; `stale_state` reloads the view and says so; `approved_timesheet` links to the timesheet. Fridge, declined-job and dry-hire rules render as disabled actions with the reason.

### 3.2 Job focus

Entry: job row in the date-header popover (today it only sorts), toolbar "Enfocar trabajo", `F`, or `?trabajo=<id>`. A job bar shows role slots (filled / invited / open, next slot highlighted), the default status for the session (Invitado, switchable to Confirmado) and Salir (Esc). The job's days are highlighted and others dimmed by one column overlay. The technician column shows fit (Libre 2/2, Ocupado mié, No disp., Rechazó, Nevera), sorted once on entry (rows never jump under the cursor). Clicking a cell assigns that day; clicking a name assigns every day of the job.

### 3.3 Selection and batch

Drag, shift-click or ctrl-click on desktop; long-press then tap on phones. Selection drawn as overlay rectangles. Action bar: Asignar a…, Confirmar, Pedir disponibilidad, Enviar oferta, No disponible, Quitar. One command per job/technician pair, three in flight, results panel per row with Forzar/Reintentar; one Deshacer for the batch when every change is reversible. `useSelectedCellStore` stays the Stream Deck source of truth.

### 3.4 Manual staffing requests

Intent first (Disponibilidad | Oferta), job and days prefilled, suggested role for offers, optional collapsed message, Email/WhatsApp remembered per user (replaces the four icons per empty cell and `useStaffingButtonPreferences`). Same `send-staffing-email` contract.

### 3.5 Keyboard

Arrow keys move an active-cell ring (one overlay, `aria-activedescendant` on the grid); ↵ opens the inspector; `C X N F Supr ?` confirm, decline, unavailable, focus, remove, help. All registered in `useShortcutStore` (category `matrix`) so Stream Deck can drive them.

## 4. Phases

Seven PRs, each deployable alone, behind a per-user flag until U6. All writes go through `@/features/assignments/commands`; nothing new writes `job_assignments`/`timesheets`, so `matrix-direct-write-guard` and the writer inventory keep passing. Old dialogs keep working until U6.

### U0 — Foundations (M, no UI change)

Client:
- `src/features/matrix-v2/useMatrixCommandRunner.ts`: wraps `applyDirectAssignment`, `setAssignmentStatus`, `changeAssignmentRole`, `removeAssignmentDate`, `removeDirectAssignment`; optimistic patch through `updateAssignmentOptimistically`, rollback on rejection, reconcile through `reconcileAssignmentViews`.
- Undo stack: inverse commands built from the command result (`added_dates`, previous role/status/dates). `runAssignmentSideEffects` is deferred 8 s and flushed early on `pagehide` or route change.
- `suggestRole(tech, job, slots, assignments)`: pure; first open slot in the technician's discipline, preferring their primary skill's position, then their last role on this job/tour.
- `useJobRoleSlots`, extracted from the outstanding-jobs logic in `JobAssignmentMatrix.tsx`.
- `useMatrixV2()` flag (localStorage + `?matriz=v2`), off by default.

Database (one migration + pgTAP, via `/new-migration`):
- Side-effect status `superseded` and `supersede_assignment_side_effects(p_command_id, p_by_command_id)` (admin/management, same claim-token rules), so an undone command's Flex calls and notifications never run and never reach the Reconciliación backlog.
- Command results carry a `previous` snapshot (role, status, dates) where not already present.
- New `source` values: `matrix.inspector`, `matrix.focus`, `matrix.batch`, `matrix.keyboard`, so `get_assignment_command_metrics` measures adoption.

Exit: runner unit tests (rollback, stale token, undo inside/after the window, `pagehide` flush); pgTAP for supersede authorization and claim tokens; benchmark baseline recorded.

### U1 — Cell inspector (L, behind flag)

- `MatrixCellInspector`: one shared instance anchored by `data-technician-id`/`data-date-key` (same pattern as `MatrixCellHoverTooltip`). Desktop: non-modal popover, `role="dialog"`, focus returns to the cell. Phone: `ResponsiveDialog` sheet replacing `MatrixMobileCellSheet`'s launcher list.
- Views: empty, assignment, unavailable, staffing in flight (§3.1).
- `AssignmentDayStrip`: `coverage: 'multi'` + `mode: 'replace'`, or `'full'` when every day is on.
- Inline rejection rendering for every `REJECTION_CODES` entry.
- Tests: component tests per view and per rejection code; Playwright (`bootstrapApp`) desktop + iPhone 13: assign, conflict → Forzar, confirm with undo, remove a day; `/i18n-check`.

Exit: assign (whole/single/confirmed), confirm, decline, remove day, role change, add day and move complete without a modal under the flag; benchmark unchanged.

### U2 — Modeless grid, keyboard, undo (M, behind flag)

- Click always opens the inspector; read-only users get a read-only inspector. Remove the "Asignación directa", "No disponible", Email and WhatsApp chips.
- Per-cell affordance is only the state's next action: `+` empty, `✓ ✕` invited, `⋯` otherwise. `MatrixCellStaffingActions` no longer renders (fewer nodes per empty cell).
- Keyboard model of §3.5; undo toast (sonner) with countdown naming the delayed notification.
- Long-press keeps multi-select; right-click opens the inspector on the unavailability view.

Exit: e2e keyboard-only assign + confirm; benchmark on par or better.

### U3 — Job focus (L, behind flag)

§3.2. State tokens from one `get_job_assignment_command_states` call per focused job. Fit sorting extends `useMatrixTechnicianOrdering`; the column overlay never re-renders cells. Dry-hire jobs cannot be focused.

Exit: 6-person, 3-day job staffed in ≤ 8 clicks in e2e; `useOptimizedMatrixData.stability.test.tsx` and benchmark green.

### U4 — Selection and batch (L, behind flag)

§3.3. Cells stop needing an `isSelected` prop (overlay), keeping memo hits. No batch RPC: per-pair atomicity is the invariant, partial success is shown per row and never rolls back other rows. Batch removal confirms the day/person count inline.

Exit: e2e with an injected conflict on one row (Forzar applies only that row); contention test of a batch against a concurrent single edit.

### U5 — Manual staffing requests (M, flag on for admin/management)

§3.4. Replaces `StaffingJobSelectionDialog`, `OfferDetailsDialog`, the availability `ResponsiveDialog` in `MatrixDialogs` and the retry/cancel dialogs. After merge the flag defaults on for admin/management with an opt-out in Ajustes for two weeks; watch `conflict`, `stale_state` and undo rates by `source`.

Exit: `staffingResend.integration.test.tsx` and staffing e2e updated and green; no staffing edge contract change.

### U6 — Removal and docs (M, flag removed)

Delete `SelectJobDialog`, `AssignJobDialog`(+`View`), `AssignmentStatusDialog`, `OptimizedMatrixCellDialogs`, `StaffingJobSelectionDialog`, `OfferDetailsDialog`, `MarkUnavailableDialog`, the availability/conflict dialogs in `MatrixDialogs`, the mode chips and `MatrixCellStaffingActions`; drop the client conflict preflight from the assign path (keep `checkTimeConflictEnhanced` only where it powers fit hints). Update `docs/workflows/job-assignment-matrix.md`, the Matrix section of `CLAUDE.md`, the writer allowlist and the file-size baseline.

Exit: two weeks flag-on without regressions; governance green with lower file-size numbers.

## 5. Guardrails (every phase)

- **Performance:** `MATRIX_PERF=1 PLAYWRIGHT_PRODUCTION=1 npx playwright test matrix-performance --project=chromium` before and after; scroll frame time within 5 % of the U0 baseline. No per-cell Radix components, `will-change` or `backdrop-filter`; new UI is a single overlay.
- **Both viewports:** every e2e at desktop and iPhone 13; locators via `isMobileViewport`.
- **Accessibility:** icon-only controls get an `aria-label` containing the visible text; the inspector returns focus to its cell; the grid is fully keyboard-operable.
- **Spanish only:** `/i18n-check` on new files, including toast and rejection copy.
- **Invariants:** writes only through #994 commands; conductors never touch staffing; fridge, declined-job, dry-hire and approved-timesheet rules shown as disabled actions with the reason, never bypassed.

## 6. Decisions (approved 2026-10-04)

| # | Decision | Outcome |
| --- | --- | --- |
| D1 | Default status for quick assignment | **Invitado**; the focus bar can switch to Confirmado for the session |
| D2 | Undo model | **8 s Deshacer with deferred notifications**; needs the U0 `supersede` RPC |
| D3 | "Asignación directa" toggle | **Removed**; permissions gate actions |
| D4 | Default days in the inspector | **Every day of the job** (matches today); "Solo este día" one click away |
| D5 | Rollout | **Per-user beta flag**, on by default for admin/management after U5; U6 deletes old code |
| D6 | Manual staffing requests | **Included** (U5); Carlos stays deferred |

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Misclicks in focus mode create assignments | Invitado default; notifications wait 8 s; Deshacer supersedes pending side effects |
| Tab closes during the undo window | Effects flush on `pagehide`; any that never run appear as unreported in the Reconciliación backlog with Reintentar |
| Overlays slow scrolling | Single overlay layers, benchmark gate per PR, stability test pins prop identity |
| Managers lose familiar flows | Flag with old and new side by side until U6, `?` shortcut sheet, Stream Deck parity via `useShortcutStore` |
| Undoing decline/removal loses data | Not offered; both keep inline two-step confirm |
| Batch partial failures confuse | Row-by-row results panel stays open until dismissed; Forzar/Reintentar per row |

## 8. Later, not in this plan

- Dragging an assignment bar to move it, or its edge to extend it (needs U3/U4 usage data).
- Cross-department slots in focus mode (sound, lights and video for one job).
- Carlos campaign controls inside the inspector, on the same commands.
