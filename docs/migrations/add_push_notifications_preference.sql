-- Add push notification preference tracking to profiles table
-- This allows detecting when a user previously had push enabled but lost their subscription
-- (e.g., after clearing browser data, reinstalling PWA, or switching devices)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_push_enabled
ON profiles(push_notifications_enabled)
WHERE push_notifications_enabled = true;

-- Add comment for documentation
COMMENT ON COLUMN profiles.push_notifications_enabled IS
'Tracks whether the user has enabled push notifications. Used to detect when subscriptions are lost and prompt re-enablement.';
