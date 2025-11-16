# System Health Dashboard (Phase 0.1)

This document explains how to visualize the read-only monitoring views
introduced for Phase 0.1 of the Conservative Improvement Roadmap.

## Views

- `system_health_timesheets`
- `system_health_assignments`
- `system_errors`

Each view/table is created via Supabase migrations and can be queried
through the SQL Editor or the BI connector to power Grafana/Metabase.

## Suggested panels

1. **Timesheet Status Overview** – `SELECT * FROM system_health_timesheets;`
2. **Assignment Funnel** – `SELECT * FROM system_health_assignments;`
3. **Error Log Feed** – `SELECT * FROM system_errors ORDER BY created_at DESC LIMIT 50;`

All of the above are safe to run in production because they are read-only
or append-only writes from the application when failures occur.
