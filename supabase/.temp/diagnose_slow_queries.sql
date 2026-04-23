-- Diagnostic: Identify Slow Queries
--
-- This query shows the slowest queries in your database
-- Run this in Supabase SQL Editor to see what's causing performance issues

-- Top 20 slowest queries by total time
SELECT
  query,
  calls,
  ROUND(total_exec_time::numeric, 2) as total_time_ms,
  ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
  ROUND(max_exec_time::numeric, 2) as max_time_ms,
  ROUND(min_exec_time::numeric, 2) as min_time_ms,
  rows,
  ROUND((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) as cache_hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Queries with most calls (high frequency)
SELECT
  query,
  calls,
  ROUND(mean_exec_time::numeric, 2) as mean_exec_time_ms,
  ROUND(total_exec_time::numeric, 2) as total_exec_time_ms,
  ROUND((100.0 * calls / SUM(calls) OVER ())::numeric, 2) as pct_of_total_calls
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY calls DESC
LIMIT 20;

-- Queries with highest average execution time
SELECT
  query,
  calls,
  ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
  ROUND(max_exec_time::numeric, 2) as max_time_ms,
  ROUND(total_exec_time::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
  AND calls > 10  -- Filter out one-off queries
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Summary statistics
SELECT
  COUNT(*) as total_queries,
  SUM(calls) as total_calls,
  ROUND(AVG(mean_exec_time)::numeric, 2) as avg_mean_time,
  ROUND(MAX(max_exec_time)::numeric, 2) as slowest_query_time,
  COUNT(*) FILTER (WHERE mean_exec_time > 1000) as queries_over_1s,
  COUNT(*) FILTER (WHERE mean_exec_time > 100) as queries_over_100ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%';
