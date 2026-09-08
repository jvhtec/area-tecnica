# Flex folder structures and variants

This is the canonical catalog of every Flex hierarchy created by Área Técnica. It records the remote tree, names, document-number rules, picker variants, local tracking identities, and legacy behavior. The implementation source of truth is the server operation in `supabase/functions/create-flex-folders/index.ts` and the planners in `supabase/functions/_shared/flex-folders/jobPlan.ts` and `supabase/functions/_shared/flex-folders/tourPlan.ts`.

## Notation and shared fields

The examples use these placeholders:

| Token | Meaning |
| --- | --- |
| `T` | Job or tour title. A blank job title becomes `Sin título`. |
| `D` | Start date as `YYMMDD`, calculated in `Europe/Madrid`. |
| `DEPT` | Department suffix: Sound `S`, Lights `L`, Video `V`, Production `P`, Personnel `HR`, Comercial `QT`, Estructura `E`. |
| `label` | The implementation's folder label: `Sound`, `Lights`, `Video`, `Production`, `Personnel`, `Comercial`, or `Estructura`. |
| `element_id` | Remote Flex UUID. |
| `parent_id` | UUID of the local parent row in `flex_folders`, never the remote parent UUID. |

Unless a variant says otherwise, created elements are open, unlocked, assigned to the configured Flex location, and scheduled for the authoritative job or tour range. Definition, department, location, and responsible-person UUIDs come from `src/utils/flex-folders/constants.ts`; callers cannot supply them.

The five server operations are:

| Operation | Scope key | Lease | Allowed roles | Creates |
| --- | --- | ---: | --- | --- |
| `job` | `job:<job-id>` | 600 s | admin, management, logistics | Standard jobs, festivals, and dry-hire jobs |
| `tour-date` | `tour-date:<job-id>` | 600 s | admin, management, logistics | A job/date below tour department roots |
| `tour-root` | `tour-root:<tour-id>` | 300 s | admin, management, logistics | Tour root and department roots |
| `dryhire-year` | `dryhire-year:<year>` | 600 s | admin, management | Annual Sound/Lights roots and month parents |
| `festival-artist-extras` | `festival-artist-extras:<artist-id>` | 180 s | admin, management | One artist's Sound extras budget |

## Standard job and festival

This structure applies to non-tour-date, non-dry-hire jobs. The event root, Estructura, Production, Personnel, and Comercial branches always exist. Sound, Lights, and Video exist only when the corresponding department is present in authoritative `job_departments`.

```text
T                                      [D]             main_event
├── T - Estructura                     [DE]            department
│   ├── T - Sonido                     [DES]           pull_sheet, source=sound
│   └── T - Luces                      [DEL]           pull_sheet, source=lights
├── T - Sound                          [DS]            department, if selected
│   ├── T - Documentación Técnica - Sound [DSDT]       optional
│   ├── T - Presupuestos Recibidos - Sound [DSPR]      optional
│   ├── T - Hoja de Gastos - Sound     [DSHG]          optional
│   ├── T - Tour Pack                  [DSTP]           optional/default
│   ├── T - PA                         [DSPA]           optional/default
│   └── custom pull sheets             [DSPS01...]      optional
├── T - Lights                         [DL]            department, if selected
│   ├── T - Documentación Técnica - Lights [DLDT]      optional
│   ├── T - Presupuestos Recibidos - Lights [DLPR]     optional
│   ├── T - Hoja de Gastos - Lights    [DLHG]          optional
│   └── custom pull sheets             [DLPS01...]      optional
├── T - Video                          [DV]            department, if selected
│   ├── T - Documentación Técnica - Video [DVDT]       optional
│   ├── T - Presupuestos Recibidos - Video [DVPR]      optional
│   ├── T - Hoja de Gastos - Video     [DVHG]          optional
│   └── custom pull sheets             [DVPS01...]      optional
├── T - Production                     [DP]            department
│   ├── T - Documentación Técnica - Production [DPDT]  optional
│   ├── T - Presupuestos Recibidos - Production [DPPR] optional
│   ├── T - Hoja de Gastos - Production [DPHG]         optional
│   └── custom pull sheets             [DPPS01...]      optional
├── T - Personnel                      [DHR]           department
│   ├── Orden de Trabajo - T           [DHROT]         optional
│   ├── Gastos de Personal - T         [DHRGP]         optional
│   ├── Crew Call Sonido - T           [DHRCCS]        optional
│   └── Crew Call Luces - T            [DHRCCL]        optional
└── T - Comercial                      [DQT]           department
    ├── Sound commercial branch                         optional
    └── Lights commercial branch                        optional
```

