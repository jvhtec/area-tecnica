-- ============================================================================
-- Manual Achievement Award Function
-- Allows admins/management to manually award achievements to users
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_award_achievement(
  p_user_id uuid,
  p_achievement_id uuid,
  p_awarded_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_awarded_by_role user_role;
  v_achievement_exists boolean;
  v_already_unlocked boolean;
  v_unlock_id uuid;
BEGIN
  -- Check if awarder is admin or management
  SELECT role INTO v_awarded_by_role
  FROM profiles
  WHERE id = p_awarded_by;

  IF v_awarded_by_role NOT IN ('admin', 'management') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins and management can award achievements'
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

  -- Check if user already has this achievement
  SELECT EXISTS (
    SELECT 1 FROM achievement_unlocks
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  ) INTO v_already_unlocked;

  IF v_already_unlocked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already has this achievement'
    );
  END IF;

  -- Create unlock record
  INSERT INTO achievement_unlocks (user_id, achievement_id, unlocked_at, seen)
  VALUES (p_user_id, p_achievement_id, now(), false)
  RETURNING id INTO v_unlock_id;

  RETURN jsonb_build_object(
    'success', true,
    'unlock_id', v_unlock_id,
    'message', 'Achievement awarded successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (function checks role internally)
GRANT EXECUTE ON FUNCTION manually_award_achievement TO authenticated;
