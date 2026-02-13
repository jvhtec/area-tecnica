-- ============================================================================
-- Achievement Push Notification System
-- Sends push notifications when achievements are unlocked with deep links
-- ============================================================================

-- Trigger function to create notification record when achievement is unlocked
CREATE OR REPLACE FUNCTION notify_achievement_unlocked()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement achievements%ROWTYPE;
  v_user_profile profiles%ROWTYPE;
BEGIN
  -- Get achievement details
  SELECT * INTO v_achievement
  FROM achievements
  WHERE id = NEW.achievement_id;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification record for push notification system
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

  -- Note: Push notification will be sent by Edge Function via trigger on notifications table

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
