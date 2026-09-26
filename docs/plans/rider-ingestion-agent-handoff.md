# Coding Agent Handoff — Rider Ingestion Phase 1

## Mission

Implement the **application-side foundation** for local AI-assisted rider ingestion in `jvhtec/area-tecnica`.

Do not implement local inference yet. The Mac mini M4, OCR/model stack and Cloudflare Tunnel will be added later after the Área Técnica domain contract is stable.

Read these documents first, in order:

1. `docs/plans/rider-ingestion-phase-0-audit.md`
2. `docs/plans/rider-ingestion-roadmap.md`
3. this handoff

The Phase 0 audit is authoritative where it corrects assumptions from earlier planning.

## Product intent

A rider file already associated with an existing `festival_artists` row will eventually be analyzed by a local Mac worker. The worker will return structured technical proposals plus source evidence. A human reviews those proposals and explicitly approves changes. Only a deterministic server-side apply operation may update `festival_artists`.

Core invariant:

```text
model output != database update
```

Target flow:

```text
festival_artist_files
        ↓
rider_ingestions
        ↓
local worker later
        ↓
validated extraction
        ↓
human review
        ↓
allowlisted apply operation
        ↓
festival_artists
```

## Scope for the next implementation PR

Implement **Phase 1 only**.

Required:

1. `rider_ingestions` database migration.
2. RLS/grants for read/request/review/apply boundaries.
3. pgTAP coverage.
4. generated Supabase type refresh.
5. versioned `RiderExtractionV1` Zod contract.
6. deterministic normalization/application domain interfaces.
7. ingestion query-key + query/mutation foundation.
8. `Analyze rider` action for supported PDF files that creates a queued ingestion.
9. status retrieval/display sufficient to prove the domain works.
10. documentation of the future worker contract.

Optional only if it remains small and clean:

- a mocked completed extraction fixture or dev/test helper to prove that Phase 2 can consume the schema.

Do **not** implement the full review UI in this PR unless it is trivial after the domain work. The roadmap intentionally separates Phase 1 foundation from Phase 2 review UX.

## Explicit non-goals

Do not add:

- OpenAI API;
- Mistral API;
- Anthropic API;
- any paid inference service;
- local model runtime;
- Docling/PaddleOCR dependencies to the React repository;
- Mac worker code;
- Cloudflare Tunnel code;
- blind artist matching/creation;
- microphone/input-list extraction;
- stage-plot interpretation;
- Flex changes;
- automatic artist mutation from model output;
- browser-offline inference queueing.

## Required repo audit before editing

Before changing files, verify the current implementation around:

- `src/components/festival/ArtistFileDialog.tsx`
- `src/components/festival/artistTableTypes.ts`
- `src/components/festival/artistRequirementsFormModel.ts`
- `src/hooks/useArtistMutations.ts`
- `src/features/festival-management/queries.ts`
- `src/features/festival-management/types.ts`
- `src/utils/permissions.ts`
- `src/types/festival-equipment.ts`
- `src/constants/wavesModels.ts`
- generated Supabase types
- `supabase/migrations/20260706130000_rider_library_import.sql`
- `supabase/migrations/20260708120000_fix_rider_file_access_policies.sql`
- `supabase/migrations/20260701120000_align_festival_artist_mutation_policies.sql`
- `supabase/migrations/20260904161000_close_anonymous_catalog_reads.sql`
- current public artist form submit RPC definition
- `supabase/tests/database/rider_library_import.sql`

If the repo has changed since Phase 0, update the implementation to current reality rather than forcing the audit's exact file shape.

## Database design

Create an additive timestamped migration for `public.rider_ingestions`.

Recommended columns:

```sql
id uuid primary key default gen_random_uuid(),
artist_id uuid not null,
file_id uuid null,
source_file_path text not null,
source_file_name text not null,
status text not null,
schema_version integer not null,
worker_id text null,
worker_version text null,
model_name text null,
model_version text null,
raw_extraction jsonb null,
normalized_extraction jsonb null,
reviewed_extraction jsonb null,
error_code text null,
error_message text null,
created_by uuid not null,
reviewed_by uuid null,
applied_by uuid null,
attempt_count integer not null default 0,
created_at timestamptz not null default timezone('utc', now()),
started_at timestamptz null,
completed_at timestamptz null,
reviewed_at timestamptz null,
applied_at timestamptz null,
updated_at timestamptz not null default timezone('utc', now())
```

