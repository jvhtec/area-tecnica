# Conservative Improvement Roadmap – Phase 0 & 1 Progress

| Phase | Deliverable | Status |
| --- | --- | --- |
| 0.1 | Health views + error log | ✅ Added Supabase migration `20250720090000_phase0_monitoring_foundation.sql` and documented dashboard usage. |
| 0.2 | Critical path tests | ✅ Created Vitest suites under `tests/timesheets` and `tests/assignments` capturing every scenario as `test.todo`. |
| 0.3 | Data audit plan | ✅ Added repeatable SQL script and CSV templates inside `docs/data_audit_phase0`. |
| 1.1 | Zero-risk indexes | ✅ Added concurrent indexes via migration `20250720091000_phase1_performance_indexes.sql`. |
| 1.2 | Monitoring views | ✅ Added advanced observability views via `20250720091500_phase1_monitoring_views.sql`. |
| 1.3 | Frontend error tracking | ✅ Implemented `src/lib/errorTracking.ts` and wired it into high-risk hooks. |

Next review step: validate the monitoring dashboards once deployed and
confirm the operations team has filled in the audit CSV exports.
