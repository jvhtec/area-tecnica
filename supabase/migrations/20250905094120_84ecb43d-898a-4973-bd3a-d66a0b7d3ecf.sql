-- Fix storage policies for memoria tecnica buckets to allow authenticated access

-- Allow authenticated users to view their own memoria tecnica files
CREATE POLICY "Allow authenticated users to view memoria tecnica files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'Memoria Tecnica');

-- Allow authenticated users to upload memoria tecnica files
CREATE POLICY "Allow authenticated users to upload memoria tecnica files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Memoria Tecnica' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their own memoria tecnica files
CREATE POLICY "Allow authenticated users to update memoria tecnica files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'Memoria Tecnica' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their own memoria tecnica files
CREATE POLICY "Allow authenticated users to delete memoria tecnica files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'Memoria Tecnica' AND auth.uid() IS NOT NULL);

-- Fix policies for lights-memoria-tecnica bucket
CREATE POLICY "Allow authenticated users to view lights memoria tecnica files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lights-memoria-tecnica');

CREATE POLICY "Allow authenticated users to upload lights memoria tecnica files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lights-memoria-tecnica' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update lights memoria tecnica files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lights-memoria-tecnica' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete lights memoria tecnica files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lights-memoria-tecnica' AND auth.uid() IS NOT NULL);

-- Fix policies for video-memoria-tecnica bucket
CREATE POLICY "Allow authenticated users to view video memoria tecnica files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'video-memoria-tecnica');

CREATE POLICY "Allow authenticated users to upload video memoria tecnica files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'video-memoria-tecnica' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update video memoria tecnica files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'video-memoria-tecnica' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete video memoria tecnica files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'video-memoria-tecnica' AND auth.uid() IS NOT NULL);