-- Create storage bucket for feedback system
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-system',
  'feedback-system',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback-system bucket
-- Allow anyone to upload screenshots (for anonymous bug reports)
CREATE POLICY "Anyone can upload bug screenshots"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'feedback-system' AND (storage.foldername(name))[1] = 'bug-reports');

-- Allow admins to view all files
CREATE POLICY "Admins can view all feedback files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-system' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);

-- Allow admins to delete files
CREATE POLICY "Admins can delete feedback files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-system' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);

-- Allow public read access to all files (for displaying in GitHub issues and emails)
CREATE POLICY "Public can view feedback files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-system');
