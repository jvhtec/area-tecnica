-- Add profile_picture_url column to profiles table
ALTER TABLE profiles
ADD COLUMN profile_picture_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.profile_picture_url IS 'URL to the user profile picture stored in the profile-pictures bucket';

-- Create index for faster lookups when filtering by users with profile pictures
CREATE INDEX idx_profiles_picture_url ON profiles(profile_picture_url) WHERE profile_picture_url IS NOT NULL;
