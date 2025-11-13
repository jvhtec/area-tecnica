-- Query to analyze foreign key usage and determine which ones need indexes
-- Run this query in your Supabase SQL editor to identify high-priority foreign keys to index

-- This query shows:
-- 1. All foreign keys without covering indexes (from linter)
-- 2. Index usage statistics for related tables
-- 3. Recommendations based on table size and scan counts

WITH unindexed_fkeys AS (
  -- List of foreign keys that need potential indexing
  -- Based on the linter output you received
  SELECT
    c.conrelid::regclass AS table_name,
    c.conname AS fkey_name,
    a.attname AS column_name,
    c.confrelid::regclass AS referenced_table
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.contype = 'f'  -- foreign key constraints
  AND NOT EXISTS (
    -- Check if there's already an index on this column
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
    AND c.conkey[1] = ANY(i.indkey)
  )
),
table_stats AS (
  -- Get table statistics: size and estimated row count
  SELECT
    schemaname || '.' || tablename AS full_table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS table_size,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    n_live_tup AS estimated_rows
  FROM pg_stat_user_tables
)
SELECT
  uf.table_name,
  uf.fkey_name,
  uf.column_name,
  uf.referenced_table,
  ts.table_size,
  ts.estimated_rows,
  ts.sequential_scans,
  ts.index_scans,
  ts.inserts + ts.updates + ts.deletes AS write_operations,
  CASE
    WHEN ts.estimated_rows > 10000 AND ts.sequential_scans > 100 THEN 'HIGH PRIORITY - Large table with many scans'
    WHEN ts.estimated_rows > 5000 AND ts.sequential_scans > 50 THEN 'MEDIUM PRIORITY - Medium table with moderate scans'
    WHEN ts.estimated_rows > 1000 THEN 'LOW PRIORITY - Small table'
    ELSE 'VERY LOW PRIORITY - Tiny table'
  END AS priority,
  'CREATE INDEX IF NOT EXISTS idx_' ||
    replace(uf.table_name::text, 'public.', '') || '_' ||
    uf.column_name ||
    ' ON ' || uf.table_name || '(' || uf.column_name || ');' AS suggested_index
FROM unindexed_fkeys uf
LEFT JOIN table_stats ts ON ts.full_table_name = uf.table_name::text
ORDER BY
  CASE
    WHEN ts.estimated_rows > 10000 AND ts.sequential_scans > 100 THEN 1
    WHEN ts.estimated_rows > 5000 AND ts.sequential_scans > 50 THEN 2
    WHEN ts.estimated_rows > 1000 THEN 3
    ELSE 4
  END,
  ts.sequential_scans DESC NULLS LAST,
  ts.estimated_rows DESC NULLS LAST;

-- Alternative: Check specific high-traffic foreign keys
-- Uncomment and modify table names based on your usage patterns:

/*
-- Example: Check if job_assignments.job_id needs an index
EXPLAIN ANALYZE
SELECT ja.*
FROM job_assignments ja
JOIN jobs j ON j.id = ja.job_id
WHERE j.start_time > NOW();

-- Example: Check if timesheets.technician_id needs an index
EXPLAIN ANALYZE
SELECT t.*
FROM timesheets t
WHERE t.technician_id = 'some-uuid-here';
*/

-- To see overall index effectiveness:
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
