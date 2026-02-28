-- Make WhatsApp groups stage-aware so festivals can create one group per stage.

ALTER TABLE public.job_whatsapp_group_requests
  ADD COLUMN IF NOT EXISTS stage_number integer NOT NULL DEFAULT 0;

ALTER TABLE public.job_whatsapp_groups
  ADD COLUMN IF NOT EXISTS stage_number integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_whatsapp_group_requests_stage_number_check'
      AND conrelid = 'public.job_whatsapp_group_requests'::regclass
  ) THEN
    ALTER TABLE public.job_whatsapp_group_requests
      ADD CONSTRAINT job_whatsapp_group_requests_stage_number_check
      CHECK (stage_number >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_whatsapp_groups_stage_number_check'
      AND conrelid = 'public.job_whatsapp_groups'::regclass
  ) THEN
    ALTER TABLE public.job_whatsapp_groups
      ADD CONSTRAINT job_whatsapp_groups_stage_number_check
      CHECK (stage_number >= 0);
  END IF;
END
$$;

ALTER TABLE public.job_whatsapp_group_requests
  DROP CONSTRAINT IF EXISTS job_whatsapp_group_requests_job_id_department_key;

ALTER TABLE public.job_whatsapp_groups
  DROP CONSTRAINT IF EXISTS job_whatsapp_groups_job_id_department_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_whatsapp_group_requests_job_id_department_stage_number_key'
      AND conrelid = 'public.job_whatsapp_group_requests'::regclass
  ) THEN
    ALTER TABLE public.job_whatsapp_group_requests
      ADD CONSTRAINT job_whatsapp_group_requests_job_id_department_stage_number_key
      UNIQUE (job_id, department, stage_number);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_whatsapp_groups_job_id_department_stage_number_key'
      AND conrelid = 'public.job_whatsapp_groups'::regclass
  ) THEN
    ALTER TABLE public.job_whatsapp_groups
      ADD CONSTRAINT job_whatsapp_groups_job_id_department_stage_number_key
      UNIQUE (job_id, department, stage_number);
  END IF;
END
$$;

-- Main stage-aware retry function
CREATE OR REPLACE FUNCTION public.clear_whatsapp_group_request(
  p_job_id uuid,
  p_department text,
  p_stage_number integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role user_role;
  v_result json;
  v_deleted_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only admin and management users can clear WhatsApp group requests';
  END IF;

  IF p_department NOT IN ('sound', 'lights', 'video') THEN
    RAISE EXCEPTION 'Invalid department. Must be sound, lights, or video';
  END IF;

  IF p_stage_number IS NULL OR p_stage_number < 0 THEN
    RAISE EXCEPTION 'Invalid stage_number. Must be >= 0';
  END IF;

  IF EXISTS (
    SELECT 1 FROM job_whatsapp_groups
    WHERE job_id = p_job_id
      AND department = p_department
      AND stage_number = p_stage_number
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A WhatsApp group already exists for this job, department, and stage',
      'can_retry', false
    );
  END IF;

  DELETE FROM job_whatsapp_group_requests
  WHERE job_id = p_job_id
    AND department = p_department
    AND stage_number = p_stage_number;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    v_result := json_build_object(
      'success', true,
      'message', 'Failed request cleared. You can now retry group creation.',
      'can_retry', true,
      'deleted_count', v_deleted_count
    );
  ELSE
    v_result := json_build_object(
      'success', false,
      'message', 'No failed request found for this job, department, and stage.',
      'can_retry', true,
      'deleted_count', 0
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Backward-compatible wrapper for existing call sites that do not pass stage_number.
CREATE OR REPLACE FUNCTION public.clear_whatsapp_group_request(
  p_job_id uuid,
  p_department text
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.clear_whatsapp_group_request(p_job_id, p_department, 0);
$$;

GRANT EXECUTE ON FUNCTION public.clear_whatsapp_group_request(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_whatsapp_group_request(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.clear_whatsapp_group_request(uuid, text, integer) IS
'Clears a failed WhatsApp group creation request lock by job, department, and stage_number (0 means non-stage/global). Only admin and management roles can execute this function.';

COMMENT ON FUNCTION public.clear_whatsapp_group_request(uuid, text) IS
'Backward-compatible wrapper for clear_whatsapp_group_request that targets stage_number 0.';
