-- Fix overly permissive RLS policies on profiles table
-- flex_api_key should not be readable by all authenticated users
-- Use existing helper functions to avoid recursion

-- Drop the overly permissive policies
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

-- Create new restrictive policies
-- Use is_admin_or_management() SECURITY DEFINER function to avoid recursion

-- SELECT: Users can read their own profile, admins/management can read all
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin_or_management()
  );

-- UPDATE: Users can update their own profile, admins can update all
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.current_user_role() = 'admin'
  )
  WITH CHECK (
    auth.uid() = id
    OR public.current_user_role() = 'admin'
  );

-- Note: flex_api_key is now only accessible to:
-- 1. The user themselves (their own row)
-- 2. Admins and management users (via is_admin_or_management helper)
-- This prevents any authenticated user from reading all flex_api_keys
