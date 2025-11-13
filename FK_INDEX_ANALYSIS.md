# Foreign Key Index Analysis Guide

## Overview
You have ~90 unindexed foreign keys. Adding indexes to all of them would:
- ✅ Speed up JOIN operations
- ❌ Slow down INSERT/UPDATE/DELETE operations
- ❌ Increase database storage significantly

This guide helps you identify which foreign keys **actually need** indexes based on your usage patterns.

## Step 1: Run the Analysis Query

1. Open your Supabase SQL Editor
2. Copy and run the query from `analyze_fk_usage.sql`
3. Review the results sorted by priority

## Step 2: Interpret Results

The query will show:
- **Table name**: Table with the unindexed foreign key
- **Column name**: Foreign key column that could be indexed
- **Priority**: HIGH/MEDIUM/LOW based on table size and scan frequency
- **Suggested index**: Ready-to-run CREATE INDEX statement

### Priority Levels:

- **HIGH PRIORITY**: Tables with >10k rows and >100 sequential scans
  - These indexes will have immediate performance impact
  - Recommend adding these indexes first

- **MEDIUM PRIORITY**: Tables with >5k rows and >50 scans
  - Consider adding these if you notice slow queries

- **LOW/VERY LOW**: Small tables (<5k rows)
  - Usually don't need indexes on foreign keys
  - PostgreSQL can scan these quickly even without indexes

## Step 3: Create Targeted Index Migration

Based on HIGH priority results, create a migration:

```sql
-- Example: Only index high-traffic foreign keys
-- Replace with actual high-priority columns from analysis

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id
  ON public.job_assignments(job_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_technician_id
  ON public.timesheets(technician_id);

CREATE INDEX IF NOT EXISTS idx_tour_assignments_tour_id
  ON public.tour_assignments(tour_id);

-- Add more based on your analysis results
```

## Step 4: Monitor Impact

After adding indexes:

1. Check database size increase:
   ```sql
   SELECT pg_size_pretty(pg_database_size(current_database()));
   ```

2. Monitor query performance in Supabase Dashboard
3. Check index usage after a few days:
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan AS times_used
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   ORDER BY idx_scan DESC;
   ```

## Common High-Priority Candidates

Based on typical usage patterns, these foreign keys are **usually** high priority:

1. **`job_assignments.job_id`** - Frequently joined with jobs table
2. **`job_assignments.technician_id`** - User-specific queries
3. **`timesheets.technician_id`** - User dashboard queries
4. **`timesheets.job_id`** - Job detail pages
5. **`tour_assignments.tour_id`** - Tour detail pages
6. **`tour_assignments.technician_id`** - User assignments

## Migration Already Created

I've created `20251113103500_add_primary_keys_and_cleanup_indexes.sql` which:
- ✅ Adds primary keys to junction tables
- ✅ Removes ~50 unused indexes

Run this migration first before adding new foreign key indexes.

## Next Steps

1. Run `analyze_fk_usage.sql` in Supabase SQL Editor
2. Identify HIGH priority foreign keys
3. Create a new migration with only those indexes
4. Apply and monitor

Remember: **Don't index everything** - only index what you actually need based on data!
