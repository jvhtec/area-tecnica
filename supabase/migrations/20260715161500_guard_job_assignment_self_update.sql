-- =============================================================================
-- Payroll integrity: column-scope technician self-updates on job_assignments
-- =============================================================================
-- The `job_assignments_update` RLS policy
-- (20260217233500_advisor_security_hardening_phase2_rls.sql) allows an update
-- when `technician_id = auth.uid()` so a technician can accept/decline their own
-- assignment. That policy is not column-scoped, and — unlike `profiles`, which
-- is guarded by `enforce_profile_privilege_changes` — `job_assignments` had no
-- BEFORE UPDATE guard. A technician could therefore rewrite pay-relevant columns
-- on their own row (`sound_role`/`lights_role`/`video_role`/`production_role`,
-- which drive the timesheet rate category, and `use_tour_multipliers`, which per
-- its own column comment "forces tour multiplier calculation") and inflate their
-- own payout.
--
-- The sanctioned accept/decline path is `manage_assignment_lifecycle`, which — as
-- a SECURITY DEFINER function running under the caller's JWT (auth.role() stays
-- 'authenticated') — writes only `status` and `response_time` on the self path.
-- This trigger allows exactly those two columns to change for a non-privileged
-- row owner and rejects every other column change. Privileged app roles
-- (admin/management/logistics) and the service role are unaffected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_job_assignment_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  -- Backend/service contexts (edge functions, scheduled jobs) bypass.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Privileged app roles may change any column; their RLS policy already gates
  -- which rows they can reach.
  v_actor_role := public.current_user_role();
  IF v_actor_role = ANY (ARRAY['admin', 'management', 'logistics']) THEN
    RETURN NEW;
  END IF;

  -- Non-privileged actor. The RLS policy only lets them reach their own row
  -- (technician_id = auth.uid()), so restrict WHICH columns they may change:
  -- only the accept/decline fields. Role, rate-mode, source, scheduling and
  -- invoice columns feed payroll and must not be self-editable. Fail closed:
  -- every column except status/response_time must stay unchanged.
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.sound_role IS DISTINCT FROM OLD.sound_role
     OR NEW.lights_role IS DISTINCT FROM OLD.lights_role
     OR NEW.video_role IS DISTINCT FROM OLD.video_role
     OR NEW.production_role IS DISTINCT FROM OLD.production_role
     OR NEW.assignment_source IS DISTINCT FROM OLD.assignment_source
     OR NEW.single_day IS DISTINCT FROM OLD.single_day
     OR NEW.assignment_date IS DISTINCT FROM OLD.assignment_date
     OR NEW.use_tour_multipliers IS DISTINCT FROM OLD.use_tour_multipliers
     OR NEW.external_technician_name IS DISTINCT FROM OLD.external_technician_name
     OR NEW.invoice_received_at IS DISTINCT FROM OLD.invoice_received_at
     OR NEW.invoice_received_by IS DISTINCT FROM OLD.invoice_received_by
  THEN
    RAISE EXCEPTION 'Technicians may only accept or decline their own assignment; role, rate and administrative fields cannot be self-edited'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_job_assignment_self_update() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enforce_job_assignment_self_update()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_job_assignment_self_update()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_job_assignment_self_update ON public.job_assignments;
CREATE TRIGGER enforce_job_assignment_self_update
BEFORE UPDATE ON public.job_assignments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_job_assignment_self_update();

-- ---------------------------------------------------------------------------
-- Remove the duplicate timesheet-cascade trigger on job_assignments DELETE.
-- Both `trigger_delete_timesheets` (AFTER DELETE) and
-- `trigger_delete_timesheets_on_assignment_removal` (BEFORE DELETE) ran the same
-- `delete_timesheets_on_assignment_removal()` cascade, so every assignment
-- deletion executed the timesheet DELETE twice and logged the cleanup twice.
-- Keep the BEFORE DELETE variant so a failed cascade aborts the assignment
-- delete, and drop the AFTER DELETE duplicate.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_delete_timesheets ON public.job_assignments;
