# Changelog

## 2026-04-13
- Fix assignment matrix conflict review so unavailability-only dates are kept in single, multi, and full coverage warnings.
- Restore available-technician cache invalidation for cross-job `job_assignments` changes, including in-place updates.
- Normalize matrix day keys in `Europe/Madrid`, deduplicate repeated day entries, and localize assignment-dialog dates to Spanish.
- Document the assignment lifecycle and add targeted unit/component coverage plus Playwright lifecycle coverage for create, reassign, and remove flows.
- Refactor the matrix core into shared query/date helpers plus dedicated viewport, sorting, and interaction controllers; split `OptimizedMatrixCell` into memoized status/action/content/dialog sections; add controller/query helper tests and render-stability coverage.

## 2026-01-11
- Standardize mobile layout spacing/width for key routes (sound, expenses, announcements, activity, feedback) and align layout container sizing.
- Remove deprecated Excel Tool and Labor PO Form routes/components and clean related docs/links.
- Hide Google/Apple OAuth buttons on the auth page (email/password only for now).
- Align iOS app icon with PWA branding (AppIcon 1024px) and re-sync iOS assets.
- Add native iOS push path (Capacitor/APNs) alongside existing web push; store device tokens and send to both channels.
- Deploy updated `push` edge function and add native device token table migration.
- Restore mobile create-job button + admin actions for lights department mobile hub.

## 2024-11-24
- Add Sector-Pro webOS launcher package for LG TVs (`SectorProWallboard/`) with menu navigation and embedded wallboard links.
- Fix wallboard preset management to respect saved `display_url` values (no forced default token/slug URLs).
- Apply `npm audit fix --production` to patch `glob` (sucrase/tailwind); remaining advisory: `xlsx` has no upstream fix yet.