### Typed department children

| Picker key | Departments | Definition | Name pattern | Suffix | `folder_type` |
| --- | --- | --- | --- | --- | --- |
| `documentacionTecnica` | Sound, Lights, Video, Production | technical documentation | `T - Documentación Técnica - label` | `DT` | `doc_tecnica` |
| `presupuestosRecibidos` | Sound, Lights, Video, Production | received budgets | `T - Presupuestos Recibidos - label` | `PR` | `presupuestos_recibidos` |
| `hojaGastos` | Sound, Lights, Video, Production | expense sheet | `T - Hoja de Gastos - label` | `HG` | `hoja_gastos` |
| `pullSheetTP` | Sound | pull sheet | `T - Tour Pack` | `TP` | `pull_sheet` |
| `pullSheetPA` | Sound | pull sheet | `T - PA` | `PA` | `pull_sheet` |
| `workOrder` | Personnel | work order | `Orden de Trabajo - T` | `OT` | `work_orders` |
| `gastosDePersonal` | Personnel | expense sheet | `Gastos de Personal - T` | `GP` | `hoja_gastos` |
| `crewCallSound` | Personnel | crew call | `Crew Call Sonido - T` | `CCS` | `crew_call` |
| `crewCallLights` | Personnel | crew call | `Crew Call Luces - T` | `CCL` | `crew_call` |

Crew calls also upsert `flex_crew_calls` by `(job_id, department)`, using `sound` or `lights` as the crew department.

Estructura does not use picker options. Its two pull sheets always exist and are distinguished by `source_department`, which is `sound` or `lights`.

### Commercial branch variants

Sound and Lights each have independent `extras<Department>` and `presupuesto<Department>` switches. Their base numbers are `DSQT` for Sound and `DLQT` for Lights.

With both Extras and Presupuesto enabled:

```text
T - Comercial [DQT]
└── Extras T - Sonido|Luces [DSQT|DLQT]                 comercial_extras
    └── Extras T - Sonido|Luces - Presupuesto [same]    comercial_presupuesto
```

With Presupuesto enabled and Extras disabled:

```text
T - Comercial [DQT]
└── T - Sonido|Luces - Presupuesto [DSQT|DLQT]          comercial_presupuesto
```

Custom budget metadata changes the leaf names and dates:

| Parent variant | Custom name `N` | Resulting name |
| --- | --- | --- |
| Extras exists | yes | `Extras T - N` |
| Extras exists | no | `Extras T - Sonido\|Luces - Presupuesto [n]` |
| No Extras | yes | `T - Sonido\|Luces - N` |
| No Extras | no | `T - Sonido\|Luces - Presupuesto [n]` |

A single budget keeps the base document number. Multiple budgets use `DSQTPR01`, `DSQTPR02`, ... or `DLQTPR01`, `DLQTPR02`, .... The same `extrasPresupuesto.entries` array supplies metadata to every enabled target branch.

### Pull-sheet metadata and numbering

`customPullsheet.entries` is the current multi-entry form. The older scalar form (`enabled`, `name`, `startDate`, `endDate`) remains accepted as one metadata entry. When `entries` is non-empty, it takes precedence over the scalar fields.

For Sound, metadata entries align with the enabled default slots before additional `PS` numbers are allocated:

| Enabled defaults | Metadata entries | Suffix sequence |
| --- | ---: | --- |
| TP and PA | 0 | `TP`, `PA` |
| TP and PA | 1 | `TP` receives entry 1; `PA` keeps its default |
| TP and PA | 3 | `TP`, `PA`, `PS01` receive entries 1–3 |
| TP only | 2 | `TP`, `PS01` |
| No defaults | 2 | `PS01`, `PS02` |

