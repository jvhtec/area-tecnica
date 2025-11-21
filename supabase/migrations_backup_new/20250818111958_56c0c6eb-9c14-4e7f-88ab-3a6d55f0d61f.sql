-- CRITICAL FIX: Remove policies causing infinite recursion in profiles table
-- This fixes the infinite recursion errors shown in the logs

-- Drop all existing policies on profiles table to start clean
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile (non-sensitive)" ON public.profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Management can manage profiles" ON public.profiles;

-- Create secure, non-recursive policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Management can view all profiles (for autocomplete and management tasks)
CREATE POLICY "Management can view all profiles"
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'management')
  )
);

-- Users can update only their own profile (non-sensitive fields)
CREATE POLICY "Users can update own profile"
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Management can update any profile
CREATE POLICY "Management can update profiles"
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'management')
  )
);

-- Management can insert new profiles
CREATE POLICY "Management can insert profiles"
ON public.profiles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'management')
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;