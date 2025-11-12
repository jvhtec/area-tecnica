-- Activity logging backbone with visibility controls and realtime support

-- 0) Enum for visibility
DO $$
BEGIN
  CREATE TYPE public.activity_visibility AS ENUM ('management', 'house_plus_job', 'job_participants', 'actor_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- 1) Event catalog
CREATE TABLE IF NOT EXISTS public.activity_catalog (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  default_visibility public.activity_visibility NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  toast_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Activity log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES public.activity_catalog(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  job_id UUID,
  actor_id UUID NOT NULL,
  actor_name TEXT,
  entity_type TEXT,
  entity_id TEXT,
  visibility public.activity_visibility NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_job_created_at ON public.activity_log(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_code ON public.activity_log(code);

-- 3) Per-user read markers
CREATE TABLE IF NOT EXISTS public.activity_reads (
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES public.activity_log(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_id)
);

-- 4) Per-user preferences
CREATE TABLE IF NOT EXISTS public.activity_prefs (
  user_id UUID PRIMARY KEY,
  muted_codes TEXT[] DEFAULT '{}'::TEXT[],
  mute_toasts BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_activity_prefs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_prefs_updated ON public.activity_prefs;
CREATE TRIGGER trg_activity_prefs_updated
BEFORE UPDATE ON public.activity_prefs
FOR EACH ROW
EXECUTE FUNCTION public.touch_activity_prefs_updated_at();

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_catalog ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.activity_catalog TO authenticated, anon, service_role;
GRANT SELECT ON public.activity_log TO authenticated, service_role;
GRANT INSERT, DELETE ON public.activity_reads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.activity_prefs TO authenticated, service_role;

-- RLS policies for catalog (read only)
DROP POLICY IF EXISTS activity_catalog_read ON public.activity_catalog;
CREATE POLICY activity_catalog_read
ON public.activity_catalog
FOR SELECT
USING (TRUE);

-- RLS policies for log visibility
DROP POLICY IF EXISTS activity_log_management ON public.activity_log;
CREATE POLICY activity_log_management
ON public.activity_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('management', 'admin')
  )
);

DROP POLICY IF EXISTS activity_log_actor_only ON public.activity_log;
CREATE POLICY activity_log_actor_only
ON public.activity_log
FOR SELECT
USING (
  visibility = 'actor_only' AND actor_id = auth.uid()
);

DROP POLICY IF EXISTS activity_log_job_participants ON public.activity_log;
CREATE POLICY activity_log_job_participants
ON public.activity_log
FOR SELECT
USING (
  visibility = 'job_participants'
  AND job_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    WHERE ja.job_id = public.activity_log.job_id
      AND ja.technician_id = auth.uid()
  )
);

DROP POLICY IF EXISTS activity_log_house_plus ON public.activity_log;
CREATE POLICY activity_log_house_plus
ON public.activity_log
FOR SELECT
USING (
  visibility = 'house_plus_job'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'house_tech'
  )
);

