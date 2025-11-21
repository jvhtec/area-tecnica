-- Add policy to allow authenticated users to upload job documents
CREATE POLICY "Authenticated users can upload job documents" 
ON public.job_documents 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND uploaded_by = auth.uid()
);