-- Migration: Add retry functionality for WhatsApp group creation
-- This allows admins to clear failed group creation requests and retry

-- Function to clear a failed WhatsApp group request
-- This removes the lock that prevents retrying group creation
CREATE OR REPLACE FUNCTION clear_whatsapp_group_request(
  p_job_id uuid,
  p_department text
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
  -- Set safe search_path as first executable line to prevent search path injection
  PERFORM set_config('search_path', 'public,pg_temp', true);

  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only admin and management can clear requests
  -- Explicitly handle NULL to prevent bypass
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only admin and management users can clear WhatsApp group requests';
  END IF;

  -- Validate department
  IF p_department NOT IN ('sound', 'lights', 'video') THEN
    RAISE EXCEPTION 'Invalid department. Must be sound, lights, or video';
  END IF;

  -- Check if a group was already successfully created
  -- If so, we shouldn't clear the request as it wasn't really a failure
  IF EXISTS (
    SELECT 1 FROM job_whatsapp_groups
    WHERE job_id = p_job_id AND department = p_department
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A WhatsApp group already exists for this job and department',
      'can_retry', false
    );
  END IF;

  -- Delete the failed request to allow retry
  DELETE FROM job_whatsapp_group_requests
  WHERE job_id = p_job_id AND department = p_department;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Return result
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
      'message', 'No failed request found for this job and department.',
      'can_retry', true,
      'deleted_count', 0
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clear_whatsapp_group_request(uuid, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION clear_whatsapp_group_request IS
'Clears a failed WhatsApp group creation request lock, allowing admins to retry group creation. Only admin and management roles can execute this function.';
