-- Optional orchestration records. Existing creation paths require no backfill.
CREATE TABLE public.setup_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('job', 'tour', 'tour_date')),
  entity_id uuid NOT NULL,
  -- Generated references enforce polymorphic entity integrity without copying data.
  job_id uuid GENERATED ALWAYS AS (CASE WHEN type = 'job' THEN entity_id END) STORED REFERENCES public.jobs(id) ON DELETE CASCADE,
  tour_id uuid GENERATED ALWAYS AS (CASE WHEN type = 'tour' THEN entity_id END) STORED REFERENCES public.tours(id) ON DELETE CASCADE,
  tour_date_id uuid GENERATED ALWAYS AS (CASE WHEN type = 'tour_date' THEN entity_id END) STORED REFERENCES public.tour_dates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'review', 'complete', 'cancelled')),
  current_step text NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((status = 'complete') = (completed_at IS NOT NULL)),
  CHECK (
    (type = 'job' AND current_step IN ('basic', 'departments', 'personnel', 'technical', 'resources', 'review'))
    OR (type = 'tour' AND current_step IN ('basic', 'departments', 'personnel', 'packages', 'dates', 'resources', 'review'))
    OR (type = 'tour_date' AND current_step IN ('defaults', 'overrides', 'resources', 'review'))
  )
);

CREATE INDEX setup_workflows_entity_idx ON public.setup_workflows(type, entity_id);
CREATE UNIQUE INDEX setup_workflows_one_active_idx ON public.setup_workflows(type, entity_id)
  WHERE status IN ('draft', 'in_progress', 'review');
CREATE INDEX setup_workflows_status_idx ON public.setup_workflows(status);
CREATE INDEX setup_workflows_assigned_to_idx ON public.setup_workflows(assigned_to);
CREATE INDEX setup_workflows_created_by_idx ON public.setup_workflows(created_by);
CREATE INDEX setup_workflows_job_idx ON public.setup_workflows(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX setup_workflows_tour_idx ON public.setup_workflows(tour_id) WHERE tour_id IS NOT NULL;
CREATE INDEX setup_workflows_tour_date_idx ON public.setup_workflows(tour_date_id) WHERE tour_date_id IS NOT NULL;

CREATE TABLE public.setup_workflow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.setup_workflows(id) ON DELETE CASCADE,
  task_key text NOT NULL CHECK (task_key ~ '^[a-z][a-z0-9_]*(:[a-z][a-z0-9_]*)?$'),
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'blocked')),
  required boolean NOT NULL DEFAULT true,
  responsible_role text NOT NULL CHECK (responsible_role IN ('assistant', 'technical', 'production', 'management')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  applicable boolean NOT NULL DEFAULT true,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, task_key),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
-- The unique index above also serves workflow_id lookups.
CREATE INDEX setup_workflow_tasks_status_idx ON public.setup_workflow_tasks(status);
CREATE INDEX setup_workflow_tasks_completed_by_idx ON public.setup_workflow_tasks(completed_by);

CREATE TRIGGER setup_workflows_updated_at BEFORE UPDATE ON public.setup_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER setup_workflow_tasks_updated_at BEFORE UPDATE ON public.setup_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.setup_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY setup_workflows_management_read ON public.setup_workflows
  FOR SELECT TO authenticated USING (public.is_admin_or_management());
CREATE POLICY setup_workflow_tasks_management_read ON public.setup_workflow_tasks
  FOR SELECT TO authenticated USING (public.is_admin_or_management());

-- All browser writes go through the transactional, authenticated RPC below.
-- Responsibility and assignment are metadata, not a new permission system.
REVOKE ALL ON public.setup_workflows, public.setup_workflow_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.setup_workflows, public.setup_workflow_tasks TO authenticated;
GRANT ALL ON public.setup_workflows, public.setup_workflow_tasks TO service_role;

COMMENT ON COLUMN public.setup_workflow_tasks.applicable IS
  'False retains retired task status, completion audit and metadata without counting it toward progress. Reintroduction restores applicability.';
