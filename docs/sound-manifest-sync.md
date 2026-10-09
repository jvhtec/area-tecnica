# Sound manifest synchronization (draft)

This worker is deliberately **not scheduled** until the live Flex status response contract is verified.

## Confirmed by operations
- Eligible statuses: Preparado (`70b2de6c-aee8-11df-b8d5-00e08175e43e`) and Enviado (`4dc8c4ec-aee9-11df-b8d5-00e08175e43e`).
- Report endpoint: `GET /f5/api/report/generate/generate-pdf`.
- `PROJECT_ELEMENT_ID` is the **manifest ID**, not the Pull Sheet ID.
- Report uses `ELEMENT_VIEW_ID=54110f73-c28a-11f1-bdc7-02e7c1b689d7` (not `DOCUMENT_VIEW_ID`).
- The job document is technician-visible.

## Validation required before scheduling
1. Verify `GET /element/{manifestId}` is supported and identify the authoritative status field in its JSON response. Current implementation fails closed if that field is absent. **Do not enable scheduling on assumptions about this route.**
2. Confirm `flex_folders` Sound Pull Sheet mapping across single jobs, festivals, and tour dates.
3. Verify report response is valid PDF/base64 PDF using a prepared manifest.
4. Check `job_documents.read_only` and nullable `uploaded_by` against production schema.
5. Test repeat runs, PDF replacements, concurrent invocations, and technician access with the real database.
6. Add a durable publication lock and job-level monitoring/status before activating recurring execution.
7. Add a 15-minute scheduled invocation through the existing secured cron configuration once validated.

## Current scope
A server-side service-role-only worker with strict status ID allowlist, report generation, content hashing, and publish-before-retire document replacement. It is a **draft integration**, not production-ready automation. No cron is installed by this PR.
