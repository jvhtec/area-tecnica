-- Morning Summary User Preferences
-- Allows granular control: each user can subscribe to specific departments

-- ============================================================================
-- 1. Create user preferences table
-- ============================================================================

CREATE TABLE IF NOT EXISTS morning_summary_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscribed_departments TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_subscription UNIQUE (user_id),
  CONSTRAINT valid_departments CHECK (
    subscribed_departments <@ ARRAY['sound', 'lights', 'video', 'logistics', 'production', 'administrative']
  )
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_morning_subscriptions_user_id ON morning_summary_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_morning_subscriptions_enabled ON morning_summary_subscriptions(enabled) WHERE enabled = true;

COMMENT ON TABLE morning_summary_subscriptions IS 'User preferences for daily morning summary notifications - which departments each user wants to receive';
COMMENT ON COLUMN morning_summary_subscriptions.subscribed_departments IS 'Array of departments this user wants to receive summaries for';
COMMENT ON COLUMN morning_summary_subscriptions.enabled IS 'Whether this user wants to receive morning summaries at all';

-- ============================================================================
-- 2. Setup RLS policies
-- ============================================================================

ALTER TABLE morning_summary_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON morning_summary_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY "Users can create their own subscriptions"
ON morning_summary_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management', 'house_tech')
  )
);

-- Users can update their own subscriptions
CREATE POLICY "Users can update their own subscriptions"
ON morning_summary_subscriptions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management', 'house_tech')
  )
);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete their own subscriptions"
ON morning_summary_subscriptions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON morning_summary_subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- 3. Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_morning_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS set_morning_subscription_updated_at ON morning_summary_subscriptions;

CREATE TRIGGER set_morning_subscription_updated_at
  BEFORE UPDATE ON morning_summary_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_morning_subscription_updated_at();

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON morning_summary_subscriptions TO authenticated;

-- ============================================================================
-- 5. Migration note
-- ============================================================================

COMMENT ON TABLE morning_summary_subscriptions IS
  'Granular user preferences for morning summaries. Users (management/house_tech) can subscribe to specific departments. Replaces push_notification_routes for morning summary recipients.';

-- ============================================================================
-- Migration complete
-- ============================================================================
