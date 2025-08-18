-- Add storage policies for remaining buckets
CREATE POLICY "Authenticated users can view task documents" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id IN ('task_documents', 'task-documents')
);

CREATE POLICY "Users can upload task documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id IN ('task_documents', 'task-documents') AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view company assets" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id = 'company-assets'
);

CREATE POLICY "Management can manage company assets" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'company-assets' AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);