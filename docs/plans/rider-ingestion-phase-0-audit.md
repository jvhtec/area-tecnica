# Rider Ingestion — Phase 0 Audit

**Status:** Complete  
**Repository:** `jvhtec/area-tecnica`  
**Audited ref:** `main` at `38479addf0ebae774a58651c98f804309bf6d423`  
**Purpose:** Ground the local AI rider-ingestion project in the current Área Técnica implementation before schema or runtime work begins.

## Executive summary

Área Técnica already has the core domain pieces needed for a reviewable rider-ingestion system:

- `festival_artists` is the structured, human-readable planning source for artist technical requirements.
- `festival_artist_files` is the canonical rider/document metadata table backed by Supabase Storage.
- The rider library already connects historical rider files to source artists/jobs and supports shared storage references across imported copies.
- Many historical rider files have corresponding human-entered `festival_artists` values, giving the project a useful weakly supervised evaluation dataset.
- The public artist form already defines most of the technical vocabulary the extractor should target.

The new ingestion layer should therefore be an interpretation/audit layer around the existing model, not a replacement for rider storage or artist planning data:

```text
festival_artist_files
        ↓
rider_ingestions
        ↓
reviewed extraction
        ↓
explicit apply
        ↓
festival_artists
```

The AI worker must never directly mutate `festival_artists`. All model output is untrusted input and must pass through schema validation, normalization, human review, and a deterministic allowlisted apply operation.

## Existing artist domain

The existing artist architecture treats `festival_artists` as the primary roster record for one artist/date/stage and explicitly states that rider files are artifacts attached to artist context, not substitutes for structured planning data.

### Identity and scheduling

Current artist fields include:

- `id`
- `job_id`
- `name`
- `stage`
- `date`
- `show_start`
- `show_end`
- `soundcheck`
- `soundcheck_start`
- `soundcheck_end`
- `line_check`
- `line_check_start`
- `line_check_end`
- `load_in_time`
- `isaftermidnight`

The festival UI model is stricter than the generated Supabase types in several places. New ingestion code must use generated DB types and explicit schemas rather than copying UI nullability assumptions.

Scheduling fields should not be part of RiderExtractionV1. They are promoter/festival schedule facts as often as rider facts, so v1 should avoid trying to auto-apply them.

## FOH domain

Current FOH fields include:

- `foh_console`
- `foh_console_provided_by`
- `foh_drive`
- `foh_drive_position`
- `foh_tech`
- `foh_waves_models`
- `foh_waves_provided_by`
- `foh_outboard`

Database constraints currently enforce:

```text
foh_drive:
  l_r
  l_r_sub_ff
  other

foh_drive_position:
  foh
  sl
  sr
```

The extraction contract should preserve raw rider evidence but normalize any approved value to these canonical enums before persistence.

Example:

```text
Rider: "L/R + SUBS + FF"
Raw extraction: "L/R + SUBS + FF"
Normalized candidate: foh_drive = "l_r_sub_ff"
```

## Monitor domain

Current monitor fields include:

- `mon_console`
- `mon_console_provided_by`
- `mon_position`
- `monitors_from_foh`
- `mon_waves_models`
- `mon_waves_provided_by`
- `mon_outboard`
- `mon_tech`
- `monitors_enabled`
- `monitors_quantity`

`mon_position` is constrained to `sl` or `sr`.

The existing public-form apply logic contains important domain behavior: when `monitors_from_foh = true`, monitor-console-specific values are cleared/reset rather than treated as independent values. The ingestion apply layer must preserve this relationship. It must not blindly map individually approved JSON properties straight into a Supabase update.

## Provider enum correction

The canonical database enum is:

```text
festival
band
mixed
```

This applies to:

- `foh_console_provided_by`
- `foh_waves_provided_by`
- `mon_console_provided_by`
- `mon_waves_provided_by`
- `wireless_provided_by`
- `iem_provided_by`
- `infrastructure_provided_by`

The original conceptual PRD used `artist`/`unknown` in some examples. Those must not be persisted. The extraction contract should use:

```ts
"festival" | "band" | "mixed" | null
```

where `null` means unresolved.

## RF and IEM domain

The current canonical representation is structured JSON, not a single count.

Existing wireless/IEM objects support:

