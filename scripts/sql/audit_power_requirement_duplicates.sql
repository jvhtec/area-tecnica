-- Audit: orphaned power_requirement_tables rows that duplicate the Hoja de Ruta
-- power summary.
--
-- READ ONLY. Safe to paste into the Supabase SQL editor.
--
-- Background
-- ----------
-- The Consumos calculator writes a whole generation of rows and sweeps the
-- stale ones PER STAGE, so that saving one stage of a festival never deletes
-- another stage's tables. That sweep cannot see a row whose stage changed: a
-- table built with no stage selected and later saved under a stage — or removed
-- from the editor while a different stage was selected — stays filed under a
-- stage the new payload never mentions.
--
-- The reader (getCurrentPowerRequirementTables) groups by `department:stage`,
-- so the orphan becomes its own scope with its own "latest generation" and
-- survives deduplication. formatPowerRequirementsText then lists the same table
-- twice and the duplicate shows up in the Hoja de Ruta.
--
-- Saves made after the retirement fix clean these up for the scopes they touch.
-- This script shows what is still out there.

with scoped as (
  select
    t.id,
    t.job_id,
    t.department,
    t.table_name,
    t.created_at,
    t.table_data ->> 'generationTimestamp' as generation_timestamp,
    -- Mirrors getPowerRequirementStageNumber: column first, then table_data.
    coalesce(
      t.stage_number,
      case
        when t.table_data ->> 'stageNumber' ~ '^[0-9]+$'
          then (t.table_data ->> 'stageNumber')::int
      end
    ) as stage_number,
    -- Mirrors getPowerRequirementStageName.
    coalesce(
      nullif(btrim(t.stage_name), ''),
      nullif(btrim(t.table_data ->> 'stageName'), '')
    ) as stage_name
  from public.power_requirement_tables t
),
keyed as (
  select
    s.*,
    -- Mirrors getStageKey, which is what the reader scopes on.
    case
      when s.stage_number is not null then 'stage-' || s.stage_number
      when s.stage_name is not null then 'stage-name-' || lower(s.stage_name)
      else 'no-stage'
    end as stage_key,
    lower(btrim(coalesce(s.table_name, ''))) as table_key
  from scoped s
)

-- 1. High confidence: the same table name filed under both a stage and
--    "no stage" in one department. A genuine multi-stage job assigns every
--    table to a stage, so this mix is the stage-move orphan.
select
  'likely-orphan' as finding,
  k.job_id,
  j.title as job_title,
  k.department,
  min(k.table_name) as table_name,
  count(*) as row_count,
  array_agg(distinct k.stage_key order by k.stage_key) as stage_scopes,
  min(k.created_at) as oldest_row,
  max(k.created_at) as newest_row
from keyed k
left join public.jobs j on j.id = k.job_id
group by k.job_id, j.title, k.department, k.table_key
having count(distinct k.stage_key) > 1
   and bool_or(k.stage_key = 'no-stage')
   and bool_or(k.stage_key <> 'no-stage')
order by row_count desc, k.job_id;

-- 2. Blast radius: one row per job/department, with how many scopes and
--    generations it carries. A department showing both "no stage" and staged
--    scopes is worth a look even when no table name matches.
with scoped as (
  select
    t.job_id,
    t.department,
    t.table_data ->> 'generationTimestamp' as generation_timestamp,
    coalesce(
      t.stage_number,
      case
        when t.table_data ->> 'stageNumber' ~ '^[0-9]+$'
          then (t.table_data ->> 'stageNumber')::int
      end
    ) as stage_number,
    coalesce(
      nullif(btrim(t.stage_name), ''),
      nullif(btrim(t.table_data ->> 'stageName'), '')
    ) as stage_name
  from public.power_requirement_tables t
),
keyed as (
  select
    s.*,
    case
      when s.stage_number is not null then 'stage-' || s.stage_number
      when s.stage_name is not null then 'stage-name-' || lower(s.stage_name)
      else 'no-stage'
    end as stage_key
  from scoped s
)
select
  k.job_id,
  j.title as job_title,
  k.department,
  count(*) as row_count,
  count(distinct k.stage_key) as stage_scopes,
  count(distinct k.generation_timestamp) as generations,
  bool_or(k.stage_key = 'no-stage') as has_unstaged_rows,
  bool_or(k.stage_key <> 'no-stage') as has_staged_rows,
  array_agg(distinct k.stage_key order by k.stage_key) as scopes
from keyed k
left join public.jobs j on j.id = k.job_id
group by k.job_id, j.title, k.department
having count(distinct k.stage_key) > 1
order by
  (bool_or(k.stage_key = 'no-stage') and bool_or(k.stage_key <> 'no-stage')) desc,
  count(*) desc;

-- 3. Totals, for a one-line answer to "how bad is it".
with scoped as (
  select
    t.job_id,
    t.department,
    coalesce(
      t.stage_number,
      case
        when t.table_data ->> 'stageNumber' ~ '^[0-9]+$'
          then (t.table_data ->> 'stageNumber')::int
      end
    ) as stage_number,
    coalesce(
      nullif(btrim(t.stage_name), ''),
      nullif(btrim(t.table_data ->> 'stageName'), '')
    ) as stage_name
  from public.power_requirement_tables t
),
keyed as (
  select
    s.*,
    case
      when s.stage_number is not null then 'stage-' || s.stage_number
      when s.stage_name is not null then 'stage-name-' || lower(s.stage_name)
      else 'no-stage'
    end as stage_key
  from scoped s
),
per_scope as (
  select
    k.job_id,
    k.department,
    bool_or(k.stage_key = 'no-stage') as has_unstaged_rows,
    bool_or(k.stage_key <> 'no-stage') as has_staged_rows
  from keyed k
  group by k.job_id, k.department
)
select
  (select count(*) from public.power_requirement_tables) as total_rows,
  (select count(distinct job_id) from public.power_requirement_tables) as total_jobs,
  count(*) filter (where has_unstaged_rows and has_staged_rows) as mixed_scope_job_departments,
  count(distinct job_id) filter (where has_unstaged_rows and has_staged_rows) as affected_jobs
from per_scope;
