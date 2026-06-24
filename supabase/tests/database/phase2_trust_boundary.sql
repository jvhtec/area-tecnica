CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(38);

-- ---------------------------------------------------------------------------
-- Phase 2: anonymous callers cannot execute data-bearing RPCs that were still
-- reachable after Phase 0. For every revoked function we also assert that
-- authenticated and service_role retain EXECUTE, so a future REVOKE that is too
-- broad (e.g. accidentally removing an inherited grant) fails closed instead of
-- silently breaking signed-in and server callers.
-- ---------------------------------------------------------------------------

-- approve_job_expense -------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.approve_job_expense(uuid, boolean, text)', 'EXECUTE'),
  'anon cannot execute approve_job_expense'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.approve_job_expense(uuid, boolean, text)', 'EXECUTE'),
  'authenticated retains approve_job_expense'
);
SELECT ok(
  has_function_privilege('service_role', 'public.approve_job_expense(uuid, boolean, text)', 'EXECUTE'),
  'service_role retains approve_job_expense'
);

-- can_submit_job_expense ----------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.can_submit_job_expense(uuid, uuid, text, date, numeric, text, numeric)', 'EXECUTE'),
  'anon cannot execute can_submit_job_expense'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.can_submit_job_expense(uuid, uuid, text, date, numeric, text, numeric)', 'EXECUTE'),
  'authenticated retains can_submit_job_expense'
);
SELECT ok(
  has_function_privilege('service_role', 'public.can_submit_job_expense(uuid, uuid, text, date, numeric, text, numeric)', 'EXECUTE'),
  'service_role retains can_submit_job_expense'
);

-- replace_job_expense_receipt -----------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.replace_job_expense_receipt(uuid, text, boolean)', 'EXECUTE'),
  'anon cannot execute replace_job_expense_receipt'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.replace_job_expense_receipt(uuid, text, boolean)', 'EXECUTE'),
  'authenticated retains replace_job_expense_receipt'
);
SELECT ok(
  has_function_privilege('service_role', 'public.replace_job_expense_receipt(uuid, text, boolean)', 'EXECUTE'),
  'service_role retains replace_job_expense_receipt'
);

-- get_timesheet_with_visible_amounts ----------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_timesheet_with_visible_amounts(uuid)', 'EXECUTE'),
  'anon cannot execute get_timesheet_with_visible_amounts'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_timesheet_with_visible_amounts(uuid)', 'EXECUTE'),
  'authenticated retains get_timesheet_with_visible_amounts'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_timesheet_with_visible_amounts(uuid)', 'EXECUTE'),
  'service_role retains get_timesheet_with_visible_amounts'
);

-- get_timesheets_batch ------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_timesheets_batch(uuid[], uuid)', 'EXECUTE'),
  'anon cannot execute get_timesheets_batch'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_timesheets_batch(uuid[], uuid)', 'EXECUTE'),
  'authenticated retains get_timesheets_batch'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_timesheets_batch(uuid[], uuid)', 'EXECUTE'),
  'service_role retains get_timesheets_batch'
);

-- get_billable_hours_for_job ------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_billable_hours_for_job(uuid, numeric)', 'EXECUTE'),
  'anon cannot execute get_billable_hours_for_job'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_billable_hours_for_job(uuid, numeric)', 'EXECUTE'),
  'authenticated retains get_billable_hours_for_job'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_billable_hours_for_job(uuid, numeric)', 'EXECUTE'),
  'service_role retains get_billable_hours_for_job'
);

-- resolve_category_for_timesheet --------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.resolve_category_for_timesheet(uuid, uuid)', 'EXECUTE'),
  'anon cannot execute resolve_category_for_timesheet'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.resolve_category_for_timesheet(uuid, uuid)', 'EXECUTE'),
  'authenticated retains resolve_category_for_timesheet'
);
SELECT ok(
  has_function_privilege('service_role', 'public.resolve_category_for_timesheet(uuid, uuid)', 'EXECUTE'),
  'service_role retains resolve_category_for_timesheet'
);

-- get_assignment_matrix_staffing --------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_assignment_matrix_staffing()', 'EXECUTE'),
  'anon cannot execute get_assignment_matrix_staffing'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_assignment_matrix_staffing()', 'EXECUTE'),
  'authenticated retains get_assignment_matrix_staffing'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_assignment_matrix_staffing()', 'EXECUTE'),
  'service_role retains get_assignment_matrix_staffing'
);

-- get_profiles_with_skills --------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_profiles_with_skills()', 'EXECUTE'),
  'anon cannot execute get_profiles_with_skills'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_profiles_with_skills()', 'EXECUTE'),
  'authenticated retains get_profiles_with_skills'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_profiles_with_skills()', 'EXECUTE'),
  'service_role retains get_profiles_with_skills'
);

-- get_rate_for_evento_job ---------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_rate_for_evento_job(text, uuid)', 'EXECUTE'),
  'anon cannot execute get_rate_for_evento_job'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_rate_for_evento_job(text, uuid)', 'EXECUTE'),
  'authenticated retains get_rate_for_evento_job'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_rate_for_evento_job(text, uuid)', 'EXECUTE'),
  'service_role retains get_rate_for_evento_job'
);

-- acquire_assignment_lock ---------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.acquire_assignment_lock(uuid, date)', 'EXECUTE'),
  'anon cannot execute acquire_assignment_lock'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.acquire_assignment_lock(uuid, date)', 'EXECUTE'),
  'authenticated retains acquire_assignment_lock'
);
SELECT ok(
  has_function_privilege('service_role', 'public.acquire_assignment_lock(uuid, date)', 'EXECUTE'),
  'service_role retains acquire_assignment_lock'
);

-- ---------------------------------------------------------------------------
-- Regression: Phase 0 closures remain in place.
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_job_total_amounts(uuid)', 'EXECUTE'),
  'anon still cannot execute get_job_total_amounts(uuid)'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.technician_availability', 'SELECT'),
  'anon still cannot select technician_availability'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.vacation_requests', 'SELECT'),
  'anon still cannot select vacation_requests'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.log_activity_as(uuid,text,uuid,text,text,jsonb,public.activity_visibility)',
    'EXECUTE'
  ),
  'authenticated still cannot execute log_activity_as'
);

-- ---------------------------------------------------------------------------
-- The profile privilege boundary trigger remains installed.
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'enforce_profile_privilege_changes'
      AND NOT tgisinternal
  ),
  'profiles privilege-change trigger is installed'
);

SELECT * FROM finish();
