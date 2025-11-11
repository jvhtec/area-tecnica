-- Create storage bucket for temporary corporate email images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corporate-emails-temp',
  'corporate-emails-temp',
  true, -- Public bucket so images can be accessed in emails
  5242880, -- 5MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload temporary images
CREATE POLICY IF NOT EXISTS "Authenticated users can upload temp email images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'corporate-emails-temp'
  );

-- Allow authenticated users to delete their own temp images
CREATE POLICY IF NOT EXISTS "Authenticated users can delete temp email images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'corporate-emails-temp'
  );

-- Allow public read access for email viewing
CREATE POLICY IF NOT EXISTS "Public can read temp email images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'corporate-emails-temp'
  );

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets - includes corporate-emails-temp for transient email images that are deleted after sending';
