-- Critical Security Fixes

-- 1. Fix profiles table - prevent role escalation
-- Remove existing policies that allow unrestricted updates
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create restricted policies
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Users can only update non-sensitive fields
CREATE POLICY "Users can update own profile (non-sensitive)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Prevent role changes unless user is admin
  (OLD.role = NEW.role OR get_current_user_role() = 'admin')
);

-- Only admins can change roles
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

-- 2. Secure tours and tour_dates tables
-- Drop existing public policies
DROP POLICY IF EXISTS "Anyone can view tours" ON public.tours;
DROP POLICY IF EXISTS "Anyone can view tour dates" ON public.tour_dates;

-- Restrict to authenticated users only
CREATE POLICY "Authenticated users can view tours" 
ON public.tours 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view tour dates" 
ON public.tour_dates 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Management can still manage tours
CREATE POLICY "Management can manage tours" 
ON public.tours 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage tour dates" 
ON public.tour_dates 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- 3. Secure storage buckets - make them private and add proper RLS
UPDATE storage.buckets SET public = false WHERE public = true;

-- Add comprehensive storage policies
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

-- Similar policies for other buckets
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

-- Festival and tour related buckets
CREATE POLICY "Authenticated users can view festival content" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id IN ('festival-logos', 'festival_artist_files')
);

CREATE POLICY "Management can manage festival content" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id IN ('festival-logos', 'festival_artist_files') AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

CREATE POLICY "Authenticated users can view tour content" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id IN ('tour-logos', 'tour-documents')
);

CREATE POLICY "Management can manage tour content" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id IN ('tour-logos', 'tour-documents') AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);

-- Memoria tecnica buckets
CREATE POLICY "Authenticated users can view memoria tecnica" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id IN ('Memoria Tecnica', 'lights-memoria-tecnica', 'video-memoria-tecnica')
);

CREATE POLICY "Users can upload memoria tecnica" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id IN ('Memoria Tecnica', 'lights-memoria-tecnica', 'video-memoria-tecnica') AND
  auth.role() = 'authenticated'
);

-- Artist Files bucket
CREATE POLICY "Management can manage artist files" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'Artist Files' AND
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

CREATE POLICY "Authenticated users can view artist files" 
ON storage.objects 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND 
  bucket_id = 'Artist Files'
);