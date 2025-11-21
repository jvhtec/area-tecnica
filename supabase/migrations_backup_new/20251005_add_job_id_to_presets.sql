-- Scope presets to specific jobs (festival/single) when needed

ALTER TABLE public.presets
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_presets_job_department ON public.presets(job_id, department);

