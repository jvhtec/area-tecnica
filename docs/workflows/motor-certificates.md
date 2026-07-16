# Individual Motor Inspection Certificates

> Generates a client-facing certificate pack for the exact serialized MOTOR units assigned to a job in Flex, without manually editing Word files or sending the full company serial-number register.

## Purpose

The motor certificate workflow replaces a repetitive administrative process:

- finding the motors shipped to a job,
- copying model and serial data into individual certificate templates,
- exporting and renaming separate files,
- and checking that the client receives only the relevant certificates.

Área Técnica derives the certificate selection from the job's Flex preparation or shipping manifest. The generated PDF therefore follows the same operational source of truth as the equipment movement.

The main business outcomes are:

- substantially less manual document editing,
- fewer serial-number transcription mistakes,
- no accidental omission of a shipped motor,
- and no distribution of certificates or serial numbers for unrelated company stock.

## Access and entry point

- **Route:** Project Management job cards
- **Action:** `Cert. motores`
- **Surfaces:** desktop and mobile job-card actions
- **Roles:** `admin` and `management`

The action is intentionally restricted because it reads serialized inventory data from Flex and produces official inspection documents.

## Operator workflow

```text
1. OPEN the relevant job in Project Management.
2. CLICK "Cert. motores" on the job card.
3. WAIT while Área Técnica reads the job's Flex folders, equipment lists,
   outbound manifest state, and eligible serialized MOTOR units.
4. REVIEW the motors selected from the manifest.
5. OPTIONAL: switch to manual selection for an exception or when no usable
   manifest exists.
6. SEARCH by serial number, Flex barcode, stencil, model, model number, or
   current location when using manual selection.
7. SELECT or deselect the required units.
8. CLICK "Generar certificados".
9. DOWNLOAD one PDF containing a two-page certificate block per selected motor.
```

Manifest selection is the default. Manual selection is a fallback, not a second certificate registry.

## Data flow

```text
Job
  -> flex_folders rows for the job
  -> Flex root element and tracked pull sheets
  -> related equipment lists
  -> outbound prep/ship manifests
  -> serialized MOTOR rows in the manifest
  -> normalized Flex motor units
  -> selected unit IDs
  -> client-side PDF generation
  -> direct browser download
```

### Sources of truth

| Data | Source |
|---|---|
| Job and related Flex element IDs | `flex_folders` |
| Serialized unit identity | Flex serial-unit grid |
| Motor assigned to the job | Flex outbound prep/ship manifest |
| Model allowlist | `MOTOR_MODELS` in the Edge Function |
| Inspection date, next inspection date, provider, and owner | `MOTOR_CERTIFICATE_SOURCE` |
| Signed maintenance evidence | `public/certificates/revision-motores-2026-pagina-firmada.pdf` |

No separate certificate table is created. The document is generated on demand from current Flex data plus the configured certificate source.

## Manifest resolution

The Edge Function first resolves the job's relevant Flex elements from `flex_folders`:

- preferred root folder types: `main_event`, `main`, then `tourdate`,
- directly tracked equipment lists: `pull_sheet`.

It also searches the Flex job tree for additional equipment lists. For each candidate list, it reads the warehouse state and selects the relevant outbound preparation or shipping manifest. The manifest line items are then matched to normalized serialized MOTOR units.

The function returns one of four manifest states:

| Status | Meaning |
|---|---|
| `found` | One or more eligible motors were matched and selected automatically |
| `empty` | A manifest exists, but it contains no certified motor models |
| `unavailable` | No related equipment list or usable outbound manifest exists yet |
| `error` | Flex data could not be read completely |

When the status is not `found`, the dialog explains the condition and exposes manual selection.

## Manual selection and unit eligibility

Manual selection loads serialized units only for the fixed certified MOTOR model allowlist.

The search covers:

- serial number,
- Flex barcode,
- stencil,
- model number,
- model name,
- current location.

Repairable units included by Flex's inventory grid, such as out-of-commission or presumed-missing units, remain visible for deliberate manual handling. Sold, deleted, and decommissioned units are excluded.

A unit must have both a Flex unit ID and a serial number before it can be selected or used in a certificate.

## PDF output

The browser generates one PDF for the complete selection. Each motor contributes exactly two pages:

1. **Individual identity page**
   - certified model,
   - serial number,
   - Flex barcode when present,
   - inspection date,
   - next annual inspection date,
   - inspection provider,
   - equipment owner.

2. **Signed maintenance page**
   - copied unchanged from the configured one-page signed master PDF.

