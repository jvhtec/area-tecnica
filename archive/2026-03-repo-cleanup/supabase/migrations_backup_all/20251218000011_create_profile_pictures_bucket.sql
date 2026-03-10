-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true, -- Public bucket for easy access without signed URLs
  2097152, -- 2MB limit for profile pictures
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for profile-pictures bucket

-- Allow authenticated users to upload their own profile picture
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own profile picture
CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile picture
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow everyone to read profile pictures (public bucket)
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Admin/Management can manage all profile pictures
CREATE POLICY "Admin and Management can manage all profile pictures"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);