Use existing repo conventions for UUID/default/timestamps if they differ.

Recommended FKs:

```text
artist_id → festival_artists(id) ON DELETE CASCADE
file_id   → festival_artist_files(id) ON DELETE SET NULL
created_by/reviewed_by/applied_by → profiles(id) where consistent with repo conventions
```

Preserve `source_file_path` and `source_file_name` even if `file_id` later becomes null. Historical imports can create several metadata rows referencing one physical rider file.

## Status constraint

Allowed initial statuses:

```text
queued
processing
review
applied
rejected
failed
cancelled
```

Use a CHECK constraint or enum according to current repo migration conventions. A simple CHECK is acceptable if adding a Postgres enum would create unnecessary lifecycle friction.

Validate `schema_version > 0` and `attempt_count >= 0`.

Add useful indexes for at least:

- artist/status/history lookup;
- file lookup;
- queued work discovery;
- recent ingestion history.

Do not prematurely over-index.

## Creation semantics

The browser must not insert arbitrary worker/result fields.

Prefer a small RPC such as conceptually:

```text
create_rider_ingestion(p_artist_id, p_file_id)
```

that:

1. verifies caller authorization;
2. verifies `file_id` belongs to `artist_id`;
3. verifies the referenced file is a supported PDF for v1;
4. snapshots `file_path` and `file_name` into the ingestion;
5. inserts status `queued`;
6. records `created_by = auth.uid()`;
7. sets `schema_version = 1`;
8. returns the created row/ID.

This is preferred over letting the browser directly populate the durable ingestion row.

If a direct insert with strong RLS/checks is demonstrably cleaner in the existing architecture, document why. Do not weaken invariants for convenience.

## Re-analysis semantics

Multiple analysis attempts for the same artist/file must be allowed. Do not add a permanent unique constraint on `(artist_id, file_id)`.

Future model/schema upgrades need re-analysis capability.

The UI should display the latest ingestion for a given file but historical runs should remain queryable.

## Permission model

Do not reuse `canManageFestivalArtists()` as authority.

Add explicit application helpers, with names close to:

```ts
canViewRiderExtraction(role, assignmentContext?)
canRequestRiderAnalysis(role)
canReviewRiderExtraction(role)
canApplyRiderExtraction(role)
```

Recommended roles:

### View

- admin
- management
- logistics
- house_tech
- assigned technician where DB read policy allows

### Request

- admin
- management
- logistics
- house_tech

### Review

- admin
- management
- logistics
- house_tech

### Apply

- admin
- management
- house_tech

The DB layer is authoritative.

For Phase 1, if assigned-technician-aware read logic is awkward because the query is file/artist scoped, mirror the existing `festival_artists` / `festival_artist_files` RLS through an `EXISTS` join rather than weakening access globally.

## RLS expectations

At minimum, pgTAP should prove:

- anon cannot read ingestion rows;
- anon cannot create ingestion rows;
- unrelated technician cannot read another job's ingestion;
- assigned technician can read where intended;
- logistics can read/request but cannot apply to artist;
- house tech can request/review/apply;
- management/admin can request/review/apply;
- ordinary authenticated callers cannot write worker-only fields directly;
- browser/user roles cannot impersonate worker completion.

If worker mutations are not implemented in Phase 1, reserve them for service-role/server-only access and document the intended contract.

## RiderExtractionV1 contract

Create a shared, versioned schema in an appropriate domain location. Do not bury it inside a React component.

Suggested conceptual types:

```ts
type ExtractionConfidence = "high" | "medium" | "low" | "none";

type ExtractedEvidence = {
  page?: number | null;
  section?: string | null;
  text: string;
};

type ExtractedField<T> = {
  value: T | null;
  confidence: ExtractionConfidence;
  evidence: ExtractedEvidence[];
};
```