-- RLS policies for reads and prefs (self-access)
DROP POLICY IF EXISTS activity_reads_owner ON public.activity_reads;
CREATE POLICY activity_reads_owner
ON public.activity_reads
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS activity_prefs_owner ON public.activity_prefs;
CREATE POLICY activity_prefs_owner
ON public.activity_prefs
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Seed catalog entries
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  ('job.created','Job created','house_plus_job','success',TRUE,'{actor_name} created job {job_title}'),
  ('job.updated','Job updated','job_participants','info',TRUE,'{actor_name} updated job {job_title}'),
  ('job.deleted','Job deleted','management','warn',TRUE,'{actor_name} deleted a job'),
  ('job.calltime.updated','Call time updated','job_participants','info',TRUE,'Call time updated for {job_title}'),
  ('document.uploaded','Document uploaded','job_participants','success',TRUE,'{actor_name} uploaded {file_name}'),
  ('document.deleted','Document deleted','job_participants','warn',TRUE,'{actor_name} deleted {file_name}'),
  ('hoja.updated','Hoja de ruta updated','job_participants','info',TRUE,'{actor_name} updated Hoja de ruta'),
  ('flex.folders.created','Flex folders created','job_participants','success',TRUE,'Flex folders created: {folder}'),
  ('flex.crew.updated','Flex crew updated','job_participants','info',TRUE,'Crew synced to Flex'),
  ('staffing.availability.sent','Availability email sent','management','info',FALSE,'Sent availability email to {tech_name}'),
  ('staffing.availability.confirmed','Availability confirmed','management','success',TRUE,'{tech_name} confirmed availability'),
  ('staffing.availability.declined','Availability declined','management','warn',TRUE,'{tech_name} declined availability'),
  ('staffing.offer.sent','Offer email sent','management','info',FALSE,'Offer sent to {tech_name}'),
  ('staffing.offer.confirmed','Offer accepted','job_participants','success',TRUE,'{tech_name} accepted offer'),
  ('staffing.offer.declined','Offer declined','management','warn',TRUE,'{tech_name} declined offer'),
  ('assignment.created','Assignment created','job_participants','success',TRUE,'{actor_name} assigned {tech_name}'),
  ('assignment.updated','Assignment updated','job_participants','info',TRUE,'Assignment updated for {tech_name}'),
  ('assignment.removed','Assignment removed','job_participants','warn',TRUE,'{actor_name} removed {tech_name}'),
  ('timesheet.submitted','Timesheet submitted','management','info',TRUE,'{actor_name} submitted timesheet'),
  ('timesheet.approved','Timesheet approved','job_participants','success',TRUE,'Timesheet approved'),
  ('timesheet.rejected','Timesheet rejected','management','warn',TRUE,'Timesheet rejected'),
  ('announcement.posted','Announcement posted','job_participants','info',TRUE,'{title}'),
  ('calendar.exported','Calendar exported','management','info',FALSE,'Calendar export generated')
ON CONFLICT (code) DO NOTHING;

-- Visibility resolver
CREATE OR REPLACE FUNCTION public.resolve_visibility(
  _code TEXT,
  _job_id UUID,
  _actor_id UUID
) RETURNS public.activity_visibility
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vis public.activity_visibility;
BEGIN
  IF _code LIKE 'timesheet.%' THEN
    IF _code = 'timesheet.approved' THEN
      RETURN 'job_participants';
    ELSE
      RETURN 'management';
    END IF;
  END IF;

  IF _code LIKE 'staffing.availability.%' THEN
    RETURN 'management';
  END IF;

  SELECT default_visibility
    INTO vis
  FROM public.activity_catalog
  WHERE code = _code;

  IF vis IS NULL THEN
    RETURN 'job_participants';
  END IF;

  RETURN vis;
END;
$$;

-- Main logger
CREATE OR REPLACE FUNCTION public.log_activity(
  _code TEXT,
  _job_id UUID,
  _entity_type TEXT,
  _entity_id TEXT,
  _payload JSONB DEFAULT '{}'::JSONB,
  _visibility public.activity_visibility DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aid UUID := gen_random_uuid();
  actor_name TEXT;
  resolved_visibility public.activity_visibility;
  requester UUID := auth.uid();
  effective_payload JSONB := COALESCE(_payload, '{}'::jsonb);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_catalog WHERE code = _code) THEN
    RAISE EXCEPTION 'Unknown activity code %', _code;
  END IF;

  IF requester IS NULL THEN
    requester := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      p.email,
      'System'
    )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = requester;

  IF actor_name IS NULL THEN
    actor_name := 'System';
  END IF;

  resolved_visibility := COALESCE(_visibility, public.resolve_visibility(_code, _job_id, requester));

  INSERT INTO public.activity_log(id, code, job_id, actor_id, actor_name, entity_type, entity_id, visibility, payload)
  VALUES (aid, _code, _job_id, requester, actor_name, _entity_type, _entity_id, resolved_visibility, effective_payload);

  RETURN aid;
END;
$$;

