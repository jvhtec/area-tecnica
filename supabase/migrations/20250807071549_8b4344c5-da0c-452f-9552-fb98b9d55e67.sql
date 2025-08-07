-- COMPREHENSIVE SECURITY FIXES MIGRATION (Fixed)

-- 1. Add missing RLS policies for tables with RLS enabled but no policies
CREATE POLICY "Management can manage technician departments" 
ON public.technician_departments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage flex crew assignments" 
ON public.flex_crew_assignments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage flex crew calls" 
ON public.flex_crew_calls 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Admin only access to secrets" 
ON public.secrets 
FOR ALL 
USING (get_current_user_role() = 'admin'::text);

-- 2. Fix overly permissive policies by replacing them with role-based restrictions

-- Drop overly permissive profile policies and replace with restricted ones
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Management can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Restrict job viewing to assigned technicians + management
DROP POLICY IF EXISTS "All users can view jobs" ON public.jobs;

CREATE POLICY "Users can view jobs they are assigned to" 
ON public.jobs 
FOR SELECT 
USING (
  id IN (
    SELECT job_id FROM job_assignments WHERE technician_id = auth.uid()
  ) OR 
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

-- Restrict job documents to assigned technicians + management
DROP POLICY IF EXISTS "All users can view job documents" ON public.job_documents;

CREATE POLICY "Users can view documents for their assigned jobs" 
ON public.job_documents 
FOR SELECT 
USING (
  job_id IN (
    SELECT job_id FROM job_assignments WHERE technician_id = auth.uid()
  ) OR 
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

-- Restrict technician availability to authenticated users only
DROP POLICY IF EXISTS "Users can view all technician availability" ON public.technician_availability;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.technician_availability;

CREATE POLICY "Authenticated users can view technician availability" 
ON public.technician_availability 
FOR SELECT 
TO authenticated
USING (true);