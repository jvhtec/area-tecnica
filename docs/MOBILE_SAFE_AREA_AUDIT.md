# Mobile Safe-Area Audit — June 2026

Deep audit of mobile safe-area handling across the app (Capacitor iOS/Android + PWA, `viewport-fit=cover` in `index.html`). Every finding below was verified against the source at the referenced line.

## Context: the established convention

The app already has good safe-area infrastructure:

- CSS vars `--safe-area-top/bottom/left/right` and utilities `.pt-safe`, `.pb-safe`, `.px-safe`, `.pt-safe-2/3/4`, `.pb-safe-2/3/4` (`src/index.css:94-98`, `350-365`)
- Tailwind spacing tokens `safe-top`, `safe-bottom`, `safe-*-2/3/4` (`tailwind.config.ts:51-68`)
- Guidelines in `docs/mobile-guidelines.md`
- A reference-quality pattern used by all `src/components/technician/` modals:
  `pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]`

The inconsistencies come from surfaces that predate or bypass this convention.

---

## Tier 1 — Base shadcn/ui primitives (systemic, highest leverage)

These are non-compliant at the primitive level, so **every consumer inherits the bug**. Fixing these resolves dozens of screens at once.

| File | Line | Issue |
|---|---|---|
| `src/components/ui/sheet.tsx` | 38 | `side="bottom"` variant is `inset-x-0 bottom-0` with no `pb-safe` — content sits under the home indicator. Top/left/right variants likewise have no inset handling. |
| `src/components/ui/drawer.tsx` | 44 | `DrawerContent` (vaul bottom sheet) is `fixed inset-x-0 bottom-0` with no bottom inset padding. |
| `src/components/ui/toast.tsx` | 17 | `ToastViewport` is `fixed top-0 ... p-4` on mobile — toasts render under the notch/Dynamic Island. Desktop `sm:bottom-0` lacks bottom inset. |
| `src/components/ui/dialog.tsx` | 15-53 | Centered `DialogContent` has no safe-area-aware max-height/padding; tall dialogs (`max-h-screen`, `h-[90vh]` consumers) can extend into insets. |
| `src/components/ui/alert-dialog.tsx` | 13-43 | Same pattern as dialog.tsx. |
| `src/components/ui/sidebar/sidebar-components.tsx` | 53, 68, 99 | Diverges from `src/components/ui/sidebar.tsx` (which is fully compliant at lines 207/363/382/416): header/footer have no inset padding, content has `pt-safe` but no `pb-safe`. Duplicate implementation drifting. |

Not affected (auto-positioned floating elements, no fixed edges): `popover.tsx`, `dropdown-menu.tsx`, `select.tsx`.

## Tier 2 — Custom full-screen modals bypassing the convention

These hand-rolled `fixed inset-0` overlays should use the technician-modal pattern but don't:

| File | Line | Surface |
|---|---|---|
| `src/components/festival/mobile/MobileArtistConfigEditor.tsx` | 621 | Full-screen mobile editor, `fixed inset-0` with no insets. |
| `src/components/festival/mobile/MobileArtistFormSheet.tsx` | 212, 271 | Both full-screen views (section detail + hub), no insets. |
| `src/components/festival/mobile/MobileArtistList.tsx` | 226 | `SheetContent side="bottom"` with `max-h-[85vh]`, no `pb-safe` (compounds the sheet.tsx primitive bug). |
| `src/components/festival/ArtistManagementDialog.tsx` | 70 | `DialogContent` forced to `h-[100vh] w-[100vw]` full-bleed — ignores both insets and iOS browser chrome. |
| `src/components/technician/ProfileView.tsx` | 594 | Password modal overlay, `p-4` only — footer buttons can sit under the home indicator. |
| `src/components/timesheet/TimesheetSidebar.tsx` | 133 | Full-height right sidebar on mobile, no top/bottom insets (also clips in landscape). |
| `src/components/department/EnhancedJobDetailsModal.tsx` | 400 | `fixed inset-0 ... p-4` with `h-[90vh]` inner panel, no insets. |
| `src/components/incident-reports/TechnicianIncidentReportDialog.tsx` | 245, 444 | Main dialog and signature modal, `p-2 sm:p-4` only. |

## Tier 3 — Fixed/floating elements missing insets

| File | Line | Issue |
|---|---|---|
| `src/components/ui/connection-status.tsx` | 123 | `fixed bottom-4 right-4` — hidden behind home indicator. |
| `src/components/achievements/AchievementBanner.tsx` | 24 | `fixed inset-x-0 top-0 ... pt-4` — banner under the notch. |
| `src/components/disponibilidad/MobileAvailabilityView.tsx` | 305 | FAB at `fixed bottom-6 right-6` — collides with mobile nav + home indicator. |
| `src/components/dashboard/DashboardMobileHub.tsx` | 227 | Hard-coded `pb-24` to clear the mobile nav, no `env(safe-area-inset-bottom)` term. |

