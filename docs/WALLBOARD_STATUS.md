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
- per-document requirement status (see "Document requirements" below);
- sanitized profile names and timesheet statuses;
- overdue timesheet actions;
- logistics events; and
- active announcements.

The browser validates the snapshot envelope before applying it. A failed refresh
does not clear the current display.

Legacy per-panel Edge endpoints remain available for compatibility, but
`WallboardDisplay` no longer calls them and no longer rebuilds an independent
feed from many browser-side database queries.

## Document requirements

`required_docs` lists what each department owes per job (seeded by
`20260922190000_seed_wallboard_required_docs.sql`; `is_required` and `label`
stay editable per row):

| Department | Keys |
| --- | --- |
| sound | `pesos`, `consumos`, `lista_material`, `soundvision`, `memoria` |
| lights | `consumos`, `memoria` |
| video | `consumos` |

`wallboard-feed/docRules.ts` detects each document from where the app saves it:
calculator PDFs in `job_documents` under `calculators/pesos/`,
`calculators/consumos/` (sound and video told apart by file name, exactly like
`src/utils/powerReportReadiness.ts`), `calculators/lights-consumos/`,
`calculators/lista-material/sound/` and `calculators/sv-report/` (legacy or
`<jobId>/calculators/…` layout), and the three memoria técnica tables once
`final_document_url` is set. Uploaded files outside those folders (riders,
photos) never count.

Each overview job carries `docChecklist: [{ dept, key, label, state }]` where
`state` is `delivered`, `pending` (job starts more than 72 h out) or `missing`
(72 h or less, or already started). Documents are only loaded for the seven-day
window; calendar-only jobs further out return an empty checklist. The legacy
`wallboard_doc_counts` view (any file under `sound/`, `lights/`, `video/`) is
no longer used by the snapshot.

Video is now part of readiness, crew and documents; it used to be dropped.

## Panels

Supported panel keys are:

- `overview` — próximos trabajos: status pill (staffing + documents), crew bar
  and document chips per department, most urgent first, four per page;
- `docs` — documentación: jobs × required documents matrix, eight per page;
- `crew` — equipo asignado: people per department with dashed vacancies;
  timesheet state only after the job has ended; two jobs per page;
- `logistics` — movements grouped by day with carga/descarga, vehicle, plate,
  transport company logo and loading bay; five per page;
- `pending` — atención: staffing, document and overdue-timesheet totals plus
  alerts grouped by job; skipped by the rotation while empty; and
- `calendar` — four weeks from the current Madrid Monday.

Existing presets keep their saved panel order, so `docs` appears on a screen
only after it is added in the preset editor.

Pages cut rather than scroll. Rotation advances through pages before moving to
the next panel. Highlight announcements give a job a steady amber outline.

## Display

The display is light only. `src/features/wallboard/wallboard.css` sizes
everything in `--u` (1/100 of the 16:9 frame that fits the viewport), so 1080p,
4K and desktop windows show the same composition. A shared header shows the
logo, panel title, rotation dots, data freshness
from `snapshot.generatedAt` (amber after two missed polls) and the Madrid clock.
All dates and times are formatted in `Europe/Madrid` with `es-ES`
(`src/features/wallboard/format.ts`), independent of the TV's locale and clock.

Transport company logos come from `TRANSPORT_PROVIDERS`; entries with
`tone: 'light'` (white-on-transparent files) are darkened with
`filter: brightness(0)` on the light theme.

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

Snapshot schema version 1 only grows additively: `docChecklist` on overview
jobs, `departments`/`crewNeeded` on crew jobs, and `kind`, `jobId`, `jobTitle`,
`color`, `startTime`, `dept`, `count`, `detail` on pending items are optional in
the browser validator, so a display keeps working against an older Edge
Function during a deploy.

The only migration is the data-only `required_docs` seed
(`supabase/tests/database/wallboard_required_docs.sql` covers it). Any future
device-token, preset-filter, announcement-scheduling, or heartbeat tables make
that PR database high-risk and require pgTAP coverage plus the human production
dry-run workflow.
