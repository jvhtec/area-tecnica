# Local Rider Ingestion — Product & Implementation Roadmap

**Product:** Área Técnica  
**Primary application:** `jvhtec/area-tecnica`  
**Planned local worker:** separate Mac mini M4 service  
**Inference requirement:** zero paid API usage  
**Current status:** Phase 0 complete; Phase 1 ready to implement

## 1. Goal

Build a private, zero-recurring-cost rider-ingestion system that reads technical rider documents locally, proposes structured technical requirements, shows evidence for each proposal, and applies only explicitly approved fields to `festival_artists`.

The long-term product should evolve from PDF extraction into a technical rider knowledge system capable of understanding how an artist's requirements change over time.

## 2. Product principles

### Human authority

AI output is advisory. No model writes directly to `festival_artists`, Flex, jobs or rider storage metadata.

### Evidence before confidence

Every proposed value should retain source evidence where possible:

```ts
{
  value: "DiGiCo Quantum 338",
  confidence: "high",
  evidence: [
    {
      page: 7,
      section: "Monitor requirements",
      text: "Monitor console: DiGiCo Quantum 338"
    }
  ]
}
```

Model-generated percentage confidence must not be treated as authoritative. Confidence should be derived from deterministic evidence rules wherever practical.

### Supabase remains source of truth

The Mac is compute, not authority. Supabase owns ingestion state, rider references, artist data, reviewed extraction, audit history and final applied state.

### Local inference only

No paid OpenAI, Anthropic, Mistral or other hosted model dependency. The target is an always-on Mac mini M4 running a small local model through MLX or an equivalent Apple-Silicon-native stack.

### Worker failure must be boring

If the Mac is offline, jobs stay queued. If it restarts, unfinished jobs can be recovered. A model failure must never corrupt artist data.

## 3. Target end-to-end architecture

```text
Área Técnica
   │
   │ create ingestion
   ▼
Supabase
rider_ingestions
   │
   │ queued work
   ▼
Mac mini M4 worker
   │
   ├── download rider from Supabase Storage
   ├── parse digital PDF
   ├── OCR fallback where required
   ├── local model extraction
   ├── schema validation
   ├── deterministic normalization
   └── write result/status to Supabase
   │
   ▼
Área Técnica review UI
   │
   ├── current value
   ├── proposed value
   ├── evidence
   └── accept/reject per field
   │
   ▼
secure deterministic apply operation
   │
   ▼
festival_artists
```

Cloudflare Tunnel is an optional later control plane. The worker must retain a Supabase queue path so Tunnel availability is never required for job durability.

## 4. Initial user flow

V1 should begin from a rider already associated with an existing artist:

```text
Artist
  ↓
Manage files
  ↓
Rider PDF
  ↓
Analyze rider
  ↓
queued / processing
  ↓
Review extraction
  ↓
Current | Proposed | Evidence
  ↓
Select approved changes
  ↓
Apply
```

Blind ingestion of an arbitrary PDF into a newly identified/created artist is deliberately deferred.

## 5. RiderExtractionV1 scope

The extraction schema must be versioned and validated.

### Identity evidence

- artist name as evidence/validation only

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

### Explicitly deferred

- scheduling/date/stage
- load-in/soundcheck/line-check times
- crew
- stage-plot interpretation
- mic/input-list extraction
- `foh_consoles` / `mon_consoles`
- artist creation/matching

## 6. Data model

Introduce `rider_ingestions` with durable state and audit information.

Recommended shape:

```text
id uuid PK
artist_id uuid NOT NULL
file_id uuid NULL
source_file_path text NOT NULL
source_file_name text NOT NULL
status text NOT NULL
schema_version integer NOT NULL
worker_id text NULL
worker_version text NULL
model_name text NULL
model_version text NULL
raw_extraction jsonb NULL
normalized_extraction jsonb NULL
reviewed_extraction jsonb NULL
error_code text NULL
error_message text NULL
created_by uuid NOT NULL
reviewed_by uuid NULL
applied_by uuid NULL
attempt_count integer NOT NULL DEFAULT 0
created_at timestamptz NOT NULL DEFAULT now()
started_at timestamptz NULL
completed_at timestamptz NULL
reviewed_at timestamptz NULL
applied_at timestamptz NULL
updated_at timestamptz NOT NULL DEFAULT now()
```

Statuses:

```text
queued
processing
review
applied
rejected
failed
cancelled
```

Recommended relationships:

```text
artist_id → festival_artists(id) ON DELETE CASCADE
file_id   → festival_artist_files(id) ON DELETE SET NULL
```

Physical source identity is retained separately because historical rider imports may create several metadata rows pointing to one `file_path`.

## 7. Extraction field model

Use a shared envelope such as:

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

The application-side Zod schema is authoritative for accepted structure. Unexpected keys, invalid enum values, excessive strings, malformed arrays and invalid quantities must be rejected.

## 8. Permissions

Use dedicated permissions rather than `canManageFestivalArtists()`.