```ts
{
  model: string;
  quantity?: number;
  quantity_hh?: number;
  quantity_bp?: number;
  quantity_ch?: number;
  band?: string;
  provided_by?: "festival" | "band" | "mixed";
  notes?: string;
}
```

Existing canonical model lists and normalizers should be reused. Do not introduce a parallel equipment dictionary in the ingestion feature.

RiderExtractionV1 should therefore extract structured `wireless_systems` and `iem_systems`; totals can be derived later.

The legacy/null `wireless_quantity` column still exists and may need compatibility maintenance for downstream consumers, but it must not become the new extractor source of truth.

## Waves domain

Waves requirements are also structured JSON. The existing canonical shape is effectively:

```ts
{
  model:
    | "server_one"
    | "extreme"
    | "titan"
    | "livebox"
    | "fourier"
    | "axis_one"
    | "axis_scope";
  quantity: number;
}
```

Existing code already normalizes legacy forms, validates model IDs, coerces quantities and merges duplicates. Rider ingestion must reuse those normalizers.

## Infrastructure domain

Current structured infrastructure fields:

- `infra_cat6`
- `infra_cat6_quantity`
- `infra_hma`
- `infra_hma_quantity`
- `infra_coax`
- `infra_coax_quantity`
- `infra_opticalcon_duo`
- `infra_opticalcon_duo_quantity`
- `infra_analog`
- `other_infrastructure`
- `infrastructure_provided_by`

These fields appear consistently across the public artist form, internal artist data and existing planning views. They are excellent RiderExtractionV1 candidates.

## Extras domain

Existing extras:

- `extras_sf`
- `extras_df`
- `extras_djbooth`
- `extras_wired`

These are consistently represented in the public form and artist table and should be included in v1.

## Microphone domain

Current artist data includes:

- `mic_kit`
- `wired_mics`

`mic_kit` uses the existing `festival | band | mixed` provider model.

`wired_mics` is structured JSON resembling:

```ts
{
  model: string;
  quantity: number;
  exclusive_use?: boolean;
  notes?: string;
}
```

Do not include full microphone/input-list extraction in RiderExtractionV1. Reserve it for a separately benchmarked phase.

## Rider freshness semantics

Existing freshness fields:

- `rider_missing`
- `rider_outdated`
- `rider_copied_from_date`
- `rider_outdated_dismissed`

Current authenticated and public upload flows clear stale state when a new/current rider is uploaded.

Creating or completing an ingestion must **not** change rider freshness. The file upload remains authoritative for freshness; ingestion only interprets an already-existing file.

## Rider file domain

`festival_artist_files` is already the correct artifact table. Current metadata includes at least:

- `id`
- `artist_id`
- `file_name`
- `file_path`
- `file_type`
- `file_size`
- `uploaded_by`
- `uploaded_at`

`artist_id` is nullable at DB level.

No second rider-library table is needed.

## Shared-storage import behavior

The rider-library import RPC can create a new target artist while reusing existing rider `file_path` values. Multiple metadata rows can therefore intentionally reference the same physical storage object.

Deletion logic already accounts for this by locking the path, deleting one metadata reference, then reporting whether the underlying object has any remaining references.

### Consequence for ingestion

A new ingestion should reference the specific metadata row with `file_id`, but also preserve immutable source metadata such as:

- `source_file_path`
- `source_file_name`

Evaluation and deduplication must use `file_path`, not only `file_id`, or the same physical rider may be benchmarked several times through imported copies.

## Historical dataset quality

Historical rows are useful labels but not unquestionable ground truth. Values may have been manually inferred, operationally corrected or copied from an older rider.

Recommended initial automated corpus filters:

```text
file_type = application/pdf
rider_missing = false
rider_outdated = false
rider_copied_from_date IS NULL
```

Then deduplicate by `file_path`.

The first 50–100 candidates should be manually tagged as:

```text
gold
silver
exclude
```

This gives the local worker a representative benchmark without pretending every old row is perfect truth.

## Public artist form as canonical extraction vocabulary

The public artist form already collects nearly every v1 technical field:

- FOH console and drive
- FOH Waves/outboard
- monitor console/position
- monitors from FOH
- monitor Waves/outboard
- wireless systems
- IEM systems
- monitor wedges
- extras
- CAT6/HMA/coax/OpticalCON/analog infrastructure
- notes
- mic kit / wired mics

