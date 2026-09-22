# Wallboard — structure and current status

_Last updated: 2026-09-22_

## Entry points

- `src/pages/Wallboard.tsx` protects authenticated access for
  `admin`, `management`, and `wallboard` roles.
- `src/pages/WallboardPublic.tsx` exchanges the shared URL token for a
  short-lived, preset-scoped JWT and renews it before expiry.
- `src/features/wallboard/WallboardDisplay.tsx` renders both routes from the
  same canonical snapshot.
- The LG webOS wrapper in `SectorProWallboard/` continues to launch the public
  route; no native feed implementation exists in the package.

## Canonical data path

Both authenticated and public displays call `wallboard-feed /snapshot`.
Authenticated callers use their normal Supabase JWT and must have an allowed
persisted profile role. Public displays use the scoped JWT issued by
`wallboard-auth`.

After authorization, the Edge Function performs display-safe service-role reads
and returns snapshot schema version 1:

```text
snapshot
├── generatedAt / presetSlug
├── overview.jobs
├── calendar.jobs
├── crew.jobs
├── pending.items
├── logistics.items
└── announcements.announcements
```

The snapshot uses one coherent query pass for:

- jobs, departments, assignments, locations, and cancelled-tour filtering;
- required-role staffing totals and assignment coverage;
- document counts and requirements;
- sanitized profile names and timesheet statuses;
- overdue timesheet actions;
- logistics events; and
- active announcements.

The browser validates the snapshot envelope before applying it. A failed refresh
does not clear the current display.

Legacy per-panel Edge endpoints remain available for compatibility, but
`WallboardDisplay` no longer calls them and no longer rebuilds an independent
feed from many browser-side database queries.

## Panels

Supported panel keys are:

- `overview` — próximos trabajos and readiness;
- `crew` — assignments and timesheet state;
- `logistics` — upcoming transport movements;
- `pending` — staffing and overdue-timesheet attention items; and
- `calendar` — the current Madrid calendar grid.

Rotation advances through pages before moving to the next panel. Highlight
announcements can temporarily emphasize jobs.

## Presets

`wallboard_presets` is authoritative for every slug. The display no longer
contains hardcoded public configurations for `produccion`, `almacen`, or
`oficinas`.

- Panel order is normalized by filtering unknown and duplicate keys.
- Missing panels remain disabled instead of being silently added back.
- A missing `produccion` preset deliberately falls back to calendar-only.
- Other missing presets use the default panel order and show a Spanish warning.

The preset editor is restricted to management roles by RLS. Public displays read
configuration through the scoped wallboard API.

## Time and refresh behavior

- Date windows and calendar boundaries use `Europe/Madrid`, including DST.
- The snapshot polling interval follows the bounded preset ticker interval
  (10–60 seconds).
- In-flight requests are not duplicated; one refresh is queued if another tick
  arrives while a request is active.
- Public JWT renewal occurs before expiry and retries after transient failures.
- The initial splash closes only after both its animation and authentication
  complete, regardless of which finishes first.

## Security boundary

- The browser uses `WALLBOARD_SHARED_TOKEN` only for the auth exchange. The feed
  still accepts the shared token through its legacy compatibility headers/query
  parameter; new clients must use the short-lived scoped JWT, and that legacy
  path should be removed only as a separately coordinated breaking change.
- `WALLBOARD_JWT_SECRET` signs and verifies scoped display JWTs.
- Normal user JWTs are verified with Supabase Auth, then authorized from the
  persisted profile role. User-editable metadata is not used.
- Service-role credentials never reach the browser.
- The response contains only fields required by the display.

Public URLs remain shared bearer capabilities. Per-device hashed tokens,
revocation, rate-limit telemetry, and screen health are the next security/data
phase.

## Verification expectations

For wallboard feed changes, run:

```bash
npm run lint
npm run typecheck
npm run typecheck:functions
npm run governance
npm run test:critical
npm run test:run
npm run test:e2e
npm run build
npm run budget:bundle
```

Focused coverage must include snapshot mapping, malformed envelope rejection,
preset disablement, slow authentication, token renewal, Madrid DST boundaries,
cancelled tours, staffing requirements, document counts, and overdue
timesheets.

No database migration is required for snapshot schema version 1. Any future
device-token, preset-filter, announcement-scheduling, or heartbeat tables make
that PR database high-risk and require pgTAP coverage plus the human production
dry-run workflow.
