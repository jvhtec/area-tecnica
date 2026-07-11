# Secure Storage & Data Handling Policy

This policy defines the repository-backed controls for audit exports,
production logs, database extracts, and other artifacts containing sensitive
operational or personal data.

## Approved locations

1. **The linked Sector Pro Supabase project**
   - Use the purpose-specific database table or private Storage bucket.
   - RLS, service-role boundaries, retention migrations, and negative
     authorization tests are mandatory for sensitive data.
   - Do not persist signed URLs when a bucket/object path can be stored.
2. **Private GitHub Actions artifacts for this repository**
   - Only sanitized diagnostics, test reports, release bundles, and SBOMs are
     allowed. Live personal data and production database exports are forbidden.
   - Use the workflow's explicit `retention-days`; release candidates currently
     expire after 14 days and SBOMs after 90 days.
3. **A company-managed encrypted workstation used by an authorized operator**
   - Temporary exports must remain inside an encrypted user profile, must not be
     synchronized to personal cloud storage, and must be deleted immediately
     after the approved task or within 7 days, whichever is earlier.

No S3 bucket, Google Drive/Sheets location, email attachment, chat upload, or
other destination is approved unless the data owner records the system, access
group, retention period, and written approval in the operational register.

## Required handling

1. Minimize the export to the fields and rows required for the task.
2. Remove names, emails, phone numbers, addresses, tokens, signed URLs, document
   bodies, and provider payloads. When correlation is required, use an approved
   keyed HMAC fingerprint rather than a generic salted hash. The HMAC key is a
   dedicated secret in the linked Supabase project, readable only by the
   security-audit service role; never export it, include it in source control,
   or reuse it for authentication. Rotate it at least annually or after a
   suspected disclosure, record the rotation/change ticket, and expire/delete
   fingerprints carrying the retired key version. Re-fingerprinting is allowed
   only from the approved source system through an access-controlled, documented
   task that records the operator, purpose, record count, old/new key versions,
   and deletion deadline; it must not retain a source-to-fingerprint mapping.
   The security audit log or related change ticket must identify the approved
   correlation purpose and key version without storing the identifier or key
   material.
3. Record the operator, purpose, source query/hash, approved destination,
   classification, creation time, and deletion deadline in the security audit
   log or the related change ticket. Never record credentials in that entry.
4. Apply these maximum working-copy retention periods unless a documented legal
   requirement is shorter or longer:
   - sanitized engineering diagnostics: 30 days;
   - personal/operational audit extracts: 7 days;
   - secrets or authentication material: never export or persist;
   - statutory payroll/accounting records: the approved legal retention period.
5. Verify deletion at the deadline. Access to persistent operational records is
   reviewed quarterly by the data owner and an administrator.

## Logging rules

- Log correlation IDs, event types, result/status, safe counts, and opaque
  fingerprints only.
- Do not log raw emails, phone numbers, push/device tokens, subscription
  endpoints, URLs containing query strings, signed URLs, HTML bodies,
  attachments, secrets, or full provider responses.
- Client and Edge error contexts must pass the shared redaction policy before
  persistence or console output.

## Incident response

Report suspected disclosure, missing artifacts, unexpected access, or retention
failure to `info@sector-pro.com` immediately with the correlation/audit ID,
affected system, time window, and containment steps. Do not copy the exposed
data or secret into the report. The data owner must record triage, access/key
revocation, provider notification, legal/privacy escalation, and closure.

## Ownership and review

- Data owner: Sector Pro operations management.
- Technical controls: repository administrators and the Supabase/Cloudflare
  project owners.
- Privacy/legal decisions: the entity identified in the worker/customer
  relationship, with qualified legal review where required.
- Review cadence: quarterly and after any material provider or data-flow change.
