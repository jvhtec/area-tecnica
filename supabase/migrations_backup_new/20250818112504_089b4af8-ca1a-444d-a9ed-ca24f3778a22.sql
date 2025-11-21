-- Fix broken access: replace recursive policies with security-definer based checks
-- Cleanup old policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Management can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Management can insert profiles" ON public.profiles;

-- Safe, non-recursive policies using security definer function
-- View: users can see their own profile
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- View: management and admin can see all profiles
CREATE POLICY "profiles_select_management"
ON public.profiles
FOR SELECT
USING (public.get_current_user_role() IN ('admin','management'));

-- Update: users can update their own rows
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Update: management/admin can update any row
CREATE POLICY "profiles_update_management"
ON public.profiles
FOR UPDATE
USING (public.get_current_user_role() IN ('admin','management'))
WITH CHECK (public.get_current_user_role() IN ('admin','management'));

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;