Every string/evidence collection must have reasonable maximum lengths/counts to prevent an untrusted model from returning effectively unbounded JSON.

Reject unknown object keys unless there is a strong compatibility reason not to.

### Provider value

Persistable provider values are only:

```text
festival
band
mixed
```

Unresolved extraction is `null`.

Do not introduce `artist` or `unknown` as DB values.

## RiderExtractionV1 field scope

Implement schema support for:

### FOH

- console
- console provided by
- drive
- drive position
- Waves models
- outboard
- Waves provided by
- FOH tech requirement

### Monitors

- monitors from FOH
- monitor console
- provided by
- position
- Waves models
- outboard
- Waves provided by
- monitor tech requirement

### Wireless/IEM

Use structured system arrays compatible with the existing `WirelessSystem` / `IEMSystem` domain. Do not flatten the primary schema to only totals.

### Wedges

- monitors enabled
- monitors quantity

### Extras

- side fill
- drum fill
- DJ booth
- extra wired requirement

### Infrastructure

- CAT6 presence/quantity
- HMA presence/quantity
- coax presence/quantity
- OpticalCON Duo presence/quantity
- analog quantity
- other infrastructure
- provided by

### Misc

- notes
- artist name evidence, read-only/non-applied in v1

## Reuse existing normalizers

Do not create duplicate dictionaries for:

- Waves models;
- wireless systems;
- IEM systems;
- provider enums.

Reuse/adapt existing normalization utilities where appropriate.

If current normalizers are UI-oriented and awkward to reuse server-side, extract/refactor the pure logic into a shared module rather than duplicating it.

## Deterministic application contract

Phase 1 should define the mapper boundary even if full review/apply UI lands in Phase 2.

Design an explicit semantic mapping from `RiderExtractionV1` approved fields to `festival_artists` updates.

Never spread extraction JSON into `.update()`.

The mapper must be capable of preserving cross-field rules, especially:

```text
monitors_from_foh = true
```

which affects monitor console/position/Waves/outboard state.

The final apply operation should later reload current artist state at apply time to avoid silently overwriting edits made while an extraction was being reviewed.

## Analyze action

Extend the existing rider file UI rather than adding a parallel upload surface.

`ArtistFileDialog.tsx` should show `Analyze rider` only when:

- file is a supported PDF;
- user can request analysis;
- browser is online;
- there is not already an active queued/processing ingestion for the same file unless retry semantics intentionally allow it.

Clicking it should create a queued ingestion and update status through existing query invalidation patterns.

Do not send file bytes anywhere in Phase 1.

## UI status

At minimum represent:

```text
Not analyzed
Queued
Processing
Review ready
Applied
Failed
Cancelled
```

Phase 1 does not need the full review diff UI.

## Offline behavior

Do not add rider-ingestion requests to the existing festival offline mutation queue.

When offline:

- disable or hide Analyze action with a clear reason;
- do not create local synthetic ingestion IDs;
- do not pretend the local AI worker is available simply because inference will eventually be local.

## Worker contract documentation

Add or extend docs so the future worker knows exactly what it may do.

Future worker responsibilities:

1. discover/receive queued ingestion ID;
2. atomically claim it;
3. download `source_file_path` directly from Supabase Storage;
4. parse/OCR locally;
5. run local model;
6. validate extraction against schema version;
7. write raw + normalized extraction;
8. transition to `review` or `failed`;
9. never modify `festival_artists`.

Worker identity/model/version fields are server-only metadata.

## Historical evaluation implications

Do not build the evaluator in Phase 1, but preserve the data needed for it.

Future corpus selection will:

- filter current/non-outdated human-extracted rows;
- prefer PDFs;
- deduplicate by `source_file_path`;
- compare normalized extraction against human-entered artist values.

Do not remove raw extraction after normalization, because debugging benchmark failures requires both.

## Expected code locations

Use current architecture judgment, but likely changes include some subset of:

