-- Add push_notifications_enabled column to profiles
-- This column tracks whether a user has enabled push notifications

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.push_notifications_enabled IS 'Whether the user has enabled push notifications';