The current submit path uses a controlled field-by-field database mapping with enum casts, null handling and monitor-domain rules.

Rider ingestion should copy this **architecture**, not necessarily this exact function:

```text
untrusted structured input
        ↓
validate
        ↓
normalize
        ↓
explicit allowlisted mapping
        ↓
domain rules
        ↓
artist update
```

Never implement:

```ts
supabase.from("festival_artists").update(extraction)
```

## Multi-console persistence drift

The React/public form model contains `foh_consoles` and `mon_consoles`, and the form context can load/lock these arrays.

However, the latest inspected `submit_public_artist_form` redefinition persists the scalar `foh_console` / `mon_console` values and does not explicitly assign the multi-console arrays in the update body.

This is pre-existing UI/database-path drift.

### Decision

Do not include `foh_consoles` / `mon_consoles` in RiderExtractionV1. Use scalar console fields for v1 and address multi-console persistence in a separate fix/audit.

## Permission audit

This is the most important Phase 0 correction.

### Frontend helper

`canManageFestivalArtists()` currently allows:

- admin
- management
- logistics
- technician
- house_tech

This helper is broad because it controls festival-management access, not actual DB mutation rights.

### Current `festival_artists` SELECT RLS

Read access is allowed to:

- admin
- management
- logistics
- house_tech
- assigned technicians for their assigned jobs

### Current `festival_artists` INSERT / UPDATE RLS

Write access is allowed to:

- admin
- management
- house_tech

### Current DELETE RLS

Delete is allowed to:

- admin
- management

### Required ingestion capabilities

Do not reuse `canManageFestivalArtists()` as the ingestion authority.

Add explicit capabilities:

```text
canViewRiderExtraction
  admin
  management
  logistics
  house_tech
  assigned technician

canRequestRiderAnalysis
  admin
  management
  logistics
  house_tech

canReviewRiderExtraction
  admin
  management
  logistics
  house_tech

canApplyRiderExtraction
  admin
  management
  house_tech
```

The server/RLS layer remains authoritative regardless of frontend helpers.

## Rider file permissions

Current rider metadata/storage policy is broadly:

### SELECT

- admin
- management
- logistics
- house_tech
- assigned technician

### INSERT / UPDATE / DELETE

- admin
- management
- logistics
- house_tech

The new `rider_ingestions` read/request/review policy can mirror this model, while applying extraction must remain limited to roles with actual artist update permission.

## Existing upload flows

### Authenticated internal upload

`ArtistFileDialog.tsx` currently handles:

```text
validate
→ optional image optimization
→ upload storage object
→ insert festival_artist_files metadata
→ clear rider freshness
→ refresh file list
```

This is the correct UI location for future `Analyze rider` and `Review extraction` actions. Do not duplicate upload behavior.

### Public token upload

`upload-public-artist-rider` already implements token validation, expiration checks, file limits, MIME/extension validation, rate limiting, artist-scoped storage paths, storage/metadata verification, notification and freshness updates.

Current code allows up to 50 MB per file and 10 files per request. Do not copy older documentation that still mentions 25 MB.

## Data-layer conventions

Existing artist mutations use:

- TanStack `useMutation`
- generated Supabase `Insert`/`Update` types
- centralized query keys
- invalidation by query-key scope
- explicit offline behavior

Rider ingestion should follow the same generated-type and query-key conventions.

Recommended query-key family:

```text
rider-ingestions
rider-ingestion
```

scoped through the existing query-key utilities.

## Offline behavior

Festival artist editing has a browser-offline queue/snapshot system.

Rider AI ingestion should **not** participate in browser-offline mutation queueing in v1.

Recommended behavior:

- disable/unavailable `Analyze rider` while offline;
- existing completed extraction can remain read-only if already cached later;
- do not queue inference requests in the browser offline subsystem.

The worker itself requires Supabase connectivity even though inference runs locally.

## Migration/test conventions

Relevant database work currently follows:

- additive timestamped migrations;
- `DROP POLICY IF EXISTS` / `CREATE POLICY` patterns;
- explicit grants/revokes;
- `SECURITY DEFINER` functions with pinned search paths when elevated behavior is required;
- forward-fix migrations rather than rewriting old history;
- pgTAP tests in `supabase/tests/database`.

