-- ============================================================================
-- Achievement Push Notification Integration
-- Creates notification records when achievements are unlocked
-- Integrates with existing push notification system
-- ============================================================================

-- Trigger function to create notification record when achievement is unlocked
CREATE OR REPLACE FUNCTION notify_achievement_unlocked()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement achievements%ROWTYPE;
BEGIN
  -- Get achievement details
  SELECT * INTO v_achievement
  FROM achievements
  WHERE id = NEW.achievement_id;

  -- Create notification record for existing push notification system
  -- The existing system will handle sending push notifications to all user devices
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    link,
    created_at,
    read
  )
  VALUES (
    NEW.user_id,
    '¡Logro desbloqueado!',
    format('%s %s: %s', v_achievement.icon, v_achievement.title, v_achievement.description),
    'achievement',
    '/achievements',  -- Deep link to achievements page
    now(),
    false
  );

  -- Note: Existing push notification system will handle delivery
  -- No need for custom Edge Function - leverages existing infrastructure

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on achievement_unlocks INSERT
CREATE TRIGGER on_achievement_unlocked
  AFTER INSERT ON achievement_unlocks
  FOR EACH ROW
  EXECUTE FUNCTION notify_achievement_unlocked();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_achievement_unlocked() TO authenticated;