Lights, Video, and Production have no built-in pull sheets, so custom entries start at `PS01`. A custom entry can override its name, start, and end; missing values fall back to the generated name and job range.

## Picker option semantics

The canonical client normalizes picker input before sending it to the server. Only the keys in the tables above plus `customPullsheet`, `extrasSound`, `extrasLights`, `presupuestoSound`, and `presupuestoLights` survive normalization.

| Input | Meaning |
| --- | --- |
| `options === undefined` | Create every default typed child for every included department. |
| `options === {}` | Create the required department roots and Estructura branch, with no picker-controlled children. |
| Department omitted | Create no picker-controlled children for that department. |
| `department: {}` | Create every default child for that department. |
| `department: { subfolders: [] }` | Create no default children. Explicit custom pull-sheet metadata may still create custom sheets. |
| Unknown, malformed, or deprecated subfolder key | Drop it. An explicit empty selection remains empty. |

Picker options control children only. They never remove required department/date folders, Estructura, or its source pull sheets.

## Tour root

Technical roots are derived from the union of persisted department selections across all tour jobs. At least one persisted technical selection is required before the operation acquires a lease. Production, Personnel, Comercial, and Estructura roots always exist.

For a new tour root:

```text
Tour name                                      [D]       tour_root
├── Tour name - Sound                         [DS]      tour_department, if selected
│   ├── Tour name - Documentación Técnica - Sound [DSDT]
│   ├── Tour name - Presupuestos Recibidos - Sound [DSPR]
│   └── Tour name - Hoja de Gastos - Sound    [DSHG]
├── Tour name - Lights                        [DL]      same children, if selected
├── Tour name - Video                         [DV]      same children, if selected
├── Tour name - Production                    [DP]      same three children
├── Tour name - Personnel                     [DHR]     no root-level typed children
├── Tour name - Comercial                     [DQT]     no root-level typed children
└── Tour name - Estructura                     [DE]      no root-level source sheets
```

The tour range comes from `tours.start_date` and `tours.end_date`; if either is absent, it spans the earliest through latest `tour_dates.date`. `D` uses the range start.

Tour roots persist to `flex_folders` with `job_id = null`. Remote UUIDs also populate `tours.flex_main_folder_id`, each `tours.flex_<department>_folder_id`, and `tours.flex_estructura_folder_id`.

### Existing tour-root variant

When a tour UUID column already exists, the operation seeds that root into durable state with legacy provenance and adopts it. Canonical children stay suppressed on later reruns beneath an existing department root whose historical child identities are unknown. A missing department root is new work and receives its full canonical children. A department root created by the durable operation also keeps its children in later plans, so adding a new technical department or resuming a partial run creates each missing child exactly once.

The legacy request `{ createRootFolders: true, createDateFolders: false, tourId }` is translated to `tour-root`. The old date-builder request is rejected.

## Tour date

A tour date has no event root of its own. Every date department folder is attached directly to the matching tour department root. Its children follow the same picker rules as a standard job.

```text
Tour name [D-tour]
├── Tour name - Sound [D-tour S]
│   └── T - Sound [DS]                              tourdate
│       └── standard Sound children
├── Tour name - Production [D-tour P]
│   └── T - Production [DP]                         tourdate
│       └── standard Production children
├── Tour name - Personnel [D-tour HR]
│   └── T - Personnel [DHR]                         tourdate
│       └── standard Personnel children
├── Tour name - Comercial [D-tour QT]
│   └── T - Comercial [DQT]                         tourdate
│       └── standard commercial variants
└── Tour name - Estructura [D-tour E]
    └── T - Estructura [DE]                         tourdate
        ├── T - Sonido [DES]                        source=sound
        └── T - Luces [DEL]                         source=lights
```

Lights and Video follow the Sound pattern when selected on the job. Production, Personnel, Comercial, and Estructura remain mandatory date branches. The operation refuses to run if any required tour parent UUID is missing; the tour roots must be created or reconciled first.

When `tour_dates.is_tour_pack_only` is true, the built-in PA pull sheet is removed. The TP sheet remains subject to the usual picker rule. Explicit custom entries can still produce numbered `PS` sheets.

Date rows persist `job_id` and `tour_date_id`. The remote tour parent UUID is resolved to its local `flex_folders.id` before the date row's `parent_id` is written.

