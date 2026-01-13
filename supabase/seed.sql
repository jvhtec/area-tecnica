-- Seed data for local development
-- This file is automatically run after migrations when running `supabase db reset`

-- Create a test admin user
-- Email: admin@test.com
-- Password: admin123

-- First, insert into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@test.com',
  -- Password: admin123 (bcrypt hash)
  '$2a$10$rN5qKZPQZKYp0SbC8vLO1.7QBPqWqKxwBZWHXRqFj5xLzMHPV1Rwy',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
);

-- Insert identity for the user
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001',
  'email',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'admin@test.com'),
  now(),
  now(),
  now()
);

-- Update the auto-created profile with admin details
UPDATE public.profiles
SET
  first_name = 'Admin',
  last_name = 'Test',
  role = 'admin'::user_role,
  department = 'sound',
  assignable_as_tech = true
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Create a test technician user
-- Email: tech@test.com
-- Password: tech123

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'tech@test.com',
  -- Password: tech123 (bcrypt hash)
  '$2a$10$w0V8qNB0LhBX0KQNqGvnZ.xZK5UqRfF8E.JVxXTGHfwGLGNJMM9Ma',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002',
  'email',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000002', 'email', 'tech@test.com'),
  now(),
  now(),
  now()
);

-- Update the auto-created profile with tech details
UPDATE public.profiles
SET
  first_name = 'Tech',
  last_name = 'User',
  role = 'technician'::user_role,
  department = 'sound',
  assignable_as_tech = true
WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;

-- Sample data creation is commented out due to triggers
-- You can add jobs/tours manually through the UI after logging in
-- or uncomment and fix the activity catalog issues

-- -- Create sample jobs for testing
-- INSERT INTO public.jobs (
--   id,
--   title,
--   job_type,
--   start_time,
--   end_time,
--   status,
--   created_at
-- ) VALUES
-- (
--   '10000000-0000-0000-0000-000000000001'::uuid,
--   'Festival de Verano - Día 1',
--   'festival',
--   (current_date + interval '7 days' + time '18:00')::timestamptz,
--   (current_date + interval '7 days' + time '23:00')::timestamptz,
--   'Confirmado',
--   now()
-- );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Seed data created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Test accounts created:';
  RAISE NOTICE '   Admin: admin@test.com / admin123';
  RAISE NOTICE '   Tech:  tech@test.com / tech123';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Note: Sample jobs/tours are commented out.';
  RAISE NOTICE '   You can create them manually through the UI.';
  RAISE NOTICE '';
END $$;
