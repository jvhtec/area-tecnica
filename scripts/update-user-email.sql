-- Update user email in both auth and profiles tables
-- User ID: 8a1fc157-a08c-42b5-9592-6e49a120ce6a
-- Old email: victormr10603@gmail.com
-- New email: martinriveravictor@gmail.com

BEGIN;

-- Update email in auth.users table
UPDATE auth.users
SET
  email = 'martinriveravictor@gmail.com',
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    '"martinriveravictor@gmail.com"'
  ),
  updated_at = now()
WHERE id = '8a1fc157-a08c-42b5-9592-6e49a120ce6a';

-- Update email in profiles table
UPDATE public.profiles
SET email = 'martinriveravictor@gmail.com'
WHERE id = '8a1fc157-a08c-42b5-9592-6e49a120ce6a';

-- Verify the updates
SELECT
  'auth.users' as table_name,
  id,
  email,
  updated_at
FROM auth.users
WHERE id = '8a1fc157-a08c-42b5-9592-6e49a120ce6a'

UNION ALL

SELECT
  'public.profiles' as table_name,
  id,
  email,
  created_at as updated_at
FROM public.profiles
WHERE id = '8a1fc157-a08c-42b5-9592-6e49a120ce6a';

COMMIT;