Recommended capabilities:

```text
canViewRiderExtraction
  admin, management, logistics, house_tech,
  assigned technician where DB read rules allow

canRequestRiderAnalysis
  admin, management, logistics, house_tech

canReviewRiderExtraction
  admin, management, logistics, house_tech

canApplyRiderExtraction
  admin, management, house_tech
```

Server-side RLS/RPC authorization remains the authority.

## 9. Review UI

The review experience should be a dedicated dialog rather than expanding `ArtistFileDialog` into a giant form.

Suggested layout:

```text
Field            Current          Rider proposal
--------------------------------------------------
FOH console      SD12             Quantum 338  [✓]
MON console      PM7              Quantum 7    [✓]
Wireless         12               16           [✓]
CAT6             2                4            [ ]
Side fill        No               Yes          [✓]
```

Each field should show:

- current value;
- proposed raw/normalized value;
- confidence classification;
- evidence/page;
- accept/reject control.

Default preselection:

- high confidence;
- non-null;
- changed value only.

Medium/low-confidence proposals start unselected. Null proposals never clear existing values by default.

## 10. Deterministic apply layer

Approved extraction must go through an allowlisted server-side operation.

Input should identify the ingestion and approved semantic fields, not arbitrary DB columns.

Server responsibilities:

1. load ingestion;
2. verify status is reviewable;
3. load current artist;
4. validate reviewed extraction against the expected schema version;
5. map approved semantic fields through an allowlist;
6. apply existing domain relationships, including monitors-from-FOH behavior;
7. update only approved fields;
8. mark ingestion applied;
9. record actor/timestamps;
10. emit activity/audit event.

## 11. Phase 1 — ingestion domain foundation

**Mac not required.**

Implement:

- `rider_ingestions` migration;
- status constraints;
- RLS/grants;
- pgTAP tests;
- generated Supabase type refresh;
- `RiderExtractionV1` Zod schema;
- normalization/application domain interfaces;
- ingestion query keys/hooks;
- create queued ingestion action;
- ingestion history/status retrieval.

### Acceptance criteria

- authorized user can create a queued ingestion linked to an existing artist/PDF;
- unauthorized role cannot create/review/apply;
- no artist data changes at creation;
- state constraints reject invalid transitions/data;
- deleted file metadata does not erase completed ingestion history;
- full DB/TS/CI gates pass.

## 12. Phase 2 — review UI with mocked extraction

**Still no Mac required.**

Build the product workflow against deterministic fixtures.

Implement:

- `Analyze rider` action in `ArtistFileDialog`;
- status display: not analyzed / queued / processing / review / applied / failed;
- dedicated extraction review dialog;
- current vs proposed fields;
- evidence display;
- selection controls;
- mocked completed extraction fixture/dev pathway;
- secure apply RPC/Edge operation;
- activity logging;
- frontend/database tests.

### Acceptance criteria

- a mocked extraction can be reviewed end-to-end;
- only selected values update the artist;
- null proposals do not clear existing values;
- unapproved fields remain untouched;
- invalid field names cannot be injected into artist update;
- domain rules are preserved;
- permissions match actual DB authority.

## 13. Phase 3 — historical evaluation tooling

Build tooling before trusting a model.

Create a mechanism to select and evaluate historical rider/artist pairs.

Initial candidate filter:

```text
PDF rider
rider_missing = false
rider_outdated = false
rider_copied_from_date IS NULL
```

Deduplicate by `file_path`.

Curate 50–100 representative cases as gold/silver/excluded.

Evaluation should report per-field:

- exact matches;
- normalized matches;
- missing extraction;
- incorrect extraction;
- unavailable/ambiguous ground truth.

Do not count null/null as meaningful success.

## 14. Phase 4 — local Mac worker

Create a separate repository unless there is a strong reason not to, e.g. `jvhtec/rider-worker`.

Recommended runtime structure:

```text
rider-worker/
├── api/
├── worker/
│   ├── queue.py
│   ├── downloader.py
│   ├── document_parser.py
│   ├── ocr.py
│   ├── extractor.py
│   ├── normalizer.py
│   ├── evaluator.py
│   └── supabase_writer.py
├── schemas/
├── prompts/
├── fixtures/
└── tests/
```

Probable stack:

- Python;
- FastAPI for optional control API;
- Docling for digital PDF structure extraction;
- PaddleOCR fallback for scans/poor documents;
- MLX / mlx-vlm or equivalent Apple-native runtime;
- a small replaceable local model.

### Worker flow

```text
claim queued ingestion
→ download rider directly from Supabase Storage
→ parse document
→ OCR fallback if needed
→ run local extraction
→ validate schema
→ normalize
→ write raw + normalized result
→ transition to review
```

### Worker rules

- no paid API calls;
- no direct artist mutation;
- no browser credentials;
- jobs survive restart;
- two workers cannot process the same job simultaneously;
- malformed model JSON becomes a failed ingestion, not corrupted state.

