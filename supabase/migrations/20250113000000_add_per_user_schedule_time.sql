-- Add per-user schedule time to morning summary subscriptions
-- Allows each user to choose their preferred notification time from preset slots

-- ============================================================================
-- 1. Add schedule_time column with default
-- ============================================================================

ALTER TABLE morning_summary_subscriptions
  ADD COLUMN IF NOT EXISTS schedule_time TIME NOT NULL DEFAULT '08:00:00';

-- Add constraint to only allow the 4 preset time slots
ALTER TABLE morning_summary_subscriptions
  ADD CONSTRAINT valid_user_schedule_time CHECK (
    schedule_time IN ('06:00:00'::time, '07:00:00'::time, '08:00:00'::time, '09:00:00'::time)
  );

-- Add comment for documentation
COMMENT ON COLUMN morning_summary_subscriptions.schedule_time IS 'User preferred notification time. Allowed values: 06:00, 07:00, 08:00, 09:00 (Europe/Madrid timezone)';

-- ============================================================================
-- 2. Add last_sent_at column for per-user duplicate prevention
-- ============================================================================

ALTER TABLE morning_summary_subscriptions
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN morning_summary_subscriptions.last_sent_at IS 'Timestamp of last notification sent to this user, used to prevent duplicate sends';

-- ============================================================================
-- 3. Create index for efficient time-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_morning_subscriptions_schedule_time
  ON morning_summary_subscriptions(schedule_time)
  WHERE enabled = true;

-- ============================================================================
-- Migration complete
-- ============================================================================
