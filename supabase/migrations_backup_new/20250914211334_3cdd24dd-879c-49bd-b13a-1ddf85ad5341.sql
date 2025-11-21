-- Upload static HTML templates to the public logos bucket
-- First, we need to ensure we can insert into storage.objects programmatically
-- This will be done via the Supabase client in the edge function, so no SQL needed here

-- Just ensure the bucket exists and is public (it already is)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'public logos';