CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(8);

SELECT has_column(
  'public',
  'flex_folders',
  'source_department',
  'Flex folder tracking stores the Estructura source department'
);

SELECT has_column(
  'public',
  'tours',
  'flex_estructura_folder_id',
  'Tours store their Estructura parent folder ID'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flex_folders_source_department_check'
      AND conrelid = 'public.flex_folders'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%department = ''estructura''%'
      AND pg_get_constraintdef(oid) ILIKE '%folder_type = ''pull_sheet''%'
  ),
  'source_department is restricted to Estructura Pull Sheets'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'flex_folders'
      AND indexname = 'ux_flex_folders_estructura_pull_sheet_source_per_job'
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%(job_id, source_department)%'
      AND indexdef ILIKE '%department = ''estructura''%'
      AND indexdef ILIKE '%folder_type = ''pull_sheet''%'
  ),
  'a job can track at most one Estructura Pull Sheet per source department'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'flex_folders'
      AND indexname = 'ux_flex_folders_estructura_pull_sheet_source_per_tour_date'
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%(tour_date_id, source_department)%'
      AND indexdef ILIKE '%department = ''estructura''%'
      AND indexdef ILIKE '%folder_type = ''pull_sheet''%'
  ),
  'a tour date can track at most one pre-job Estructura Pull Sheet per source department'
);

SELECT throws_ok(
  $$
    INSERT INTO public.flex_folders (
      element_id,
      department,
      folder_type,
      source_department
    ) VALUES (
      '10000000-0000-4000-8000-000000000001',
      'sound',
      'pull_sheet',
      'sound'
    )
  $$,
  '23514',
  NULL,
  'ordinary Sound Pull Sheets cannot claim an Estructura source discriminator'
);

SELECT throws_ok(
  $$
    INSERT INTO public.flex_folders (
      element_id,
      department,
      folder_type,
      source_department
    ) VALUES (
      '10000000-0000-4000-8000-000000000002',
      'estructura',
      'pull_sheet',
      'video'
    )
  $$,
  '23514',
  NULL,
  'Estructura Pull Sheets reject unsupported source departments'
);

SELECT lives_ok(
  $$
    INSERT INTO public.flex_folders (
      element_id,
      department,
      folder_type,
      source_department
    ) VALUES (
      '10000000-0000-4000-8000-000000000003',
      'estructura',
      'pull_sheet',
      'sound'
    )
  $$,
  'Estructura Sound is a valid tracked Pull Sheet'
);

DELETE FROM public.flex_folders
WHERE element_id = '10000000-0000-4000-8000-000000000003';

SELECT * FROM finish();