```text
supabase/migrations/<timestamp>_add_rider_ingestions.sql
supabase/tests/database/rider_ingestions.sql
src/integrations/supabase/types.ts (regenerated)
src/features/rider-ingestion/* or equivalent domain folder
src/lib/react-query.ts / query-key registry
src/utils/permissions.ts
src/components/festival/ArtistFileDialog.tsx
```

Do not force all logic into existing festival god-components. Prefer a cohesive rider-ingestion feature/domain module.

## Required tests

### Database

Test:

- table/schema constraints;
- foreign key behavior;
- `file_id ON DELETE SET NULL` while immutable source metadata remains;
- role-specific SELECT;
- role-specific create/request;
- browser cannot mutate protected result/worker fields;
- creation RPC rejects mismatched artist/file;
- creation RPC rejects unsupported file type;
- multiple historical/re-analysis rows are allowed;
- anon is denied.

### Type/schema tests

Test:

- valid complete extraction;
- partial/null extraction;
- invalid provider enum;
- invalid FOH drive enum;
- negative quantities;
- malformed arrays;
- unknown keys;
- evidence size limits;
- oversized notes/evidence rejection or truncation policy, whichever is explicitly chosen.

### Frontend

Test:

- Analyze action only for PDFs;
- Analyze disabled/unavailable offline;
- permission gating;
- queued status after request;
- active ingestion prevents accidental duplicate click if that is the chosen UX;
- failed/latest status renders correctly.

## Migration safety

This is additive schema work and should have a straightforward rollback path, but follow repository production migration conventions.

Before merge/deploy:

- run migration ordering checks;
- run Supabase DB lint;
- run pgTAP/RLS security tests;
- run linked dry-run if the repo's production checklist requires it;
- do not edit historical migrations.

## Validation commands

Use the repo's current canonical scripts rather than assuming stale names. At minimum run the equivalents of:

```text
npm run lint
npm run typecheck
npm run test:critical
npm run test:run
npm run build
npm run ci:db:migrations
npm run governance
```

Plus targeted database tests for the new ingestion migration and any security gates used by the repository.

## PR quality bar

The implementation PR must include:

- concise architecture summary;
- migration/RLS impact;
- exact roles granted each action;
- test evidence;
- rollout order if any Edge/RPC deployment is involved;
- rollback/forward-fix note;
- explicit statement that no paid AI or model runtime is included.

## Stop conditions

Stop and report instead of improvising if any of these are true:

1. The actual production schema has materially diverged from generated types/current migrations.
2. Current RLS makes the recommended role split impossible without changing broader festival access semantics.
3. Existing multi-console persistence was fixed after Phase 0 in a way that materially changes RiderExtractionV1.
4. A proposed migration would require destructive changes to `festival_artists` or `festival_artist_files`.
5. The implementation would require exposing service-role credentials to the browser.
6. A paid external inference dependency appears necessary. It is not acceptable for this project.

Do not stop for minor naming/layout decisions. Make the smallest repo-consistent choice and document it.

## Definition of Done for Phase 1

Phase 1 is done when:

- `rider_ingestions` exists with durable history and source metadata;
- RLS/grants match intended permissions;
- creation is safe and linked to the correct artist/file;
- repeated future analyses remain possible;
- schema versioning exists;
- `RiderExtractionV1` is strict and tested;
- model output cannot be confused with a database patch;
- Analyze Rider can create a queued ingestion from an existing PDF;
- status can be retrieved/rendered;
- no artist values change as part of analysis request;
- no paid inference/model/Cloudflare code exists yet;
- DB, TypeScript, tests, build, governance and security gates pass.

## Handoff result expected from the coding agent

At completion, report:

1. exact files changed;
2. migration/RLS design;
3. extraction schema summary;
4. permission matrix actually implemented;
5. tests added and results;
6. deviations from this plan and why;
7. any pre-existing bugs uncovered but intentionally left out of scope;
8. exact recommended Phase 2 starting point.

Keep the PR focused. The purpose of Phase 1 is to make the eventual Mac worker boring to integrate, not to solve every rider problem in one heroic branch.