## 15. Worker claim/recovery semantics

Claim must be atomic. Avoid `SELECT queued` followed by an unguarded update.

Use a guarded update/RPC capable of returning the claimed row only when status still equals `queued`.

Later add stale-processing recovery/lease semantics if required by production operation.

## 16. Phase 5 — benchmark and improve

Run the local worker over the curated historical corpus.

Tune:

- parsing strategy;
- OCR fallback threshold;
- model prompt;
- schema wording;
- chunking/context selection;
- normalization;
- evidence selection.

Do not fine-tune yet.

Suggested initial threshold before high-confidence proposals are preselected automatically:

```text
FOH console normalized accuracy >= 95%
MON console normalized accuracy >= 95%
key quantity fields >= 95%
false-positive rate <= 2%
```

Fields below threshold remain manual-review-only.

## 17. Phase 6 — Cloudflare Tunnel control plane

Add only after the worker is reliable through the Supabase queue.

Target architecture:

```text
Área Técnica / Supabase Edge Function
            ↓
Cloudflare Access service auth
            ↓
Cloudflare Tunnel
            ↓
Mac worker on 127.0.0.1
```

Suggested endpoints:

```text
POST /jobs
GET  /jobs/:id
POST /jobs/:id/cancel
GET  /health
```

Do not proxy rider file bytes through Cloudflare. The worker downloads files directly from Supabase Storage.

The Tunnel is a control/health path, not the durable queue.

## 18. Phase 7 — production hardening

Add:

- worker heartbeat;
- worker/model version;
- queue depth;
- currently processing job;
- duration metrics;
- retry action;
- cancellation;
- stale-processing recovery;
- ingestion history;
- useful failure reasons.

Suggested UI:

```text
Rider worker
🟢 Online
Worker: 1.x
Model: ...
Queue: 2
Processing: 1
```

## 19. Phase 8 — blind rider ingestion

Only after technical extraction is proven.

Future flow:

```text
upload arbitrary rider
→ extract probable artist identity
→ search historical artist identities
→ show candidates
→ human selects existing artist or creates new one
→ technical extraction review
```

Reuse the existing `artist_external_metadata` identity/normalization subsystem. Do not create a second artist-matching domain.

Never silently attach a document to an artist based solely on model output.

## 20. Phase 9 — advanced technical extraction

Add separately benchmarked domains:

- wired microphone list;
- input/channel list;
- channel counts;
- RF model breakdown;
- IEM model breakdown;
- monitor mixes;
- stage plots;
- patch requirements;
- technical crew/contact extraction where appropriate.

Each domain gets its own schema extension and evaluation metrics.

## 21. Phase 10 — local fine-tuning

Only consider LoRA/fine-tuning after prompt/schema/normalization performance plateaus.

Use curated historical pairs, not raw database rows indiscriminately.

Track model/training version in each ingestion so historical results remain reproducible.

## 22. Future rider history/diff capability

Persisted normalized extraction allows later comparison without rerunning every document.

Example product:

```text
Artist rider changes

MON console
2025: Quantum 338
2026: Quantum 7
CHANGED

IEM
2025: 12x PSM1000
2026: 16x PSM1000
CHANGED

FOH console
2025: S6L
2026: S6L
UNCHANGED
```

This historical change layer is one of the strongest long-term product benefits.

## 23. Security requirements

- AI output is untrusted input.
- Worker secrets never enter React/browser state.
- Service-role credentials, if initially required, stay only on trusted server/worker infrastructure and should later be reduced to least privilege.
- Cloudflare Access token stays server-side.
- Do not log full rider bodies or prompts containing rider contents.
- Apply operation uses explicit semantic allowlist, not arbitrary DB column names.
- RLS/RPC tests are required before production.

## 24. Reliability requirements

The system must tolerate:

- Mac offline;
- Mac reboot;
- worker process restart;
- malformed PDFs;
- OCR failure;
- local model failure/timeout;
- invalid JSON;
- schema mismatch;
- Supabase reconnect/write failure;
- repeated Analyze clicks;
- stale review browser state;
- concurrent artist edits.

No such failure may corrupt `festival_artists`.

## 25. File support

Initial inference support should be only `application/pdf` even though the existing upload system supports more formats.

Later candidates:

- DOCX;
- images;
- XLS/XLSX.

The UI must not advertise analysis for a format the worker cannot parse.

## 26. Success criteria

The feature succeeds when a normal workflow changes from:

```text
read 20–80 page rider
→ find relevant audio requirements
→ manually transcribe values
→ cross-check values
```

to:

```text
Analyze rider
→ review evidence-backed proposals
→ approve selected changes
```

while remaining private, local, recoverable, auditable and free of paid AI inference costs.

## 27. Immediate implementation boundary

The next coding PR should contain **Phase 1 only**, plus enough mocked plumbing to define the Phase 2 contract if useful.

Do not implement Mac, OCR, local model or Cloudflare code until the application-side ingestion domain and review contract are stable.