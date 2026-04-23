-- ============================================================================
-- Manual Achievement Award Function
-- Allows admins/management to manually award achievements to users
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_award_achievement(
  p_user_id uuid,
  p_achievement_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_requester_id uuid;
  v_awarded_by_role user_role;
  v_achievement_exists boolean;
  v_unlock_id uuid;
BEGIN
  -- Set explicit search_path for security (prevent schema hijacking)
  SET search_path = public, pg_catalog;

  -- Get the current user from auth context
  v_requester_id := auth.uid();

  -- Reject if no authenticated user
  IF v_requester_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to award achievements'
    );
  END IF;

  -- Check if requester is admin or management
  SELECT role INTO v_awarded_by_role
  FROM profiles
  WHERE id = v_requester_id;

  -- Reject if no profile found or role is not admin/management
  IF v_awarded_by_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  IF v_awarded_by_role NOT IN ('admin', 'management') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins and management can award achievements'
    );
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target user not found'
    );
  END IF;

  -- Check if achievement exists and is active
  SELECT EXISTS (
    SELECT 1 FROM achievements
    WHERE id = p_achievement_id AND is_active = true
  ) INTO v_achievement_exists;

  IF NOT v_achievement_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Achievement does not exist or is not active'
    );
  END IF;

  -- Atomically create unlock record (prevents TOCTOU race)
  -- ON CONFLICT handles concurrent requests gracefully
  INSERT INTO achievement_unlocks (user_id, achievement_id, unlocked_at, seen)
  VALUES (p_user_id, p_achievement_id, now(), false)
  ON CONFLICT (user_id, achievement_id) DO NOTHING
  RETURNING id INTO v_unlock_id;

  -- If v_unlock_id IS NULL, the conflict occurred (user already has achievement)
  IF v_unlock_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already has this achievement'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'unlock_id', v_unlock_id,
    'message', 'Achievement awarded successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (function derives caller from auth.uid() and checks role internally)
GRANT EXECUTE ON FUNCTION manually_award_achievement(uuid, uuid) TO authenticated;
