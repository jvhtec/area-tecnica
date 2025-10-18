# Design System Notes

## Liquid Glass Components

We provide glassified primitives for mobile-first surfaces through the `@/components/ui/glass` entry point. These wrappers respect `useGlassOnMobile` heuristics and the `mobile_glass_ui` feature flag so the experience can be rolled out gradually.

- **`GlassSurface`** – Low-level wrapper around `liquid-glass-react`. Accepts the same shader props plus:
  - `contentClassName` / `fallbackClassName` for styling inner content.
  - `mobileOptions` to forward feature-flag and device heuristics (e.g. `{ featureFlag: "mobile_glass_ui", minimumDeviceMemory: 3 }`).
  - `variant` (`"light" | "dark"`) to adapt the translucent palette.
- **`GlassCard`, `GlassButton`, `GlassSheetContent`** – Convenience components that embed `GlassSurface` into shadcn primitives. All expose `mobileOptions` and `glassSurfaceClassName`/`glassContentClassName` hooks for fine tuning.
- **Dialogs, sheets, drawers, toasts** – Pass the `glass` prop with optional `glassSurfaceProps` to opt into the frosted treatment (e.g. `<DialogContent glass glassSurfaceProps={{ displacementScale: 0.34 }} />`).

### Rollout guidance

1. Default to the glass variants on mobile layouts (`GlassCard`, `GlassButton`, `GlassSurface`) and set `mobileOptions={{ featureFlag: "mobile_glass_ui" }}`. Desktop surfaces may pass `allowDesktop: true` when parity is required.
2. Keep layered content readable by balancing `displacementScale` (`0.2–0.4` for scrolling lists) and `blurAmount` (`16–22` for dialogs/sheets).
3. Provide tactile fallbacks inside `fallbackClassName` when the shader is disabled (reduced motion, low-memory devices, or the feature flag off).
4. Use utility overlays (thin left accents, gradient backgrounds) inside the `GlassSurface` content block instead of mutating the shader directly.

Refer to `src/components/dashboard/MobileDayCalendar.tsx` and `src/components/personal/MobilePersonalCalendar.tsx` for examples of real-world integration.
