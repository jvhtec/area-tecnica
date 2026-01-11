# Changelog

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
