-- Check and fix storage policies for job-documents bucket
-- First, let's see the current policies
SELECT * FROM storage.objects WHERE bucket_id = 'job-documents' LIMIT 1;

-- Create permissive storage policies for job-documents bucket
-- Policy for uploading files
CREATE POLICY "Users can upload job documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'job-documents' 
  AND auth.uid() IS NOT NULL
);

-- Policy for viewing files
CREATE POLICY "Users can view job documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'job-documents' 
  AND auth.uid() IS NOT NULL
);

-- Policy for updating files
CREATE POLICY "Users can update job documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'job-documents' 
  AND auth.uid() IS NOT NULL
);

-- Policy for deleting files
CREATE POLICY "Users can delete job documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'job-documents' 
  AND auth.uid() IS NOT NULL
);