-- Broaden storage policies to cover both spaced and hyphenated bucket IDs

DO $$ BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can view memoria tecnica') THEN
    DROP POLICY "Authenticated users can view memoria tecnica" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload memoria tecnica') THEN
    DROP POLICY "Users can upload memoria tecnica" ON storage.objects;
  END IF;
END $$;

-- View policy
CREATE POLICY "Authenticated users can view memoria tecnica"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  bucket_id IN ('Memoria Tecnica', 'memoria-tecnica', 'lights-memoria-tecnica', 'video-memoria-tecnica')
);

-- Insert policy
CREATE POLICY "Users can upload memoria tecnica"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id IN ('Memoria Tecnica', 'memoria-tecnica', 'lights-memoria-tecnica', 'video-memoria-tecnica')
);