The obsolete `Tour → date → department` hierarchy is rejected. The only supported hierarchy is `Tour → department → date → typed child`.

## Dry-hire year and month parents

`dryhire-year` creates two independent annual trees, each with all twelve Spanish month names:

```text
Dry Hire YYYY - Sonido [666.YY]
├── Enero      [666.YY.01]
├── Febrero    [666.YY.02]
├── ...
└── Diciembre  [666.YY.12]

Dry Hire YYYY - Luces  [555.YY]
├── Enero      [555.YY.01]
├── Febrero    [555.YY.02]
├── ...
└── Diciembre  [555.YY.12]
```

Annual roots cover the full UTC calendar year. Month parents cover the exact UTC month, including its actual last day. Annual root UUIDs live only in provisioning-node state; each month UUID is also stored in `dryhire_parent_folders` by `(year, month, department)`.

A new year is resumable node by node. If legacy month rows already exist but no provisioning nodes exist for that year, the operation stops with `Legacy partial dry-hire year requires manual parent reconciliation` because the annual parent UUID cannot be inferred safely.

## Dry-hire job

A dry-hire job uses its pre-created month row as an external parent:

```text
Dry Hire YYYY - Sonido|Luces [666.YY|555.YY]
└── Spanish month [666.YY.MM|555.YY.MM]
    └── Dry Hire - T [YYMMDD + S|L]                  dryhire
        └── Presupuesto - T [YYMMDD + S|L + DH]      dryhire_presupuesto
```

Department resolution is intentionally compatible with the prior behavior: choose Lights only when Lights is selected and Sound is not; otherwise choose Sound. The matching `dryhire_parent_folders` row must exist.

Dates use the job's timezone, falling back to `Europe/Madrid`, as wall-clock values encoded with a trailing `Z`. This preserves Flex's existing dry-hire scheduling contract rather than converting the local wall clock to UTC.

## Festival artist extras

This operation is Sound-only and uses the job's existing Comercial department folder:

```text
T - Comercial [DQT]
└── Extras T - Sonido [DDMMYYESQT]                   comercial_extras
    └── Artist name - Extras [DDMMYY.nSQT]            comercial_presupuesto
```

The server loads the artist and job, verifies their relationship, and requires the local Comercial tracking row. An existing Sound `comercial_extras` row is adopted. Each artist budget receives an atomically allocated per-job ordinal `n`; allocation starts after the current count of `comercial_presupuesto` rows and remains stable when the same operation resumes.

The start time is `artist.show_start`, falling back to `dayStartTime` (default `07:00`). The end time is `artist.show_end`, also falling back to `dayStartTime`. The end date moves to the next day when `isaftermidnight` is true or `show_end` is absent. These are wall-clock values encoded with a trailing `Z`.

## Local tracking catalog

| Remote node | Primary local identity |
| --- | --- |
| Standard root and descendants | `flex_folders.element_id`; rows include `job_id`, department, type, and local `parent_id` |
| Tour root and department roots | `flex_folders.element_id` plus the matching `tours.flex_*_folder_id` column |
| Tour-date nodes | `flex_folders.element_id` with `job_id` and `tour_date_id` |
| Estructura source sheets | `folder_type = pull_sheet`, `department = estructura`, and `source_department = sound\|lights` |
| Crew calls | `flex_folders` plus `flex_crew_calls(job_id, department)` |
| Dry-hire year roots | `flex_provisioning_nodes` only |
| Dry-hire month parents | `dryhire_parent_folders(year, month, department)` plus provisioning state |
| Dry-hire jobs and budgets | `flex_folders`, parented to the month row and then the dry-hire row |
| Artist extras and budgets | `flex_folders`, always with `department = sound` |

Every operation also has one `flex_provisioning_operations` row and stable semantic nodes in `flex_provisioning_nodes`. Important semantic keys include `root`, `department:<department>`, `estructura:source:<department>`, `department:<department>:<child>`, `dryhire`, `dryhire:budget`, and `artist:<artist-id>:budget`. `flex_folders.element_id` is unique; migration cleanup redirects child, status-log, and provisioning-node references to one retained row before removing historical duplicates.

## Durable state and reconciliation variants

