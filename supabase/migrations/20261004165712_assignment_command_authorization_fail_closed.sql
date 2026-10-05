-- Fail closed at the assignment command boundary without changing the shared
-- role helper or unrelated RPCs. Preserve each function's signature, owner,
-- grants and implementation; only replace its previously nullable guard.
DO $migration$
DECLARE
  v_name text;
  v_function oid;
  v_definition text;
  v_guard text;
  v_service text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'get_assignment_command_state', 'get_job_assignment_command_states',
    'apply_direct_assignment', 'remove_direct_assignment',
    'remove_assignment_date', 'change_assignment_role', 'set_assignment_status',
    'claim_assignment_side_effects', 'record_assignment_side_effects',
    'get_assignment_side_effect_backlog', 'get_assignment_command_metrics',
    'get_assignment_consistency_issues', 'remove_assignment_with_timesheets',
    'toggle_timesheet_day'
  ] LOOP
    IF (SELECT count(*) FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = v_name) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one assignment boundary function: %', v_name;
    END IF;
    SELECT p.oid INTO v_function FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name;
    v_definition := pg_catalog.pg_get_functiondef(v_function);
    v_service := CASE WHEN v_definition LIKE '%IF NOT (v_is_service OR public.is_admin_or_management()) THEN%'
      THEN 'v_is_service' ELSE 'auth.role() = ''service_role''' END;
    v_guard := 'IF NOT (' || v_service || ' OR public.is_admin_or_management()) THEN';
    IF pg_catalog.strpos(v_definition, v_guard) = 0
      OR pg_catalog.strpos(pg_catalog.substr(v_definition,
           pg_catalog.strpos(v_definition, v_guard) + pg_catalog.length(v_guard)), v_guard) > 0 THEN
      RAISE EXCEPTION 'Expected exactly one nullable assignment authorization guard: %', v_name;
    END IF;
    EXECUTE pg_catalog.replace(v_definition, v_guard,
      'IF ((' || v_service || ') OR (auth.role() = ''authenticated'' AND auth.uid() IS NOT NULL'
      || ' AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN');
  END LOOP;
END;
$migration$;
