-- Memoria Técnica has never been tied to a job (job_id exists on all three tables but
-- no insert call site populates it) and has zero concept of festival stage, even though
-- multi-stage festivals require one Memoria Técnica per stage. Add stage columns and a
-- per-(job, stage) uniqueness guarantee so the app can upsert "the" memoria for a given
-- job+stage instead of accumulating unbounded duplicate rows.
--
-- The unique index is partial (WHERE job_id IS NOT NULL) rather than covering the whole
-- table: every row inserted by today's app has job_id = NULL (it's never been wired up),
-- so a table-wide NULLS NOT DISTINCT constraint could collide with pre-existing orphaned
-- rows and fail to apply. Those orphaned rows aren't addressable by any consumer (nothing
-- queries these tables by job_id today), so excluding them from the constraint is safe
-- and avoids a destructive cleanup as part of this migration.

ALTER TABLE public.memoria_tecnica_documents
  ADD COLUMN IF NOT EXISTS stage_number integer,
  ADD COLUMN IF NOT EXISTS stage_name text;

ALTER TABLE public.lights_memoria_tecnica_documents
  ADD COLUMN IF NOT EXISTS stage_number integer,
  ADD COLUMN IF NOT EXISTS stage_name text;

ALTER TABLE public.video_memoria_tecnica_documents
  ADD COLUMN IF NOT EXISTS stage_number integer,
  ADD COLUMN IF NOT EXISTS stage_name text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_memoria_tecnica_documents_job_stage
  ON public.memoria_tecnica_documents (job_id, stage_number)
  NULLS NOT DISTINCT
  WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lights_memoria_tecnica_documents_job_stage
  ON public.lights_memoria_tecnica_documents (job_id, stage_number)
  NULLS NOT DISTINCT
  WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_video_memoria_tecnica_documents_job_stage
  ON public.video_memoria_tecnica_documents (job_id, stage_number)
  NULLS NOT DISTINCT
  WHERE job_id IS NOT NULL;
