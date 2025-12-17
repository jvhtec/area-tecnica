-- Diagnostic: Identify Slow Queries
--
-- This query shows the slowest queries in your database
-- Run this in Supabase SQL Editor to see what's causing performance issues

-- Top 20 slowest queries by total time
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  min_exec_time,
  stddev_exec_time,
  rows,
  shared_blks_hit,
  shared_blks_read,
  ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_rate
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Queries with most calls (high frequency)
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time,
  ROUND(100.0 * calls / SUM(calls) OVER (), 2) as pct_of_total_calls
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY calls DESC
LIMIT 20;

-- Queries with highest average execution time
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
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
  ROUND(AVG(mean_exec_time), 2) as avg_mean_time,
  ROUND(MAX(max_exec_time), 2) as slowest_query_time,
  COUNT(*) FILTER (WHERE mean_exec_time > 1000) as queries_over_1s,
  COUNT(*) FILTER (WHERE mean_exec_time > 100) as queries_over_100ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%';
