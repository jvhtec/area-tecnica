-- CRITICAL SECURITY FIX: Remove overly permissive profile access
-- This fixes the vulnerability where all users could see all employee personal data

-- Drop the dangerous policy that allows viewing all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Also clean up duplicate/conflicting policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- Create secure, restrictive policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Management can view all profiles (when needed for business operations)
-- This policy already exists but ensuring it's the only way to see all profiles
-- (The existing "Management can view all profiles" policy is correct)

-- Ensure users can only update their own profile with restrictions
-- (The existing "Users can update own profile (non-sensitive)" policy is good)

-- Verify RLS is enabled (should already be)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;