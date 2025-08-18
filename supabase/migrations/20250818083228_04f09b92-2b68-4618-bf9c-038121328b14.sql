-- Secure storage buckets - make them private
UPDATE storage.buckets SET public = false WHERE public = true;

-- Add comprehensive storage policies for job documents
CREATE POLICY "Authenticated users can view job documents" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id = 'job-documents'
);

CREATE POLICY "Management can upload job documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'job-documents' AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

CREATE POLICY "Management can delete job documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'job-documents' AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);