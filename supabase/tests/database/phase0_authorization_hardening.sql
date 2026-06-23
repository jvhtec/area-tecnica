CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(22);

SELECT ok(
  to_regprocedure('public.can_manage_technician(text)') IS NOT NULL,
  'can_manage_technician(text) helper exists'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.can_manage_technician(text)')
  ), false),
  'can_manage_technician(text) pins pg_catalog/public search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.can_manage_technician(text)', 'EXECUTE'),
  'anonymous users cannot execute can_manage_technician(text)'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.can_manage_technician(text)', 'EXECUTE'),
  'authenticated users can execute can_manage_technician(text)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'technician_availability'
      AND policyname LIKE 'p_technician_availability_public_%'
  ),
  'legacy public technician_availability policies are absent'
);

SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'technician_availability'
      AND policyname IN (
        'technician_availability_select_scoped',
        'technician_availability_insert_scoped',
        'technician_availability_update_scoped',
        'technician_availability_delete_scoped'
      )
  ) = 4,
  'technician_availability has the four scoped authenticated policies'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.technician_availability', 'SELECT'),
  'anonymous users cannot select technician_availability'
);

SELECT ok(
  to_regprocedure('public.enforce_vacation_request_update()') IS NOT NULL,
  'enforce_vacation_request_update() trigger helper exists'
);

SELECT ok(
  COALESCE((
    SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
    FROM pg_proc
    WHERE oid = to_regprocedure('public.enforce_vacation_request_update()')
  ), false),
  'enforce_vacation_request_update() pins pg_catalog/public search_path'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vacation_requests'
      AND policyname LIKE 'p_vacation_requests_public_%'
  ),
  'legacy public vacation_requests policies are absent'
);

SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vacation_requests'
      AND policyname IN (
        'vacation_requests_select_scoped',
        'vacation_requests_insert_scoped',
        'vacation_requests_update_scoped',
        'vacation_requests_delete_scoped'
      )
  ) = 4,
  'vacation_requests has the four scoped authenticated policies'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.vacation_requests', 'SELECT'),
  'anonymous users cannot select vacation_requests'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.consume_external_api_quota(uuid,text,integer)', 'EXECUTE'),
  'authenticated users cannot directly consume external API quota'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_job_total_amounts(uuid)', 'EXECUTE'),
  'anonymous users cannot execute get_job_total_amounts(uuid)'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_job_total_amounts(uuid)', 'EXECUTE'),
  'authenticated users can execute get_job_total_amounts(uuid)'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.log_activity_as(uuid,text,uuid,text,text,jsonb,public.activity_visibility)',
    'EXECUTE'
  ),
  'authenticated users cannot execute log_activity_as(...)'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.log_activity_as(uuid,text,uuid,text,text,jsonb,public.activity_visibility)',
    'EXECUTE'
  ),
  'service_role can execute log_activity_as(...)'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.clear_tour_preset_assignments(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot execute clear_tour_preset_assignments(uuid,uuid)'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.sync_preset_assignments_for_tour(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot execute sync_preset_assignments_for_tour(uuid,uuid)'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_tour_complete_timeline(uuid)', 'EXECUTE'),
  'authenticated users cannot execute get_tour_complete_timeline(uuid)'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_tour_date_complete_info(uuid)', 'EXECUTE'),
  'authenticated users cannot execute get_tour_date_complete_info(uuid)'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_user_job_ids(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_user_job_ids(uuid)', 'EXECUTE'),
  'get_user_job_ids(uuid) is available to authenticated users only'
);

SELECT * FROM finish();
