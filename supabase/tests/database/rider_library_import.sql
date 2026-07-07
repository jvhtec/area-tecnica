CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(23);

SELECT has_column('public', 'festival_artists', 'rider_outdated', 'festival artists track explicit outdated rider state');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_artists'
      AND column_name = 'rider_outdated'
      AND is_nullable = 'NO'
      AND column_default = 'false'
  ),
  'rider_outdated is not nullable and defaults to false'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'import_artist_rider_to_job'
      AND pg_get_function_identity_arguments(p.oid) = 'p_source_artist_id uuid, p_target_job_id uuid, p_target_date date, p_target_stage integer'
  ),
  'rider library import RPC exists with the expected signature'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'import_artist_rider_to_job'
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') ILIKE '%search_path=pg_catalog, public%'
  ),
  'rider library import RPC is security definer with a pinned search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.import_artist_rider_to_job(uuid, uuid, date, integer)', 'EXECUTE'),
  'anon cannot execute the rider library import RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.import_artist_rider_to_job(uuid, uuid, date, integer)', 'EXECUTE'),
  'authenticated callers can execute the rider library import RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'delete_festival_artist_file_reference'
      AND pg_get_function_identity_arguments(p.oid) = 'p_file_id uuid, p_artist_id uuid'
  ),
  'rider file reference delete RPC exists with the expected signature'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'delete_festival_artist_file_reference'
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') ILIKE '%search_path=pg_catalog, public%'
  ),
  'rider file reference delete RPC is security definer with a pinned search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.delete_festival_artist_file_reference(uuid, uuid)', 'EXECUTE'),
  'anon cannot execute the rider file reference delete RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.delete_festival_artist_file_reference(uuid, uuid)', 'EXECUTE'),
  'authenticated callers can execute the rider file reference delete RPC'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', false);

DELETE FROM public.festival_artist_files
WHERE artist_id IN (
    '13000000-0000-0000-0000-000000000001'::uuid,
    '13000000-0000-0000-0000-000000000002'::uuid,
    '13000000-0000-0000-0000-000000000003'::uuid
  )
  OR file_path IN ('shared/source-rider.pdf', 'shared/second-rider.pdf')
  OR artist_id IN (
    SELECT id
    FROM public.festival_artists
    WHERE job_id = '12000000-0000-0000-0000-000000000002'::uuid
  );

DELETE FROM public.festival_artists
WHERE id IN (
    '13000000-0000-0000-0000-000000000001'::uuid,
    '13000000-0000-0000-0000-000000000002'::uuid,
    '13000000-0000-0000-0000-000000000003'::uuid
  )
  OR job_id IN (
    '12000000-0000-0000-0000-000000000001'::uuid,
    '12000000-0000-0000-0000-000000000002'::uuid
  );

DELETE FROM public.jobs
WHERE id IN (
  '12000000-0000-0000-0000-000000000001'::uuid,
  '12000000-0000-0000-0000-000000000002'::uuid
);

DELETE FROM public.profiles
WHERE id IN (
  '11000000-0000-0000-0000-000000000001'::uuid,
  '11000000-0000-0000-0000-000000000002'::uuid,
  '11000000-0000-0000-0000-000000000003'::uuid
);

