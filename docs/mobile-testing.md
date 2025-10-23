# Mobile Testing & Performance Guide

Sector Pro now ships with a focused mobile testing toolchain that keeps navigation, input workflows, and critical calculators performant and accessible on small screens. This guide explains the available automation, performance expectations, and how to extend the coverage as new features land.

## Automated checks

| Check | Command | Purpose |
| --- | --- | --- |
| Mobile integration tests | `npm run test:mobile` | Runs the Vitest suite under `tests/mobile/**` covering navigation toggles, mobile-friendly forms, and rigging calculations. |
| Accessibility audit | `npm run audit:a11y` | Executes axe-core against the mobile navigation shell and vacation request form. This script is wired into the `prebuild` hook so every build captures regressions automatically. |

### Test coverage

- **Navigation:** Exercises the mobile sidebar trigger to guarantee the off-canvas sheet exposes an accessible `dialog` with a touch-friendly toggle.
- **Forms:** Validates that the vacation request workflow enforces required fields, supports sequential entry on touch devices, and clears state post-submit.
- **Tools & calculations:** Verifies the rigging solver balances total load, respects allowables, and returns safe hoist recommendations for mobile field use.

## Accessibility budget

Mobile layouts must remain free of critical axe violations—touch targets require a minimum 44px tap area, interactive controls need discernible labels, and dialogs must expose the proper ARIA roles. The automated `audit:a11y` run enforces these baselines; add the relevant component to `tests/mobile/a11y.spec.tsx` whenever introducing new mobile flows.

## Performance & bundle budgets

- **Initial JS (mobile entry):** target < 350 kB after compression.
- **Route-level chunks:** secondary chunks (charts, file importers, PDF tooling) should remain < 200 kB each.
- **Prefetch hints:** the build pipeline emits `<link rel="prefetch">` tags for high-impact mobile chunks (`mobile-ui`, `mapbox-gl`, `data-importers`, etc.) so future navigations stay responsive.
- **Deferred modules:** heavy dependencies (Mapbox, XLSX/ExcelJS, PDF generators, charting) load in their own Rollup chunks via `vite.config.ts`. When adding new heavy dependencies, update `manualChunkStrategy` to keep them out of the initial mobile payload.

Validate budgets after each feature by inspecting the generated manifest (`npm run build`) or Lighthouse mobile reports. If bundles exceed the targets, consider additional dynamic imports, pruning unused exports, or revisiting component composition.

## Maintenance checklist

1. **Add a mobile test** for every new navigation surface, calculator, or mission-critical form.
2. **Augment the axe suite** with representative renders before shipping visual refactors.
3. **Review `vite.config.ts`** when new libraries are introduced—slot them into a deferred chunk and whitelist prefetching targets if they influence first navigation.
4. **Document learnings here** so the broader team can align on mobile expectations.
