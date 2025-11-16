# Secure Storage & Data Handling Policy

This policy summarizes how the operations team must handle audit exports,
production logs, and other artifacts that may include sensitive data.

## Approved storage locations

1. **Encrypted internal S3 bucket (`s3://ops-audits-prod`)**
   - Server-side encryption (SSE-S3) is mandatory.
   - Bucket policies restrict access to the ops and security IAM roles.
2. **CI job artifacts**
   - Artifacts must be marked private and expire automatically after 30 days.
   - Use the pipeline secret `AUDIT_ARTIFACT_TOKEN` to upload securely.
3. **Managed audit service**
   - Only the "Hoja de Ruta" project space is approved for timesheet or
     assignment data.

Any alternative destination requires written approval from Security.

## Required handling steps

1. **Redact or pseudonymize PII** before uploading. Replace names,
   addresses, phone numbers, and other identifiers with deterministic
   hashes or tokens that only the security team can rehydrate.
2. **Record metadata** for each upload in the audit log spreadsheet
   (`gs://ops-shared/audit-log.xlsx`): operator name, timestamp, query
   hash, destination URL, and retention deadline.
3. **Verify retention configuration** matches the data classification:
   - Low sensitivity: 90 days maximum
   - Medium sensitivity (includes audit exports): 30 days maximum
   - High sensitivity: 7 days maximum, unless Legal grants an exception
4. **Access reviews** happen monthly. Operators must ensure artifacts are
   deleted or re-authorized per the retention schedule.

## Incident response

Report any suspected disclosure, missing artifact, or access anomaly to
security@company.example within 30 minutes. Provide the audit log entry,
artifact hash, and steps taken so far.