-- Service-role logger
CREATE OR REPLACE FUNCTION public.log_activity_as(
  _actor_id UUID,
  _code TEXT,
  _job_id UUID,
  _entity_type TEXT,
  _entity_id TEXT,
  _payload JSONB DEFAULT '{}'::JSONB,
  _visibility public.activity_visibility DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aid UUID := gen_random_uuid();
  actor_name TEXT;
  actor UUID := COALESCE(_actor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  resolved_visibility public.activity_visibility;
  effective_payload JSONB := COALESCE(_payload, '{}'::jsonb);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_catalog WHERE code = _code) THEN
    RAISE EXCEPTION 'Unknown activity code %', _code;
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      p.email,
      'System'
    )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = actor;

  IF actor_name IS NULL THEN
    actor_name := 'System';
  END IF;

  resolved_visibility := COALESCE(_visibility, public.resolve_visibility(_code, _job_id, actor));

  INSERT INTO public.activity_log(id, code, job_id, actor_id, actor_name, entity_type, entity_id, visibility, payload)
  VALUES (aid, _code, _job_id, actor, actor_name, _entity_type, _entity_id, resolved_visibility, effective_payload);

  RETURN aid;
END;
$$;

-- Permissions for RPCs
GRANT EXECUTE ON FUNCTION public.resolve_visibility(TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, UUID, TEXT, TEXT, JSONB, public.activity_visibility) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_activity_as(UUID, TEXT, UUID, TEXT, TEXT, JSONB, public.activity_visibility) TO service_role;

-- Helper to diff JSON payloads for meaningful updates
CREATE OR REPLACE FUNCTION public.json_diff_public(_old JSONB, _new JSONB, allowed TEXT[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, jsonb_build_object('from', _old->key, 'to', _new->key)),
    '{}'::jsonb
  )
  FROM jsonb_each(_new)
  WHERE key = ANY(allowed)
    AND (_old->key) IS DISTINCT FROM (_new->key);
$$;

