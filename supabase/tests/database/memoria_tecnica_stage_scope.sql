CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(9);

SELECT has_column('public', 'memoria_tecnica_documents', 'stage_number', 'sound memoria gains stage_number');
SELECT has_column('public', 'memoria_tecnica_documents', 'stage_name', 'sound memoria gains stage_name');
SELECT has_column('public', 'lights_memoria_tecnica_documents', 'stage_number', 'lights memoria gains stage_number');
SELECT has_column('public', 'video_memoria_tecnica_documents', 'stage_number', 'video memoria gains stage_number');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'memoria_tecnica_documents'
      AND indexname = 'ux_memoria_tecnica_documents_job_stage'
      AND indexdef ILIKE '%NULLS NOT DISTINCT%'
      AND indexdef ILIKE '%WHERE (job_id IS NOT NULL)%'
  ),
  'sound memoria has a partial per-(job, stage) unique index treating NULL stage as a real value'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'lights_memoria_tecnica_documents'
      AND indexname = 'ux_lights_memoria_tecnica_documents_job_stage'
      AND indexdef ILIKE '%NULLS NOT DISTINCT%'
  ),
  'lights memoria has the matching partial unique index'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'video_memoria_tecnica_documents'
      AND indexname = 'ux_video_memoria_tecnica_documents_job_stage'
      AND indexdef ILIKE '%NULLS NOT DISTINCT%'
  ),
  'video memoria has the matching partial unique index'
);

-- Exercise the constraint directly: two NULL-stage rows for the same job must collide,
-- but rows with job_id IS NULL (pre-existing orphans) are exempt.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  '50000000-0000-0000-0000-000000000001'::uuid,
  'Memoria Stage Scope Test',
  '2026-07-05 08:00:00+02'::timestamptz,
  '2026-07-06 02:00:00+02'::timestamptz,
  'festival'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memoria_tecnica_documents (job_id, project_name, stage_number)
VALUES ('50000000-0000-0000-0000-000000000001'::uuid, 'Memoria Stage Scope Test', NULL);

SELECT throws_ok(
  $$INSERT INTO public.memoria_tecnica_documents (job_id, project_name, stage_number)
    VALUES ('50000000-0000-0000-0000-000000000001'::uuid, 'Memoria Stage Scope Test (dup)', NULL)$$,
  '23505',
  NULL,
  'a second NULL-stage row for the same job violates the partial unique index'
);

SELECT lives_ok(
  $$INSERT INTO public.memoria_tecnica_documents (job_id, project_name)
    VALUES (NULL, 'Orphan Legacy Row')$$,
  'pre-existing job_id-less rows remain unaffected by the constraint'
);

SELECT * FROM finish();
