-- Migration: Create atomic manage_assignment_lifecycle RPC
-- Replaces non-transactional client-side multi-step operations with
-- a single atomic server-side function with row-level locking

CREATE OR REPLACE FUNCTION manage_assignment_lifecycle(
  p_job_id UUID,
  p_technician_id UUID,
  p_action TEXT,            -- 'confirm' | 'decline' | 'cancel'
  p_delete_mode TEXT DEFAULT 'soft', -- 'soft' | 'hard'
  p_actor_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_assignment_id UUID;
  v_previous_status TEXT;
  v_affected_timesheets INT := 0;
  v_assignment_source TEXT;
BEGIN
  -- Validate action
  IF p_action NOT IN ('confirm', 'decline', 'cancel') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'invalid_action',
      'message', 'Action must be confirm, decline, or cancel'
    );
  END IF;

  -- Validate delete mode
  IF p_delete_mode NOT IN ('soft', 'hard') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_delete_mode',
      'message', 'Delete mode must be soft or hard'
    );
  END IF;

  -- Lock the assignment row for update (NOWAIT to fail fast if locked)
  BEGIN
    SELECT id, status, assignment_source 
    INTO v_assignment_id, v_previous_status, v_assignment_source
    FROM job_assignments
    WHERE job_id = p_job_id AND technician_id = p_technician_id
    FOR UPDATE NOWAIT;
  EXCEPTION 
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'assignment_locked',
        'message', 'Assignment is being modified by another operation'
      );
  END;

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'assignment_not_found',
      'message', 'No assignment found for this job and technician'
    );
  END IF;

  -- Process based on action
  CASE p_action
    WHEN 'confirm' THEN
      -- Check for conflicts before confirming
      PERFORM 1 FROM timesheets t1
      WHERE t1.technician_id = p_technician_id
        AND t1.is_active = true
        AND t1.job_id != p_job_id
        AND t1.date IN (
          SELECT t2.date FROM timesheets t2
          WHERE t2.job_id = p_job_id 
            AND t2.technician_id = p_technician_id
            AND t2.is_active = true
        );

      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'conflict_detected',
          'message', 'Technician has conflicting assignments on these dates'
        );
      END IF;

      -- Update assignment status
      UPDATE job_assignments
      SET status = 'confirmed', response_time = NOW()
      WHERE id = v_assignment_id;

      -- Log the action
      INSERT INTO assignment_audit_log (
        assignment_id, job_id, technician_id, action,
        previous_status, new_status, actor_id, metadata
      ) VALUES (
        v_assignment_id, p_job_id, p_technician_id, 'confirmed',
        v_previous_status, 'confirmed', COALESCE(p_actor_id, auth.uid()), p_metadata
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'confirmed',
        'assignment_id', v_assignment_id
      );

    WHEN 'decline', 'cancel' THEN
      IF p_delete_mode = 'hard' THEN
        -- Hard delete: count timesheets, delete them, then delete assignment
        SELECT COUNT(*) INTO v_affected_timesheets
        FROM timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        -- Delete timesheets first (trigger will also do this, but explicit is clearer)
        DELETE FROM timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        -- Log BEFORE deleting the assignment (so we capture the assignment_id)
        INSERT INTO assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'hard_deleted',
          v_previous_status, NULL, COALESCE(p_actor_id, auth.uid()), 
          p_metadata || jsonb_build_object('assignment_source', v_assignment_source),
          v_affected_timesheets
        );

        -- Delete the assignment
        DELETE FROM job_assignments WHERE id = v_assignment_id;

        v_result := jsonb_build_object(
          'success', true,
          'action', 'hard_deleted',
          'assignment_id', v_assignment_id,
          'deleted_timesheets', v_affected_timesheets
        );

      ELSE
        -- Soft delete: mark as declined, void timesheets
        UPDATE job_assignments
        SET status = 'declined', response_time = NOW()
        WHERE id = v_assignment_id;

        -- Void timesheets (set is_active = false)
        UPDATE timesheets
        SET is_active = false
        WHERE job_id = p_job_id AND technician_id = p_technician_id
          AND is_active = true;
        GET DIAGNOSTICS v_affected_timesheets = ROW_COUNT;

        -- Log the action
        INSERT INTO assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'soft_deleted',
          v_previous_status, 'declined', COALESCE(p_actor_id, auth.uid()), p_metadata,
          v_affected_timesheets
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'soft_deleted',
          'assignment_id', v_assignment_id,
          'voided_timesheets', v_affected_timesheets
        );
      END IF;

  END CASE;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't expose internal details
    RAISE WARNING 'manage_assignment_lifecycle error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'internal_error',
      'message', 'An unexpected error occurred'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION manage_assignment_lifecycle TO authenticated;
GRANT EXECUTE ON FUNCTION manage_assignment_lifecycle TO service_role;

COMMENT ON FUNCTION manage_assignment_lifecycle IS 
  'Atomic assignment lifecycle management with row-level locking and audit logging. 
   Replaces non-transactional client-side operations for data integrity.';
