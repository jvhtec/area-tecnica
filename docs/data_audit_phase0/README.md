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
4. Upload the filled CSVs back into this folder (or the monitoring
   dashboard) for the review meeting.

## Deliverables tracked here

| Artifact | Description |
| --- | --- |
| `phase0_data_audit.sql` | Contains every read-only query requested in the roadmap. |
| `data_audit_orphaned_timesheets.csv` | Template for orphaned timesheet rows. |
| `data_audit_orphaned_assignments.csv` | Template for orphaned job assignments. |
| `data_audit_orphaned_staffing_requests.csv` | Template for staffing requests stuck without assignments. |
| `data_audit_invalid_dates.csv` | Template for assignment date anomalies. |
| `known_valid_role_codes.txt` | Seed list of approved role codes for comparison. |

All CSV templates currently only include headers to avoid storing stale
or speculative data inside the repository. When the read-only audit runs,
the data team should append real rows below the headers and commit the
results for traceability.
