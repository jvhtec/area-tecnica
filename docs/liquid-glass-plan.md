# Liquid Glass Mobile Integration Plan

## Vision
Deliver a cohesive "liquid glass" visual language across the mobile experience using [`liquid-glass-react`](https://github.com/rdev/liquid-glass-react) while maintaining performance, accessibility, and graceful degradation on lower-powered devices. The rollout will build shared primitives first and then layer the effect onto high-impact surfaces per feature area.

## Phase 0 – Technical Assessment (pre-work)
- [x] **Audit bundle impact**: install the package (`liquid-glass-react`) and record the size delta using `bunx vite-bundle-visualizer` or `pnpm dlx source-map-explorer` to validate acceptable overhead for mobile builds.
- [x] **Prototype sandbox**: create a Storybook or Vite sandbox page under `src/components/ui/devtools` to experiment with the component's props (`displacementScale`, `blurAmount`, etc.) and determine default tokens for dark/light backgrounds.
- [ ] **GPU performance check**: profile the effect on representative mobile hardware (iOS Safari, Android Chrome) to define acceptable defaults and fallback thresholds (e.g., disable below iPhone X / low-end Android via `prefers-reduced-motion` or device memory heuristics).

## Phase 1 – Foundation & Utilities
- [x] **Design tokens**: add Tailwind CSS variables in `tailwind.config.ts` and `src/index.css` for glass background, border, highlight, and motion intensity so visual updates remain centralized.
- [x] **Glass primitives**: create composable wrappers under `src/components/ui/glass/`:
  - `GlassSurface` – wraps `LiquidGlass` with shared defaults, size-aware props, and dark/light variants.
  - `GlassButton`, `GlassCard`, `GlassSheet` – extend Shadcn components (`button`, `card`, `sheet`) by embedding `GlassSurface`.
  - Provide a `withGlassSupport` helper for quickly upgrading feature components without rewriting layouts.
- [x] **Mobile gating**: extend `useIsMobile` or add a `useGlassOnMobile` hook that returns `false` when the device opts out (e.g., `prefers-reduced-motion`, low memory). Ensure every primitive respects this flag to fall back to existing styling.
- [x] **Global provider**: if we need shared mouse position, create a lightweight provider (`GlassMotionProvider`) under `src/providers` to share pointer data for stacked surfaces (e.g., sticky headers + sheets).

## Phase 2 – Layout & Navigation Surfaces
- [ ] **Top app chrome**: wrap mobile headers in `src/components/Layout.tsx` and `src/components/layout/Layout.tsx` with `GlassSurface`, tuning `cornerRadius` to 0 and using safe-area padding. Integrate `SidebarTrigger` hit target within the glass surface for tactile feedback.
- [ ] **Sidebar / Drawer**: update `src/components/ui/sidebar/*` to render the mobile drawer shell inside `GlassSheet`, ensuring focus traps and scroll locking remain intact.
- [ ] **Global status badges**: refactor `HeaderStatus`, `NotificationBadge`, and `HelpButton` containers to adopt `GlassButton` styles for consistent frosted controls on mobile.

## Phase 3 – Dashboard Mobile Views
- [ ] **Day calendar shell**: convert the root `<Card>` wrappers in `src/components/dashboard/MobileDayCalendar.tsx` to `GlassCard`, applying toned-down `displacementScale` for scroll performance.
- [ ] **Job cards**: wrap `MobileJobCard` root container and dropdown trigger buttons with glass primitives. Adjust nested dialogs (`JobDetailsDialog`, `LightsTaskDialog`, etc.) to launch from `GlassSheet` overlays for visual cohesion.
- [ ] **Calendar filters**: apply `GlassSurface` to filter popovers (`DropdownMenuContent`, `PopoverContent`) so quick actions inherit the effect without sacrificing readability.

## Phase 4 – Logistics Mobile Experience
- [ ] **Calendar frame**: swap the `Card` in `MobileLogisticsCalendar.tsx` for `GlassCard`, ensuring navigation buttons reuse `GlassButton` with compact padding for thumb reach.
- [ ] **Event cards**: enhance `LogisticsEventCard` to conditionally render `GlassSurface` backgrounds (blend existing color-coded accents with frosted translucency via gradient overlays).
- [ ] **Event dialog**: when the user taps an event (`LogisticsEventDialog`), migrate the dialog panel to `GlassSheet` for consistent texture.

## Phase 5 – Personal Mobile Calendar
- [ ] **Calendar container**: apply `GlassCard` to the outer shell in `MobilePersonalCalendar.tsx`, factoring in large lists by enabling a `reducedElasticity` prop when the list length exceeds a threshold to keep scrolling smooth.
- [ ] **Tech detail modal**: wrap `TechDetailModal` (mobile variant) with `GlassSheet` and ensure badges/buttons inside use `GlassButton` and `GlassSurface` to harmonize with the container.
- [ ] **Availability chips**: update interactive chips (`TechContextMenu`, quick actions) to adopt `GlassButton` styles with accessibility-compliant contrast.

## Phase 6 – Shared Mobile Utilities
- [ ] **Dialogs & Sheets**: extend `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, and `src/components/ui/drawer.tsx` with optional glass variants triggered via prop (e.g., `<Dialog glass>`). Use CSS variables to keep layering consistent across apps.
- [ ] **Toasts & banners**: inject the effect into `use-toast` renderer for mobile notifications, ensuring `aria-live` semantics remain unaffected.
- [ ] **Maps & overlays**: audit map overlays (`src/components/maps/*`) and schedule timeline tooltips for opportunities to wrap tooltips/legends with `GlassSurface` while respecting z-index stacking.

## Phase 7 – QA & Rollout
- [ ] **Accessibility verification**: confirm text contrast and focus outlines meet WCAG AA with translucent backgrounds; document fallback states in `docs/accessibility.md`.
- [ ] **Performance regression tests**: add Playwright traces capturing scroll/jank metrics on mobile viewports. Compare FPS before/after applying the glass effect.
- [ ] **Feature flagging**: gate the glass experience behind a Supabase or local storage feature flag (`mobile_glass_ui`) to allow gradual rollout and quick rollback.
- [ ] **Documentation**: add usage guidelines to `docs/design-system.md` with component examples and props reference.

## Component Inventory Checklist (mobile-priority)
- Layout chrome: `src/components/Layout.tsx`, `src/components/layout/Layout.tsx`
- Navigation: `src/components/ui/sidebar/*`, `src/components/layout/SidebarNavigation.tsx`
- Dashboard mobile: `src/components/dashboard/MobileDayCalendar.tsx`, `MobileJobCard.tsx`, filter popovers/dialogs.
- Logistics mobile: `src/components/logistics/MobileLogisticsCalendar.tsx`, `LogisticsEventCard.tsx`, `LogisticsEventDialog.tsx`
- Personal mobile: `src/components/personal/MobilePersonalCalendar.tsx`, `TechDetailModal.tsx`, `TechContextMenu.tsx`
- Shared overlays: `src/components/ui/dialog.tsx`, `sheet.tsx`, `drawer.tsx`, toasts via `use-toast.ts`
- Supporting hooks: `src/hooks/use-mobile.tsx`, `useMobileRealtimeSubscriptions.ts`
- Ancillary: status badges (`src/components/layout/HeaderStatus.tsx`), map overlays (`src/components/maps/*`), schedule quick actions (`src/components/schedule/*`)

Each checklist item should be reviewed during implementation to ensure the liquid glass effect is available wherever the mobile UI renders a standalone surface.
