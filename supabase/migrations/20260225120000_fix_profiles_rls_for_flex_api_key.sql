-- Fix overly permissive RLS policies on profiles table
-- flex_api_key should not be readable by all authenticated users
-- Use auth.jwt() to avoid recursion (no SELECT on profiles inside policy)

-- Drop the overly permissive policies
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

-- Create new restrictive policies
-- Use auth.jwt() claims to check role without querying profiles table (avoids recursion)

-- SELECT: Users can read their own profile, admins/management can read all
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR auth.jwt()->>'role' IN ('admin', 'management')
  );

-- UPDATE: Users can update their own profile, admins can update all
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR auth.jwt()->>'role' = 'admin'
  )
  WITH CHECK (
    auth.uid() = id
    OR auth.jwt()->>'role' = 'admin'
  );

-- Note: flex_api_key is now only accessible to:
-- 1. The user themselves (their own row)
-- 2. Admins and management users (via JWT claims)
-- This prevents any authenticated user from reading all flex_api_keys
