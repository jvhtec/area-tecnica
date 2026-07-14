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
logical slot** per job/category/stage:

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

### Consumers (what goes stale if the slot isn't cleaned)

- **Memoria Técnica auto-fill** (`useMemoriaAutoFill` → `findLatestJobDocumentForStage`):
  picks the newest `job_documents` row per category/stage, with a
  department filter for power reports (`getTechnicalPowerDepartmentFromDocument`).
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

## Tour dates (`tour_documents` + `tour-documents` bucket)

Per tour date, department, and type (power/weight), a PDF is auto-generated
under `tours/{tourId}/auto-generated/default-pdfs/{tourDateId}/{department}-{type}-{versionKey}.pdf`
by `syncTourDefaultDocuments` (`src/utils/tourDefaultDocumentSync.ts`). The PDF
content comes from: tour name, date, location, resolved default set + tables,
and **per-date overrides** (`tour_date_power_overrides` /
`tour_date_weight_overrides`, which take priority over defaults). Job cards of
`tourdate` jobs and the tour documents list serve these PDFs.

**Any mutation of one of those inputs must re-trigger the sync.** Current
triggers:

| Mutation | Trigger location |
|---|---|
| Default set/table create/update/delete/copy (Consumos & Pesos tools, defaults mode) | `syncDefaultDocumentsAfterMutation` in `useConsumosTool` / `PesosTool` |
| Defaults edits in Tour Defaults Manager | `syncDefaultDocuments` in `TourDefaultsManager` |
| Tour date create / edit (date, location, type, package sizes, pinned sets) | `syncTourDefaultDocumentsForDate` in `TourDateManagementDialog` |
| Tour date delete | `cleanupTourDefaultDocumentsForDate` in `TourDateManagementDialog` |
| **Per-date override create/update/delete** (power & weight, both URL override mode and job-based override mode) | `useTourDateOverrides` → `scheduleTourDateDefaultDocumentSync` (`src/utils/tourDateDocumentSync.ts`), coalesced per tour date |
| **Bulk "Tour Pack only" toggle across all dates** | `handleBulkTourPackUpdate` in `TourManagementDialog` |
| **Tour rename** (name is embedded in PDF title/filename) | `handleNameChange` in `useTourManagement` |

After a sync, invalidate the `tour-documents`, `jobcard-tour-documents` and
`tour-documents-for-job` query scopes so job cards refresh.

Overrides are only ever written through `useTourDateOverrides` (plus cascade
deletes when a date/tour is deleted, which run their own document cleanup).
Keep it that way: a new writer that bypasses the hook must schedule the
per-date sync itself.

## Known gaps (accepted, do not silently rely on them)

- **Video/Lights pesos tools don't upload.** `VideoPesosTool` only downloads
  its PDF, and `LightsPesosTool` (rigging planner) uploads to the
  `task_documents` bucket without versioned cleanup. Consequence: the video
  and lights Memorias auto-fill their "Informe de Pesos" section from
  `calculators/pesos`, which only the **sound** Pesos tool writes. Fixing this
  requires department-aware weight categories (mirror the consumos
  `cleanupFilter` approach) before adding uploads, otherwise departments would
  clobber each other.
- **Tour logo changes don't re-sync tour-date PDFs.** The logo resolves to a
  short-lived signed URL, so it can't participate in the version key; PDFs
  regenerated after a logo change pick it up, older ones keep the previous
  logo until the next sync touches them.
- **`generate-sv-report` edge function** is currently unused by the SV report
  flow (the client generates the PDF); see the 2026-07-10 audit before
  building on it.
