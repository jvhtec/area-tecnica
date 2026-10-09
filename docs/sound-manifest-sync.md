# Sound manifest synchronization (draft)

A daytime two-hour pg_cron schedule is committed but **not deployed**. Do not apply the scheduling migration before verifying the worker against a real Flex manifest and staging database.

## Confirmed by operations
- Eligible statuses: Preparado (`70b2de6c-aee8-11df-b8d5-00e08175e43e`) and Enviado (`4dc8c4ec-aee9-11df-b8d5-00e08175e43e`).
- Report endpoint: `GET /f5/api/report/generate/generate-pdf`.
- `PROJECT_ELEMENT_ID` is the **manifest ID**, not the Pull Sheet ID.
- Report uses `ELEMENT_VIEW_ID=54110f73-c28a-11f1-bdc7-02e7c1b689d7` (not `DOCUMENT_VIEW_ID`).
- The job document is technician-visible.

## Validation required before scheduling
1. **Confirmed:** `GET /element/{manifestId}/header-data/?codeList=statusId` returns a `statusId` field whose `data.id` is the authoritative status option. Verify the response against a prepared manifest during integration testing.
2. Confirm `flex_folders` Sound Pull Sheet mapping across single jobs, festivals, and tour dates.
3. Verify report response is valid PDF/base64 PDF using a prepared manifest.
4. Check `job_documents.read_only` and nullable `uploaded_by` against production schema.
5. Test repeat runs, PDF replacements, concurrent invocations, and technician access with the real database.
6. Add a durable publication lock and job-level monitoring/status before activating recurring execution.
7. The daytime two-hour pg_cron invocation is committed in `20261009181500_schedule_sound_manifest_sync.sql`; validate the worker and credentials before applying it.

## Current scope
A server-side service-role-only worker with strict status ID allowlist, report generation, content hashing, and publish-before-retire document replacement. It is a **draft integration**, not production-ready automation. The cron migration is committed, not applied.

## Daytime polling window
The cron invokes its database wrapper hourly, but the wrapper calls Flex only at **09:00, 11:00, 13:00, 15:00, 17:00 and 19:00 Europe/Madrid**. The timezone guard preserves local hours across daylight-saving changes. No overnight calls are made.

## Activation and concurrency
The migration does **not** activate the cron automatically. After staging validation, explicitly create the `sound-manifest-sync` cron entry with `cron.schedule('sound-manifest-sync', '0 * * * *', 'SELECT public.invoke_sound_manifest_sync()')`; the wrapper restricts execution to 09:00–19:00 Europe/Madrid every two hours. `claim_sound_manifest_slot` leases each pull-sheet publication for ten minutes, with token-checked release. A prepared manifest is replaced by a shipping manifest in the same pull-sheet slot.
