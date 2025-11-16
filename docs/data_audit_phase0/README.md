# Phase 0.3 – Data Audit Baseline

The Conservative Improvement Roadmap requires a read-only audit of the
current Supabase data. Because this repository does not include a live
database snapshot, the SQL statements and CSV templates below serve as
repeatable instructions for the operations team. Running the SQL against
production (read-only) will populate the CSV files and create artifacts
for review without mutating any rows.

## How to run the audit

1. Connect to the production read replica with `psql`.
2. Execute `\i docs/data_audit_phase0/phase0_data_audit.sql`.
3. Export each query result to its matching CSV file using `\copy` as
   documented inside the SQL file.
4. Transfer the resulting CSVs to the approved secure artifact store or
   monitoring destination (e.g., encrypted internal S3 bucket with
   access controls, CI job artifacts, or the managed audit service).
5. Follow the [Secure Storage & Data Handling Policy](../secure_storage_and_data_handling_policy.md)
   to record the audit run metadata (who performed it, when, hash of the
   uploaded files) and retention period.

## Deliverables tracked here

| Artifact | Description |
| --- | --- |
| `phase0_data_audit.sql` | Contains every read-only query requested in the roadmap. |
| `data_audit_orphaned_timesheets.csv` | Template for orphaned timesheet rows. |
| `data_audit_orphaned_assignments.csv` | Template for orphaned job assignments. |
| `data_audit_orphaned_staffing_requests.csv` | Template for staffing requests stuck without assignments. |
| `data_audit_invalid_role_codes.csv` | Template for role codes not present in the approved list. |
| `data_audit_invalid_dates.csv` | Template for assignment date anomalies. |
| `known_valid_role_codes.txt` | Seed list of approved role codes for comparison. |

All CSV templates currently only include headers to avoid storing stale
or speculative data inside the repository. **Do not commit production
audit output or any PII to source control.** Instead, populate the CSVs
locally, redact or pseudonymize any PII, and upload the sanitized
results to the secure storage destination noted above. Traceability must
come from the artifact store's audit logs/metadata rather than git
history, and retention must follow the durations listed in the Secure
Storage & Data Handling Policy.
