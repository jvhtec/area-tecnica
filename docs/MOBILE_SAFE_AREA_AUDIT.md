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

These were non-compliant at the primitive level, so **every consumer inherited the bug**. **Status: all items in this tier are fixed on this branch** — fixing them resolved dozens of screens at once.

| File | Line | Original issue (now fixed) |
|---|---|---|
| `src/components/ui/sheet.tsx` | 38 | `side="bottom"` variant was `inset-x-0 bottom-0` with no `pb-safe` — content sat under the home indicator. Top/left/right variants likewise had no inset handling. Each edge-touching side now carries `max(1.5rem, env(...))` padding. |
| `src/components/ui/drawer.tsx` | 44 | `DrawerContent` (vaul bottom sheet) was `fixed inset-x-0 bottom-0` with no bottom inset padding. Now has `pb-[max(0px,env(safe-area-inset-bottom))]`. |
| `src/components/ui/toast.tsx` | 17 | `ToastViewport` was `fixed top-0 ... p-4` on mobile — toasts rendered under the notch/Dynamic Island; desktop `sm:bottom-0` lacked bottom inset. Both edges now inset-aware; the sonner toaster also gained safe-area `offset`/`mobileOffset`. |
| `src/components/ui/dialog.tsx` + `alert-dialog.tsx` | — | `DialogContent`/`AlertDialogContent` capped height at plain `90vh` (or not at all), letting tall dialogs extend into the insets. Both now cap at `calc(90dvh − env(top) − env(bottom))` with `overflow-y-auto`, keeping content scrollable and clear of notch and home indicator. |
| `src/components/ui/sidebar/sidebar-components.tsx` | 53, 68, 99 | Diverged from `src/components/ui/sidebar.tsx` (fully compliant): header/footer had no inset padding, content had `pt-safe` but no `pb-safe`. Now reconciled with `sidebar.tsx`. |

Not affected (auto-positioned floating elements, no fixed edges): `popover.tsx`, `dropdown-menu.tsx`, `select.tsx`.

## Tier 2 — Custom full-screen modals bypassing the convention

These hand-rolled `fixed inset-0` overlays bypassed the technician-modal pattern. **Status: all items in this tier are fixed on this branch** — full-screen views pad their root with `env()` insets, centered modal overlays use the technician pattern, and `MobileArtistList`'s bottom sheet was resolved by the Phase 1 `SheetContent` fix.

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

**Status: fixed on this branch**, except `DashboardMobileHub` — on re-verification its `pb-24` is internal spacing inside Layout's already nav-padded main (`pb-[calc(4.5rem+env(...))]`), not a clipping bug, so it was left as is. The MobileAvailabilityView FAB and SysCalc's mobile tip (same bug class, found during the fix) are now offset above the mobile nav (`calc(4.5rem + env(safe-area-inset-bottom) + gap)`).

| File | Line | Issue |
|---|---|---|
| `src/components/ui/connection-status.tsx` | 123 | `fixed bottom-4 right-4` — hidden behind home indicator. |
| `src/components/achievements/AchievementBanner.tsx` | 24 | `fixed inset-x-0 top-0 ... pt-4` — banner under the notch. |
| `src/components/disponibilidad/MobileAvailabilityView.tsx` | 305 | FAB at `fixed bottom-6 right-6` — collides with mobile nav + home indicator. |
| `src/components/dashboard/DashboardMobileHub.tsx` | 227 | Hard-coded `pb-24` to clear the mobile nav, no `env(safe-area-inset-bottom)` term. |

## Tier 4 — Page-level viewport-height bugs

`h-screen`/`100vh` on iOS includes area under browser chrome and ignores insets; the codebase standard elsewhere is `min-h-screen` or `h-svh` (see `sidebar.tsx`). **Status: fixed on this branch** — `h-screen` roots moved to `h-dvh`, `100vh` calcs to `100dvh` (the SoundVision map page additionally subtracts `env(safe-area-inset-top)` since Layout's header grows with the inset), and the Auth page gained inset-aware vertical padding on both variants.

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

**Phase 1 — primitives (✅ done on this branch).** Per-side inset handling added to `sheet.tsx`, `drawer.tsx`, the `toast.tsx` viewport, and the sonner toaster; dialog/alert-dialog max-heights are inset-aware; `sidebar/sidebar-components.tsx` reconciled with `sidebar.tsx`. Note: `SheetContent` applies insets as inline styles so consumer `className` padding utilities cannot silently strip them; consumers that handle insets themselves (e.g. full-bleed layouts with a safe-padded inner element) opt out explicitly via the `style` prop.

**Phase 2 — custom full-screen modals (✅ done on this branch).** The technician-modal pattern applied to all Tier 2 surfaces; `ArtistManagementDialog` also moved from `100vh` to `dvh`, and `EnhancedJobDetailsModal`'s inner panel from `h-[90vh]` to `h-[90dvh] max-h-full`. A shared `FullScreenOverlay` wrapper remains a good future refactor so the pattern can't drift again.

**Phase 3 — fixed elements + viewport heights (✅ done on this branch).** Tier 3 floats got `calc(... + env(safe-area-inset-bottom/top))` offsets; Tier 4 pages moved from `h-screen`/`100vh` to `h-dvh`/`100dvh` with inset terms where Layout chrome height varies; Auth page padded for both insets.

**Phase 4 — standardization.**
- Introduce a shared `--mobile-nav-height: 4.5rem` CSS var and replace all four hard-coded nav-height assumptions.
- Pick ONE dialect (recommend the existing CSS utilities `.pt-safe-*`/`.pb-safe-*`, extending them as needed) and update `docs/mobile-guidelines.md` to deprecate the others.
- Remove the redundant double padding in `Sound.tsx`.
- Optionally add a lint/grep CI check flagging new `h-screen`, `100vh`, `fixed bottom-0`/`top-0` without an `env(safe-area-inset-*)` term.
