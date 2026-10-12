# Sound manifest synchronization (activation disabled)

The migrations install the database wrapper, private publication leases and quote privacy enforcement. **Default migration application does not schedule publication.** Live Flex validation and explicit operational activation remain required before recurring execution.

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
6. Review the worker's structured `sound_manifest_sync.completed` log and failed invocation alerts. Errors return HTTP 500 with per-job identifiers; durable job-level status and an alerting destination still require operational setup.
7. Validate the worker, credentials and time window before explicitly creating the cron entry. Do not set `app.sound_manifest_sync_enabled=on` while applying the migration unless activation has already been validated.

## Current scope
A server-side service-role-only worker with strict status ID allowlist, report generation, content hashing, and publish-before-retire document replacement. This is a dormant integration: merging the code does not activate recurring execution or certify the real Flex report/mappings. Ordinary CI covers the worker contracts, while pgTAP covers quote metadata/Storage authorization, lease ownership, RPC grants and the unscheduled default.

## Daytime polling window
Once activated, cron invokes its database wrapper hourly, but the wrapper calls Flex only at **09:00, 11:00, 13:00, 15:00, 17:00 and 19:00 Europe/Madrid**. The timezone guard preserves local hours across daylight-saving changes. No overnight calls are made.

## Activation and concurrency
The migration does **not** activate the cron automatically. After staging validation, explicitly create the `sound-manifest-sync` cron entry with `cron.schedule('sound-manifest-sync', '0 * * * *', 'SELECT public.invoke_sound_manifest_sync()')`; the wrapper restricts execution to 09:00–19:00 Europe/Madrid every two hours. `claim_sound_manifest_slot` leases each pull-sheet publication for ten minutes, with token-checked release. A prepared manifest is replaced by a shipping manifest in the same pull-sheet slot.

The follow-up hardening migration returns `false` on denied claims and enforces a partial unique index on `(job_id, file_path)` for immutable Sound manifest objects. Existing duplicate metadata is reduced to one row without deleting its shared Storage object. Publication/cleanup failures are surfaced for retry; a successfully published replacement remains available if retirement fails.

The ten-minute lease must exceed the deployed worker's maximum lifetime. Longer-lived or self-hosted execution requires token-fenced publication and retirement before activation; uniqueness alone does not fence writes for different fingerprints after lease takeover.

Before production migration application, a human must run `supabase db push --linked --dry-run`, review and apply the SQL. To roll back code, revert the PR; use a forward migration for database corrections. If recurring execution was activated, unschedule `sound-manifest-sync` first. Quote privacy must remain enforced during rollback.
