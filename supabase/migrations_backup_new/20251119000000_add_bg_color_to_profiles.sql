-- Add bg_color column to profiles table for custom row background colors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bg_color TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN profiles.bg_color IS 'Custom background color for the technician row in hex format (e.g., #FF5733)';
