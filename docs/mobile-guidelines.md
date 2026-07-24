# Mobile design foundations and responsive tokens

This document outlines our new mobile-first responsive tokens and usage patterns to standardize layout, spacing, typography, and safe-area handling across the app.

## Breakpoints and container widths

Tailwind screens are aligned with the shared ViewportProvider:

- xs: 360px
- sm: 480px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1440px
- 3xl: 1680px

Container is centered by default with mobile-friendly padding. Use the Tailwind `container` class when you need a page-level bound:

- Padding: 1rem (xs/sm), 1.25rem (md), 1.5rem (lg), 2rem (xl), 2.5rem (2xl)
- Container widths follow the same screens above

## ViewportProvider and hooks

A new shared provider exposes live viewport information and helpers.

Import and wrap the app (already wired in App.tsx):

- import { ViewportProvider } from '@/hooks/use-mobile';
- <ViewportProvider> ... </ViewportProvider>

Use in components:

- import { useViewport, useIsMobile } from '@/hooks/use-mobile';
- const { width, height, breakpoint, isMobile, atLeast, atMost, between } = useViewport();
- const isMobileOnly = useIsMobile();

Examples:

- if (atLeast('lg')) { ... }
- if (between('sm', 'lg')) { ... }
- const fullHeight = isMobile ? 'h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom))]' : 'h-[calc(100dvh-4rem)]'

## Safe-area utilities

iOS and edge-to-edge devices require safe-area padding (`viewport-fit=cover` is set, so insets are real). **The canonical pattern is an arbitrary-value class with a base minimum:**

- `pt-[max(1rem,env(safe-area-inset-top))]` — edge-anchored top (headers, full-screen modal overlays)
- `pb-[max(1.5rem,env(safe-area-inset-bottom))]` — edge-anchored bottom (bottom sheets, footers)
- `bottom-[calc(1rem+env(safe-area-inset-bottom))]` — floating elements offset from the bottom edge

This is what the UI primitives (`sheet.tsx`, `drawer.tsx`, `toast.tsx`, `sidebar.tsx`) and the technician modals use. The CSS utility classes in `index.css` (`pt-safe`, `pb-safe`, `px-safe`, `pt-safe-2/3/4`, `pb-safe-2/3/4`) remain available as shorthand when no base minimum is needed.

The old Tailwind spacing tokens (`safe-top`, `safe-bottom`, …) were unused and have been removed — don't reintroduce them.

Notes:

- `SheetContent` applies its insets as inline styles so consumer classes can't strip them; opt out via the `style` prop if an inner element handles the inset.
- Use top and bottom independently; avoid a single `py-` value when the two edges need different handling.

## Offsetting above the mobile nav

The fixed mobile nav bar's base height is exposed as `--mobile-nav-height` (4.5rem, defined in `index.css`; keep in sync with `MobileNavBar.tsx`). Anything positioned above the nav, or padding content so it clears the nav, must use:

```
calc(var(--mobile-nav-height) + env(safe-area-inset-bottom) [+ gap])
```

Never hard-code 4rem/4.5rem/6rem nav offsets. `Layout.tsx`'s main already pads mobile content with this value — pages inside Layout only need extra offsets for `fixed` elements.

## Viewport heights

Never use `h-screen` or `100vh` for viewport-level containers — on iOS they include the area under browser chrome. Use `h-dvh` / `100dvh` (or `min-h-screen` when only a minimum is needed). When subtracting a safe-area-padded header (like Layout's), subtract `env(safe-area-inset-top)` too: `h-[calc(100dvh-4rem-env(safe-area-inset-top))]`.

## Spacing scale additions

Extended spacing is available for common mobile rhythms:

- 18 -> 4.5rem
- 22 -> 5.5rem
- 26 -> 6.5rem
- 30 -> 7.5rem

Use normally with Tailwind classes (e.g. `mt-18`, `pb-22`).

## Mobile typography

Global base sizes use CSS clamp to scale slightly with viewport width:

- --text-xs .. --text-3xl in CSS variables
- Headings (h1–h4) and body default to these scales

Continue using Tailwind `text-sm`, `text-base`, etc., as needed. The base element defaults make unstyled content read well on phones without overriding existing explicit sizes.

## Colors and tokens

Shadcn/HSL tokens remain the primary surface system. Additional variables for safe-area insets are exposed as:

- --safe-area-top, --safe-area-bottom, --safe-area-left, --safe-area-right

Leverage them in custom CSS when required, or prefer the utilities above.

## Patterns and tips

- Prefer `useViewport()` over manual `window.innerWidth` checks
- For mobile-only UI, rely on `isMobile` (md breakpoint) or `atMost('md')`
- Use `pt-safe-*` for sticky headers and `pb-safe-*` for bottom navs
- Avoid hard-coded `64px` header/footer paddings — safe-area sizes vary per device

## Responsive dialogs and action sheets

Use `ResponsiveDialog` from `@/components/ui/responsive-dialog` for new modal flows. It keeps the Radix dialog behavior at `md` and above, and renders the same content in a safe-area-aware vaul bottom drawer below `md`.

- Build with `ResponsiveDialog`, `ResponsiveDialogTrigger`, `ResponsiveDialogContent`, `ResponsiveDialogHeader`, `ResponsiveDialogTitle`, `ResponsiveDialogDescription`, and `ResponsiveDialogFooter`.
- Keep controlled state on the root exactly as with `Dialog` (`open` and `onOpenChange`).
- Use `MobileActionSheet` for a grouped list of labeled actions. Icon-only toolbars are not acceptable on touch-only screens because hover tooltips are unavailable.
- Prefer a short title, optional one-line description, and groups named for the user’s task (for example, Documentos, Flex, Personal, and Peligro).

## Touch targets

Compact `Button` variants preserve their visual dimensions. On coarse pointers, the shared `coarse-hit-target` utility reserves spacing and extends their interaction area to at least 44×44px without overlapping adjacent targets. Do not counteract that reserved space with negative margins or clipped overflow.

For custom controls that do not use `Button`, provide the same 44×44px interaction floor with a wrapper that reserves layout space. A pseudo-element is acceptable only when its footprint cannot overlap another control.

## Mobile typography guardrail

Arbitrary `text-[8px]` through `text-[11px]` classes are tracked per file by `npm run governance:type-floor`. Existing debt is baselined and may decrease, but any per-file increase fails governance. Use `text-xs` or a larger semantic token for new UI.

## Responsive data views

Choose the pattern based on the task:

- Card reflow: use for actionable rows such as timesheets, expenses, and payouts. Put the primary identity and status first, then secondary values, with actions at the bottom.
- Scroll-wrap: use for dense reference data where cross-column comparison is essential. Keep the first identifying column sticky and provide a visible horizontal-scroll affordance.

Do not rely on an unlabelled overflowing desktop table as the mobile fallback.
- Keep layouts fluid and use the extended breakpoints to progressively enhance beyond md