For one selected motor, the filename includes the serial number. For multiple motors, the filename includes the job name.

The PDF is downloaded directly as a browser Blob. It is not uploaded to Supabase storage and no `job_documents` row is created.

## Security and API boundaries

The `fetch-flex-motor-units` Edge Function:

- requires a valid Supabase JWT,
- requires `admin` or `management`,
- accepts only a valid job UUID,
- performs read-only Flex requests,
- reads only the fixed MOTOR model allowlist,
- validates and sanitizes the response before the client uses it,
- limits Flex request concurrency to five operations,
- limits model pagination to 20 pages of 25 units,
- and inspects at most 100 equipment lists for manifest discovery.

The client validates the complete Edge Function response again before presenting or generating certificates.

## Failure and fallback behaviour

| Condition | Behaviour |
|---|---|
| No related Flex lists | Show `unavailable`; offer manual selection |
| No outbound prep/ship manifest yet | Show `unavailable`; offer manual selection |
| Manifest has no matching certified motors | Show `empty`; offer manual selection |
| Some motor models fail to load | Show a partial warning; keep successfully loaded models available |
| All motor models fail to load | Return an error and block certificate selection |
| Signed master PDF is missing or invalid | Stop generation and show an error |
| Signed master PDF has more or fewer than one page | Stop generation and show an error |
| No units selected | Disable generation |

## Annual certificate renewal

The current certificate campaign is configured in `MOTOR_CERTIFICATE_SOURCE`.

To renew it:

1. Replace or add the signed one-page maintenance PDF under `public/certificates/`.
2. Update `signedMaintenancePageUrl`.
3. Update `inspectionDate` and `nextAnnualInspectionDate`.
4. Update `inspectionProvider` or `equipmentOwner` if either legal entity changes.
5. Confirm the signed source PDF contains exactly one page.
6. Generate and visually inspect a representative multi-motor certificate pack.
7. Run the focused PDF, service, Edge Function, and interaction tests.

Changing only the certificate dates or signed page does not require a database migration. Changes to the model allowlist or Flex request contract require an Edge Function deployment.

The current hardcoded campaign is intentionally simple. If several certificate campaigns must coexist, replace it with a versioned certificate-source record rather than adding more conditional constants.

## Key files

| Category | Path |
|---|---|
| Desktop job-card action | `src/components/jobs/cards/job-card-actions/JobCardActionButtons.tsx` |
| Mobile job-card action | `src/components/jobs/cards/job-card-actions/MobileJobCardActions.tsx` |
| Dialog and operator workflow | `src/components/jobs/cards/job-card-actions/MotorCertificateAction.tsx` |
| Client service and response validation | `src/services/flexMotorUnits.ts` |
| PDF generator and campaign configuration | `src/utils/pdf/motorInspectionCertificates.ts` |
| Signed master page | `public/certificates/revision-motores-2026-pagina-firmada.pdf` |
| Protected Flex adapter | `supabase/functions/fetch-flex-motor-units/index.ts` |
| Motor normalization and allowlist | `supabase/functions/fetch-flex-motor-units/motorUnits.ts` |
| Manifest discovery and matching | `supabase/functions/fetch-flex-motor-units/manifestUnits.ts` |
| Bounded concurrency helper | `supabase/functions/fetch-flex-motor-units/concurrency.ts` |

## Test coverage

| Area | Test file |
|---|---|
| Job-card interaction and selection | `src/components/jobs/cards/job-card-actions/__tests__/MotorCertificateAction.test.tsx` |
| Client response validation | `src/services/flexMotorUnits.test.ts` |
| PDF page count, content, and filenames | `src/utils/pdf/__tests__/motorInspectionCertificates.test.ts` |
| Flex unit parsing and request contract | `supabase/functions/fetch-flex-motor-units/motorUnits.test.ts` |
| Manifest discovery and matching | `supabase/functions/fetch-flex-motor-units/manifestUnits.test.ts` |
| Concurrency limits | `supabase/functions/fetch-flex-motor-units/concurrency.test.ts` |

## Invariants

1. A client certificate pack must include only the motors deliberately selected for that job.
2. Manifest-derived selection must remain the default path.
3. Manual selection must not create or mutate inventory data.
4. The signed maintenance page must be copied unchanged after every individual identity page.
5. One selected motor must always produce exactly two pages.
6. The Edge Function must remain authenticated, role-restricted, read-only, and bounded.
7. Certificate generation must not depend on a parallel manually maintained serial-number registry.