The rider-library pgTAP suite already tests function signatures, execution grants, role behavior and real fixture semantics. New ingestion database tests should follow that style.

## Refined `rider_ingestions` proposal

Recommended first schema:

```text
id uuid primary key
artist_id uuid not null
file_id uuid null
source_file_path text not null
source_file_name text not null
status text not null
schema_version integer not null
worker_id text null
worker_version text null
model_name text null
model_version text null
raw_extraction jsonb null
normalized_extraction jsonb null
reviewed_extraction jsonb null
error_code text null
error_message text null
created_by uuid not null
reviewed_by uuid null
applied_by uuid null
attempt_count integer not null default 0
created_at timestamptz not null default now()
started_at timestamptz null
completed_at timestamptz null
reviewed_at timestamptz null
applied_at timestamptz null
updated_at timestamptz not null default now()
```

Recommended status values:

```text
queued
processing
review
applied
rejected
failed
cancelled
```

### Foreign keys

Recommended:

```text
artist_id → festival_artists(id) ON DELETE CASCADE
file_id   → festival_artist_files(id) ON DELETE SET NULL
```

The ingestion is an audit artifact. Deleting a file-reference row should not silently erase analysis history, so immutable source metadata must be retained.

## Refined RiderExtractionV1 scope

### Identity evidence only

- artist name evidence

Do not auto-update artist identity in v1.

### FOH

- `foh_console`
- `foh_console_provided_by`
- `foh_drive`
- `foh_drive_position`
- `foh_waves_models`
- `foh_outboard`
- `foh_waves_provided_by`
- `foh_tech`

### Monitors

- `monitors_from_foh`
- `mon_console`
- `mon_console_provided_by`
- `mon_position`
- `mon_waves_models`
- `mon_outboard`
- `mon_waves_provided_by`
- `mon_tech`

### RF/IEM

- `wireless_systems`
- `wireless_provided_by`
- `iem_systems`
- `iem_provided_by`

### Wedges

- `monitors_enabled`
- `monitors_quantity`

### Extras

- `extras_sf`
- `extras_df`
- `extras_djbooth`
- `extras_wired`

### Infrastructure

- `infra_cat6`
- `infra_cat6_quantity`
- `infra_hma`
- `infra_hma_quantity`
- `infra_coax`
- `infra_coax_quantity`
- `infra_opticalcon_duo`
- `infra_opticalcon_duo_quantity`
- `infra_analog`
- `other_infrastructure`
- `infrastructure_provided_by`

### Misc

- `notes`

## Explicitly deferred from V1

- date/stage/show schedule
- soundcheck/line-check/load-in schedule
- `isaftermidnight`
- crew
- stage plot interpretation
- `mic_kit`
- `wired_mics`
- input-list/channel-list extraction
- `foh_consoles`
- `mon_consoles`

## Existing `artist_external_metadata`

The schema already includes an `artist_external_metadata` domain with normalized/display artist names, match status/confidence, Wikidata/Wikipedia metadata and related identity information.

Future blind rider ingestion must reuse that existing identity/matching subsystem rather than creating another artist-name normalization layer.

It is not required for RiderExtractionV1.

## Required corrections to the original project concept

1. Persist provider values only as `festival | band | mixed`; unresolved values remain `null`.
2. Extract structured RF/IEM arrays rather than treating quantities as the primary representation.
3. Reuse existing Waves and wireless normalizers.
4. Add explicit rider-ingestion permission helpers instead of reusing `canManageFestivalArtists()`.
5. Preserve immutable source file metadata and prefer `file_id ON DELETE SET NULL`.
6. Deduplicate evaluation cases by physical `file_path`.
7. Exclude copied/outdated rider rows from the initial gold dataset.
8. Keep multi-console arrays out of v1 until the existing persistence drift is resolved.
9. Keep ingestion separate from rider freshness semantics.
10. Do not integrate inference requests into browser-offline queueing in v1.

## Phase 0 conclusion

There is no architectural blocker to Phase 1.

The key constraint is that `festival_artists` is already a real domain model with structured JSON, enum constraints, role boundaries, freshness semantics and cross-field behavior. The ingestion system must therefore produce **reviewable proposals**, while a deterministic server-side application layer remains responsible for turning approved proposals into valid artist updates.

Phase 1 can begin without the Mac worker, local model, OCR stack or Cloudflare Tunnel.