-- Trigger functions -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_log_job_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(
    'job.created',
    NEW.id,
    'job',
    NEW.id::text,
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_job_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  diff JSONB;
BEGIN
  diff := public.json_diff_public(to_jsonb(OLD), to_jsonb(NEW), ARRAY['title','description','status','start_time','end_time','timezone','job_type','location_id']);
  IF diff <> '{}'::jsonb THEN
    PERFORM public.log_activity(
      'job.updated',
      NEW.id,
      'job',
      NEW.id::text,
      jsonb_build_object('diff', diff, 'title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_timesheet_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    PERFORM public.log_activity(
      'timesheet.submitted',
      NEW.job_id,
      'timesheet',
      NEW.id::text,
      jsonb_build_object('break_minutes', NEW.break_minutes)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_timesheet_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'submitted' THEN
    PERFORM public.log_activity(
      'timesheet.submitted',
      NEW.job_id,
      'timesheet',
      NEW.id::text,
      jsonb_build_object('break_minutes', NEW.break_minutes)
    );
  END IF;

  IF COALESCE(OLD.approved_by_manager, FALSE) IS DISTINCT FROM COALESCE(NEW.approved_by_manager, FALSE) THEN
    IF NEW.approved_by_manager THEN
      PERFORM public.log_activity(
        'timesheet.approved',
        NEW.job_id,
        'timesheet',
        NEW.id::text,
        '{}'::jsonb
      );
    ELSE
      PERFORM public.log_activity(
        'timesheet.rejected',
        NEW.job_id,
        'timesheet',
        NEW.id::text,
        '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_assignment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(
    'assignment.created',
    NEW.job_id,
    'assignment',
    NEW.technician_id::text,
    jsonb_build_object('technician_id', NEW.technician_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (ROW(OLD.job_id, OLD.technician_id, OLD.status) IS DISTINCT FROM ROW(NEW.job_id, NEW.technician_id, NEW.status)) THEN
    PERFORM public.log_activity(
      'assignment.updated',
      NEW.job_id,
      'assignment',
      NEW.technician_id::text,
      jsonb_build_object('technician_id', NEW.technician_id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_assignment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(
    'assignment.removed',
    OLD.job_id,
    'assignment',
    OLD.technician_id::text,
    jsonb_build_object('technician_id', OLD.technician_id)
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_staffing_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.phase = 'availability' AND NEW.status = 'confirmed' THEN
      PERFORM public.log_activity('staffing.availability.confirmed', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'availability' AND NEW.status = 'declined' THEN
      PERFORM public.log_activity('staffing.availability.declined', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'offer' AND NEW.status = 'confirmed' THEN
      PERFORM public.log_activity('staffing.offer.confirmed', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'offer' AND NEW.status = 'declined' THEN
      PERFORM public.log_activity('staffing.offer.declined', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_document_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(
    'document.uploaded',
    NEW.job_id,
    'document',
    NEW.id::text,
    jsonb_build_object('file_name', NEW.file_name)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_document_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(
    'document.deleted',
    OLD.job_id,
    'document',
    OLD.id::text,
    jsonb_build_object('file_name', OLD.file_name)
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_hoja_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    PERFORM public.log_activity(
      'hoja.updated',
      NEW.job_id,
      'hoja',
      NEW.id::text,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers when tables exist
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_ai_jobs_activity ON public.jobs';
    EXECUTE 'CREATE TRIGGER t_ai_jobs_activity AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.trg_log_job_created()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_au_jobs_activity ON public.jobs';
    EXECUTE 'CREATE TRIGGER t_au_jobs_activity AFTER UPDATE ON public.jobs FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.trg_log_job_updated()';
  END IF;

  IF to_regclass('public.timesheets') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_ai_timesheets_activity ON public.timesheets';
    EXECUTE 'CREATE TRIGGER t_ai_timesheets_activity AFTER INSERT ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.trg_log_timesheet_insert()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_au_timesheets_activity ON public.timesheets';
    EXECUTE 'CREATE TRIGGER t_au_timesheets_activity AFTER UPDATE ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.trg_log_timesheet_update()';
  END IF;

  IF to_regclass('public.job_assignments') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_ai_job_assignments_activity ON public.job_assignments';
    EXECUTE 'CREATE TRIGGER t_ai_job_assignments_activity AFTER INSERT ON public.job_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_log_assignment_insert()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_au_job_assignments_activity ON public.job_assignments';
    EXECUTE 'CREATE TRIGGER t_au_job_assignments_activity AFTER UPDATE ON public.job_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_log_assignment_update()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_ad_job_assignments_activity ON public.job_assignments';
    EXECUTE 'CREATE TRIGGER t_ad_job_assignments_activity AFTER DELETE ON public.job_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_log_assignment_delete()';
  END IF;

  IF to_regclass('public.staffing_requests') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_au_staffing_requests_activity ON public.staffing_requests';
    EXECUTE 'CREATE TRIGGER t_au_staffing_requests_activity AFTER UPDATE ON public.staffing_requests FOR EACH ROW EXECUTE FUNCTION public.trg_log_staffing_update()';
  END IF;

  IF to_regclass('public.job_documents') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_ai_job_documents_activity ON public.job_documents';
    EXECUTE 'CREATE TRIGGER t_ai_job_documents_activity AFTER INSERT ON public.job_documents FOR EACH ROW EXECUTE FUNCTION public.trg_log_document_insert()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_ad_job_documents_activity ON public.job_documents';
    EXECUTE 'CREATE TRIGGER t_ad_job_documents_activity AFTER DELETE ON public.job_documents FOR EACH ROW EXECUTE FUNCTION public.trg_log_document_delete()';
  END IF;

  IF to_regclass('public.hoja_de_ruta') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_au_hoja_de_ruta_activity ON public.hoja_de_ruta';
    EXECUTE 'CREATE TRIGGER t_au_hoja_de_ruta_activity AFTER UPDATE ON public.hoja_de_ruta FOR EACH ROW EXECUTE FUNCTION public.trg_log_hoja_update()';
  END IF;
END;
$$;