DELETE FROM auth.users
WHERE id IN (
  '11000000-0000-0000-0000-000000000001'::uuid,
  '11000000-0000-0000-0000-000000000002'::uuid,
  '11000000-0000-0000-0000-000000000003'::uuid
);

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
) VALUES
  (
    '11000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'rider-library-admin@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '11000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'rider-library-logistics@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '11000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'rider-library-house@test.local',
    'test',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('11000000-0000-0000-0000-000000000001'::uuid, 'rider-library-admin@test.local', 'Rider', 'Admin', 'admin', 'sound'),
  ('11000000-0000-0000-0000-000000000002'::uuid, 'rider-library-logistics@test.local', 'Rider', 'Logistics', 'logistics', 'logistics'),
  ('11000000-0000-0000-0000-000000000003'::uuid, 'rider-library-house@test.local', 'Rider', 'House', 'house_tech', 'sound')
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO UPDATE
SET label = excluded.label,
    default_visibility = excluded.default_visibility,
    severity = excluded.severity,
    toast_enabled = excluded.toast_enabled;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES
  (
    '12000000-0000-0000-0000-000000000001'::uuid,
    'Rider Library Source',
    '2026-07-01 08:00:00+02'::timestamptz,
    '2026-07-02 02:00:00+02'::timestamptz,
    'festival'
  ),
  (
    '12000000-0000-0000-0000-000000000002'::uuid,
    'Rider Library Target',
    '2026-08-01 08:00:00+02'::timestamptz,
    '2026-08-02 02:00:00+02'::timestamptz,
    'festival'
  )
ON CONFLICT (id) DO UPDATE
SET title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    job_type = excluded.job_type;

INSERT INTO public.festival_artists (
  id,
  job_id,
  name,
  date,
  stage,
  show_start,
  show_end,
  soundcheck,
  soundcheck_start,
  soundcheck_end,
  line_check,
  line_check_start,
  line_check_end,
  load_in_time,
  foh_console,
  mon_console,
  notes,
  form_language,
  rider_missing,
  stage_plot_file_path,
  stage_plot_file_name,
  stage_plot_file_type,
  stage_plot_uploaded_at
) VALUES
  (
    '13000000-0000-0000-0000-000000000001'::uuid,
    '12000000-0000-0000-0000-000000000001'::uuid,
    'Source Rider Artist',
    '2026-07-01',
    2,
    '22:00',
    '23:00',
    true,
    '18:00',
    '18:30',
    true,
    '17:30',
    '17:45',
    '16:00',
    'SD7',
    'PM5',
    'source technical notes',
    'en',
    false,
    '13000000-0000-0000-0000-000000000001/plot.pdf',
    'plot.pdf',
    'application/pdf',
    '2026-07-01 10:00:00+02'::timestamptz
  ),
  (
    '13000000-0000-0000-0000-000000000002'::uuid,
    '12000000-0000-0000-0000-000000000001'::uuid,
    'Second Source Rider Artist',
    '2026-07-01',
    1,
    '20:00',
    '21:00',
    false,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL,
    'CL5',
    'CL3',
    'second notes',
    'es',
    false,
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    '13000000-0000-0000-0000-000000000003'::uuid,
    '12000000-0000-0000-0000-000000000001'::uuid,
    'Source Without Rider',
    '2026-07-01',
    1,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'es',
    true,
    NULL,
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    job_id = excluded.job_id,
    date = excluded.date,
    stage = excluded.stage,
    rider_missing = excluded.rider_missing;

INSERT INTO public.festival_artist_files (
  id,
  artist_id,
  file_name,
  file_path,
  file_type,
  file_size,
  uploaded_by,
  uploaded_at
) VALUES
  (
    '14000000-0000-0000-0000-000000000001'::uuid,
    '13000000-0000-0000-0000-000000000001'::uuid,
    'source-rider.pdf',
    'shared/source-rider.pdf',
    'application/pdf',
    12345,
    '11000000-0000-0000-0000-000000000001'::uuid,
    '2026-07-01 12:00:00+02'::timestamptz
  ),
  (
    '14000000-0000-0000-0000-000000000002'::uuid,
    '13000000-0000-0000-0000-000000000002'::uuid,
    'second-rider.pdf',
    'shared/second-rider.pdf',
    'application/pdf',
    23456,
    '11000000-0000-0000-0000-000000000001'::uuid,
    '2026-07-01 13:00:00+02'::timestamptz
  )
ON CONFLICT (id) DO UPDATE
SET artist_id = excluded.artist_id,
    file_name = excluded.file_name,
    file_path = excluded.file_path,
    file_type = excluded.file_type,
    file_size = excluded.file_size,
    uploaded_by = excluded.uploaded_by,
    uploaded_at = excluded.uploaded_at;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', false);

SELECT throws_ok(
  $$SELECT * FROM public.import_artist_rider_to_job(
    '13000000-0000-0000-0000-000000000001'::uuid,
    '12000000-0000-0000-0000-000000000002'::uuid,
    '2026-08-01'::date,
    2
  )$$,
  '42501',
  'not_authorized',
  'house tech cannot import riders from the library'
);

SELECT throws_ok(
  $$SELECT * FROM public.delete_festival_artist_file_reference(
    '14000000-0000-0000-0000-000000000001'::uuid
  )$$,
  '42501',
  'not_authorized',
  'house tech cannot delete rider file references'
);

SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', false);

SELECT is(
  (
    SELECT imported_file_count
    FROM public.import_artist_rider_to_job(
      '13000000-0000-0000-0000-000000000001'::uuid,
      '12000000-0000-0000-0000-000000000002'::uuid,
      '2026-08-01'::date,
      2
    )
  ),
  1,
  'admin import returns the preserved rider file count'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.festival_artists
    WHERE job_id = '12000000-0000-0000-0000-000000000002'::uuid
      AND name = 'Source Rider Artist'
      AND date = '2026-08-01'
      AND stage = 2
      AND rider_missing = false
      AND rider_outdated = true
      AND rider_outdated_dismissed = false
      AND rider_copied_from_date = '2026-07-01'
      AND show_start IS NULL
      AND soundcheck_start IS NULL
      AND line_check_start IS NULL
      AND load_in_time IS NULL
      AND stage_plot_file_path IS NULL
      AND notes = 'source technical notes'
      AND form_language = 'en'
      AND foh_console = 'SD7'
      AND mon_console = 'PM5'
  ),
  'imported artist maps technical fields, target scheduling, and outdated rider state'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.festival_artist_files imported_file
    JOIN public.festival_artists imported_artist ON imported_artist.id = imported_file.artist_id
    WHERE imported_artist.job_id = '12000000-0000-0000-0000-000000000002'::uuid
      AND imported_artist.name = 'Source Rider Artist'
      AND imported_file.file_name = 'source-rider.pdf'
      AND imported_file.file_path = 'shared/source-rider.pdf'
      AND imported_file.file_type = 'application/pdf'
      AND imported_file.file_size = 12345
      AND imported_file.uploaded_at = '2026-07-01 12:00:00+02'::timestamptz
  ),
  'imported rider metadata preserves the original storage reference and upload metadata'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', false);

SELECT throws_ok(
  $$SELECT * FROM public.import_artist_rider_to_job(
    '13000000-0000-0000-0000-000000000001'::uuid,
    '12000000-0000-0000-0000-000000000002'::uuid,
    '2026-08-01'::date,
    2
  )$$,
  '23505',
  'duplicate_rider_import',
  'duplicate import is blocked when the target job already references a source file path'
);

SELECT is(
  (
    SELECT should_delete_storage
    FROM public.delete_festival_artist_file_reference(
      (
        SELECT imported_file.id
        FROM public.festival_artist_files imported_file
        JOIN public.festival_artists imported_artist ON imported_artist.id = imported_file.artist_id
        WHERE imported_artist.job_id = '12000000-0000-0000-0000-000000000002'::uuid
          AND imported_artist.name = 'Source Rider Artist'
          AND imported_file.file_path = 'shared/source-rider.pdf'
        LIMIT 1
      ),
      (
        SELECT imported_artist.id
        FROM public.festival_artist_files imported_file
        JOIN public.festival_artists imported_artist ON imported_artist.id = imported_file.artist_id
        WHERE imported_artist.job_id = '12000000-0000-0000-0000-000000000002'::uuid
          AND imported_artist.name = 'Source Rider Artist'
          AND imported_file.file_path = 'shared/source-rider.pdf'
        LIMIT 1
      )
    )
  ),
  false,
  'deleting an imported rider metadata row preserves shared storage while the source still references it'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.festival_artist_files
    WHERE id = '14000000-0000-0000-0000-000000000001'::uuid
      AND file_path = 'shared/source-rider.pdf'
  ),
  'deleting a shared rider reference leaves the source rider metadata row intact'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.festival_artist_files imported_file
    JOIN public.festival_artists imported_artist ON imported_artist.id = imported_file.artist_id
    WHERE imported_artist.job_id = '12000000-0000-0000-0000-000000000002'::uuid
      AND imported_artist.name = 'Source Rider Artist'
      AND imported_file.file_path = 'shared/source-rider.pdf'
  ),
  0,
  'deleting a shared rider reference removes the target metadata row'
);

SELECT throws_ok(
  $$SELECT * FROM public.import_artist_rider_to_job(
    '13000000-0000-0000-0000-000000000003'::uuid,
    '12000000-0000-0000-0000-000000000002'::uuid,
    '2026-08-01'::date,
    1
  )$$,
  'P0002',
  'source_artist_has_no_riders',
  'source artists without rider files cannot be imported'
);

SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', false);

SELECT is(
  (
    SELECT imported_file_count
    FROM public.import_artist_rider_to_job(
      '13000000-0000-0000-0000-000000000002'::uuid,
      '12000000-0000-0000-0000-000000000002'::uuid,
      '2026-08-01'::date,
      1
    )
  ),
  1,
  'logistics can import riders from the library'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.festival_artists
    WHERE job_id = '12000000-0000-0000-0000-000000000002'::uuid
      AND rider_outdated = true
      AND rider_missing = false
  ),
  2,
  'successful imports leave imported artists marked outdated but not missing'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_files'
      AND indexname = 'idx_festival_artist_files_file_path'
  ),
  'rider file path index supports duplicate import checks'
);

SELECT * FROM finish();
