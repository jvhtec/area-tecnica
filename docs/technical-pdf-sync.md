# Technical PDF sync — keeping generated documents fresh

This doc is the reference for how the app keeps auto-generated technical PDFs
(consumos/power, pesos/weight, memorias técnicas, SoundVision reports, Flex
material lists) in sync with the data they were generated from, for **regular
jobs** and for **tour dates**. If you add a new generator or a new mutation
path that feeds one of these documents, wire it into the sync triggers listed
here — every gap in this table has historically produced stale documents.

## Regular jobs (`job_documents` + `job-documents` bucket)

### Storage layouts

Generated PDFs can live under two layouts; **both must be treated as one
logical slot** per job/category/stage. Flex material-list and quote reports
further scope that slot by the selected Flex Presupuesto element, so sibling
department, extras, or stage budgets do not replace each other:

| Layout | Written by |
|---|---|
| `${category}/${jobId}[/stage-scope]/…` | Calculator tools (`uploadJobPdfWithCleanup`), `fetch-flex-material-report` edge function |
| `${jobId}/${category}[/stage-scope]/…` | `duplicateSoundDocumentation` (copies from another job) |

Categories in use:

| Category | Producer | Departments |
|---|---|---|
| `calculators/consumos` | Consumos tool (`uploadPowerReportAndCompleteTask`) | **shared: sound + video** |
| `calculators/lights-consumos` | Lights Consumos tool | lights |
| `calculators/pesos` | Pesos tool (`uploadWeightReportAndCompleteTasks`) | sound (video/lights pesos tools currently download only — see Known gaps) |
| `calculators/sv-report` | SoundVision `ReportGenerator` | sound |
| `calculators/lista-material/{department}` | `fetch-flex-material-report` edge function | per department |

### Canonical power/weight filenames

All newly generated power and weight filenames come from
`src/utils/technicalPdfNames.ts`; entrypoints must not assemble these names
locally. The shared shapes are:

| Scope | Filename |
|---|---|
| Job calculator | `<job> - <department> <potencia|peso>.pdf` |
| Tour defaults export | `<tour> - <department/package> <potencia|peso> predeterminados.pdf` |
| Tour-date direct, bulk, or synchronized export | `<tour> - <date> - <location> - <department/package> <potencia|peso>.pdf` |

Examples: `FEID Madrid - Sonido potencia.pdf` and
`FEID Tour L - 2026-07-14 - Madrid - Sonido L potencia.pdf`. Stage-scoped job
reports append the stage label through `appendTechnicalStageToFilename`.

The filename is a display/download name, **not the replacement identity**.
Job cleanup targets job + category + stage (and the department filter for the
shared Consumos category). Tour cleanup targets tour + date + department +
type from the stable storage slot. Existing English and legacy Spanish names
remain recognizable by the readers/cleanup classifiers and are retired on the
next successful regeneration.

### Consumers (what goes stale if the slot isn't cleaned)

- **Memoria Técnica auto-fill** (`useMemoriaAutoFill` → `findJobDocumentsForStage`):
  exposes every matching `job_documents` row per category/stage, with a
  department filter for power reports (`getTechnicalPowerDepartmentFromDocument`).
  The newest row is selected by default, and the Sound/Lights/Video forms show
  an inline selector when extras or repeated generations leave multiple valid
  source PDFs.
- **Power report readiness** (`getTechnicalPowerReportStatus`): latest report
  per department, used by hoja de ruta / power summary flows.
- **Sound documentation duplication** (`selectSoundDocumentsForCopy`): copies
  the newest doc per generated group into another job.
- **Task auto-completion** (`autoCompleteConsumosTasks`, `autoCompletePesosTasks`).

### Invariants (enforced by `uploadJobPdfWithCleanup`)

1. **Cleanup covers both layouts.** Regenerating a report removes the previous
   version from the legacy folder *and* any copies under the job-scoped
   layout, in storage and in `job_documents`.
2. **Cleanup is direct-children only.** An unscoped upload must not delete
   stage-scoped sibling slots (`…/stage-2-main/…`), and vice versa.
3. **Shared folders are cleaned per department.** `calculators/consumos` holds
   both sound and video reports; power uploads pass a `cleanupFilter` built by
   `buildPowerReportCleanupFilter(department)` so one department's
   regeneration never deletes the other department's latest PDF. The filter
   reuses the same classifier the readers use, so "what gets deleted" always
   matches "what gets detected".
4. **A replacement is published before its predecessor is retired.** The new
   object and `job_documents` row are created before old versions are cleaned,
   so an upload/insert failure leaves the last valid document available.
