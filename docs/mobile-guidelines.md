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
- const fullHeight = isMobile ? 'h-[calc(100vh-var(--safe-area-top)-var(--safe-area-bottom))]' : 'h-[calc(100vh-4rem)]'

## Safe-area utilities

iOS and edge-to-edge devices require safe-area padding. We offer two ways to handle it:

1) Tailwind spacing tokens (theme.spacing)

- pt-safe-top, pb-safe-bottom, pl-safe-left, pr-safe-right
- pt-safe-top-2/3/4 and pb-safe-bottom-2/3/4 add 0.5rem/0.75rem/1rem on top of the safe inset

These work anywhere you can use spacing tokens, e.g. `pt-safe-top-3`.

2) Utility classes in CSS

- pt-safe, pb-safe, px-safe, py-safe
- pt-safe-2/3/4 and pb-safe-2/3/4 mirror the sizes above

Use top and bottom independently on mobile bars and headers. Avoid `py-` with a single token when top and bottom values need to be different.

Examples:

- Header: `pt-safe` or `pt-safe-3`
- Bottom bar: `pb-safe` or `pb-safe-3`
- Edge gutters: `px-safe`

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
- Keep layouts fluid and use the extended breakpoints to progressively enhance beyond md