Operation states are `planned`, `running`, `partial`, `needs_reconciliation`, `complete`, and `failed`. Node states are `planned`, `creating`, `persisted`, `needs_reconciliation`, and `failed`.

For each node, the executor:

1. Resolves the parent from a preceding semantic node or an authoritative external parent UUID.
2. Writes `creating` before `POST /element`.
3. Records the returned `elementId`, with up to three retries for this local write.
4. Writes the consumer tracking row and its local parent relationship.
5. Marks the node `persisted`.

The resume behavior depends on durable evidence:

| Stored state | Remote UUID | Behavior |
| --- | --- | --- |
| `persisted` | present | Skip the remote write. |
| `creating` or `needs_reconciliation` | present | Adopt the remote element and finish local persistence. |
| `creating` or `needs_reconciliation` | absent | Stop automatic replay because the remote outcome is ambiguous. |
| `failed` | absent | Retry; Flex returned a definite non-timeout 4xx rejection for the previous attempt. |
| No node | absent | Create normally. |

An expired operation lease moves the operation to `needs_reconciliation`. A caller must explicitly send `reconcile: true`; that request transitions and reacquires the lease atomically. Completed scopes may be reacquired so later picker additions can extend the plan, and persisted nodes are skipped. Legacy job and tour-date rows are mapped incrementally on every run: existing semantic nodes reserve their tracking rows, while newly exposed plan keys can still adopt unclaimed legacy rows. Completion is reported only after every requested node is persisted. Artist schedule and count validation run before its lease; sequence or seed failures after acquisition finish as `failed`, which permits a normal retry when no remote write was attempted.

## Deprecated and historical variants

Provisioning does not create Hoja de Información elements. SIP, LIP, and VIP definition UUIDs are blocked by the executor:

```text
702029c3-ba89-4304-98fe-fbc6fc695eb0
4db54bad-b5fa-4c1f-85d4-525d991d7b62
484249f0-6307-47a3-a782-6352ee5ef493
```

The deprecated picker key `hojaInfo` is absent from `SubfolderKey` and is dropped by normalization. Historical remote elements and `flex_folders` rows are retained; date-change readers may recognize them only for compatibility. Hoja de Gastos, Gastos de Personal, Hoja de Ruta, and similarly named accommodation data are separate concepts and remain supported.

The old browser-side folder-creation modules remain as compatibility implementation detail, but active entry points call the authenticated `create-flex-folders` operation. New code must extend the server plan and stable semantic keys instead of introducing another remote writer.

## Request contracts

```ts
{ operation: "job", jobId, options?, reconcile? }
{ operation: "tour-date", jobId, options?, reconcile? }
{ operation: "tour-root", tourId, reconcile? }
{ operation: "dryhire-year", year, reconcile? }
{ operation: "festival-artist-extras", artistId, jobId, dayStartTime?, reconcile? }
```

The server reloads jobs, tours, dates, artists, department selections, ranges, and existing parents from the database. Request payloads are selectors and picker preferences, not authority for entity data or Flex IDs.

## Maintenance map

| Concern | Source |
| --- | --- |
| Operation routing, tour roots, dry hire, artist extras | `supabase/functions/create-flex-folders/index.ts` |
| Standard job and tour-date plan | `supabase/functions/_shared/flex-folders/jobPlan.ts` |
| Tour-root plan and legacy child policy | `supabase/functions/_shared/flex-folders/tourPlan.ts` |
| Node execution and forbidden definitions | `supabase/functions/_shared/flex-folders/engine.ts` |
| Shared durable node-state transitions | `supabase/functions/_shared/flex-folders/store.ts` |
| Roles by operation | `supabase/functions/_shared/flex-folders/access.ts` |
| Picker schema and normalization | `src/utils/flex-folders/types.ts` |
| Flex definitions, departments, suffixes, responsible people | `src/utils/flex-folders/constants.ts` |
| Durable state schema and lease functions | `supabase/migrations/20260908113000_add_flex_provisioning_state.sql` |
| Runtime overview and rollout | `docs/flex-folder-workflows.md` |

Any change to a name, suffix, parent, option, tracking identity, or legacy rule must update this catalog and the corresponding planner tests in the same change.