5. **Replacements are serialized per logical slot.** Concurrent regenerations
   for the same job/category/stage wait for each other, so an older generation
   cannot finish last and become the document consumers detect as newest.
6. **Flex report cleanup is element-scoped.** `fetch-flex-material-report`
   publishes a uniquely named object first, then retires only older direct-child
   objects/rows for the same Flex element. The pre-element shared filename is
   removed on the next successful generation, while PDFs from sibling
   Presupuestos remain available. Memoria auto-fill defaults to the most recent
   material list in the requested job/category/stage while allowing any sibling
   Presupuesto PDF to be selected explicitly.

Documentation generators that start without a job-card deep link use the shared
`DocumentationJobPicker`. It searches job title/date and is backed by
`useJobSelection`, which includes ongoing and future jobs only and excludes
`Completado` and `Cancelado` jobs.

## Tour dates (`tour_documents` + `tour-documents` bucket)

Per tour date, department, and type (power/weight), a PDF is auto-generated
under `tours/{tourId}/auto-generated/default-pdfs/{tourDateId}/{department}-{type}-{versionKey}.pdf`
by `syncTourDefaultDocuments` (`src/utils/tourDefaultDocumentSync.ts`). The PDF
content comes from: tour name, date, location, resolved default set + tables,
and **per-date overrides** (`tour_date_power_overrides` /
`tour_date_weight_overrides`, which take priority over defaults). Job cards of
`tourdate` jobs and the tour documents list serve these PDFs.

Each generation receives a unique version key. The replacement object and
`tour_documents` row are published before older rows in the same
date/department/type slot are retired. Upload or insert failures therefore
leave the previous valid PDF available, while the unique path also prevents a
retry from colliding with a partially cleaned-up prior generation.

**Any mutation of one of those inputs must re-trigger the sync.** Current
triggers:

| Mutation | Trigger location |
|---|---|
| Default set/table create/update/delete/copy (Consumos & Pesos tools, defaults mode) | `syncDefaultDocumentsAfterMutation` in `useConsumosTool` / `PesosTool` |
| Defaults edits in Tour Defaults Manager | `syncDefaultDocuments` in `TourDefaultsManager` |
| Tour date create / edit (date, location, type, package sizes, pinned sets) | `syncTourDefaultDocumentsForDate` in `TourDateManagementDialog` |
| Tour date delete | `cleanupTourDefaultDocumentsForDate` in `TourDateManagementDialog` |
| **Per-date override create/update/delete** (power & weight, both URL override mode and job-based override mode) | `useTourDateOverrides` and the legacy `useTourOverrideMode` writer used by Video Pesos → `useTourDateDefaultDocumentRefresh` → `scheduleTourDateDefaultDocumentSync` (`src/utils/tourDateDocumentSync.ts`), coalesced per tour date |
| **Bulk "Tour Pack only" toggle across all dates** | `handleBulkTourPackUpdate` in `TourManagementDialog` |
| **Tour rename** (name is embedded in PDF title/filename) | `handleNameChange` in `useTourManagement` |

After a sync, invalidate the `tour-documents`, `jobcard-tour-documents` and
`tour-documents-for-job` query scopes so job cards refresh.

Overrides are written through `useTourDateOverrides` and the legacy
`useTourOverrideMode.saveOverride` path used by Video Pesos (plus cascade
deletes when a date/tour is deleted, which run their own document cleanup).
Both schedule the per-date sync. Keep new writers on one of these paths, or
schedule the sync explicitly.

All full-tour and per-date syncs are also serialized per tour inside
`syncTourDefaultDocuments`; local debounce/queues are an optimization, not the
correctness boundary. This prevents an older concurrent generation from
finishing last and replacing a newer document.

## Known gaps (accepted, do not silently rely on them)

- **Video/Lights pesos tools don't upload.** `VideoPesosTool` only downloads
  its PDF, and `LightsPesosTool` (rigging planner) uploads to the
  `task_documents` bucket without versioned cleanup. Consequence: the video
  and lights Memorias auto-fill their "Informe de Pesos" section from
  `calculators/pesos`, which only the **sound** Pesos tool writes. Fixing this
  requires department-aware weight categories (mirror the consumos
  `cleanupFilter` approach) before adding uploads, otherwise departments would
  clobber each other.
- **Tour logo changes don't re-sync tour-date PDFs.** PDFs regenerated after a
  logo change pick it up, but older ones keep the previous logo until another
  documented trigger runs the sync.
- **`generate-sv-report` edge function** is currently unused by the SV report
  flow (the client generates the PDF); see the 2026-07-10 audit before
  building on it.