## Tier 4 — Page-level viewport-height bugs

`h-screen`/`100vh` on iOS includes area under browser chrome and ignores insets; the codebase standard elsewhere is `min-h-screen` or `h-svh` (see `sidebar.tsx`).

| File | Line | Issue |
|---|---|---|
| `src/pages/JobAssignmentMatrix.tsx` | 624 | Root container `h-screen`. |
| `src/pages/StagePlot.tsx` | 252 | Root container `h-screen` (iframe loses vertical space). |
| `src/pages/SysCalc.tsx` | 35 | `h-[calc(100vh-73px)]` — hard-coded header height, no inset term, `vh` not `dvh`. |
| `src/pages/SoundVisionFiles.tsx` | 33, 102 | `h-[calc(100vh-6rem)]` / `h-[calc(100vh-4rem)]` — same problem. |
| `src/pages/Auth.tsx` | 194 | Public route: `min-h-screen ... py-8` with no top inset — form/header can crowd the notch on the native app. |

## Pattern inconsistencies (works, but three competing dialects)

1. **Arbitrary inline values** — `pt-[max(1rem,env(safe-area-inset-top))]` (technician modals, Layout, MobileNavBar). The de-facto standard; most common.
2. **CSS utilities** — `.pb-safe-3` etc. (TechnicianSuperApp). Defined in `index.css` but rarely used.
3. **Tailwind tokens** — `pb-safe-bottom` etc. Documented in `docs/mobile-guidelines.md` but barely used anywhere.

Plus point inconsistencies:

- `src/pages/Sound.tsx:253` applies **both** the `pt-safe` class and an inline `style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}` — redundant.
- **Mobile nav height is assumed in at least 4 places with 3 different values**: `Layout.tsx` content padding uses `4.5rem`, `MobileAvailabilityView.tsx:65` negative margin uses `4.5rem`, `PushNotificationMatrix.tsx:375` uses `4rem`, `DashboardMobileHub.tsx:227` uses `6rem` (`pb-24`). There is no shared constant/CSS var; the `4rem` and `6rem` ones are wrong or fragile.
- Hard-coded sticky offsets that ignore the safe-area-padded header height: `MobileAvailabilityView.tsx:142` (`top-[64px]`), `ModernHojaDeRuta.tsx:649/780/818` (`top-24`, `top-[68px]`).
- `SoundVisionInteractiveMap.tsx:1274-1289` uses raw CSS `env()` in a `<style>` tag — acceptable (Mapbox controls aren't React), but worth a comment.
- Landscape: only `SoundVisionInteractiveMap` handles `safe-area-inset-left/right`. `.pl-safe`/`.pr-safe`/`.px-safe` exist but are used nowhere — full-bleed surfaces (TimesheetSidebar, full-screen editors) will clip behind the notch in landscape.

## Verified compliant (reference implementations)

`Layout.tsx` (header 476, content 515), `MobileNavBar.tsx:104` (incl. visualViewport keyboard tracking), `MobileActionTray.tsx:62`, all `src/components/technician/` modals incl. `TourDetailView.tsx:161/207` and `TimesheetView.tsx`, `ui/sidebar.tsx`, `SoundVisionInteractiveMap.tsx`, `TechnicianSuperApp.tsx`, `ProjectManagement.tsx` sheet usage.

---

## Recommended fix plan

**Phase 1 — primitives (one PR, biggest win).** Add inset handling to `sheet.tsx` (per-side: `pb` for bottom, `pt` for top, `py` for left/right), `drawer.tsx`, `toast.tsx` viewport, and dialog/alert-dialog max-height (`max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]`-style). Reconcile `sidebar/sidebar-components.tsx` with `sidebar.tsx`.

**Phase 2 — custom full-screen modals.** Apply the technician-modal pattern to the eight Tier 2 surfaces. Consider extracting a shared `FullScreenOverlay` wrapper or a `safe-overlay` utility class so the pattern can't drift again.

**Phase 3 — fixed elements + viewport heights.** Tier 3 floats get `calc(... + env(safe-area-inset-bottom/top))` offsets; Tier 4 pages move from `h-screen`/`100vh` to `h-dvh`/`min-h-screen` with inset terms.

**Phase 4 — standardization.**
- Introduce a shared `--mobile-nav-height: 4.5rem` CSS var and replace all four hard-coded nav-height assumptions.
- Pick ONE dialect (recommend the existing CSS utilities `.pt-safe-*`/`.pb-safe-*`, extending them as needed) and update `docs/mobile-guidelines.md` to deprecate the others.
- Remove the redundant double padding in `Sound.tsx`.
- Optionally add a lint/grep CI check flagging new `h-screen`, `100vh`, `fixed bottom-0`/`top-0` without an `env(safe-area-inset-*)` term.
