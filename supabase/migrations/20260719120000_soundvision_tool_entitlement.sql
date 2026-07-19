-- Permanent access to the standalone NM/SV amplifier-map and flysheet tool.
-- A sound technician earns the entitlement the first time they are assigned a
-- responsable (-R) sound role. Removing or downgrading that assignment does
-- not revoke access; admin/management may still change it explicitly.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS soundvision_tool_access_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_soundvision_tool_access_sound_department_check
  CHECK (
    soundvision_tool_access_enabled = false
    OR lower(btrim(COALESCE(department, ''))) = 'sound'
  );

COMMENT ON COLUMN public.profiles.soundvision_tool_access_enabled IS
  'Permanent entitlement for the NM/SV amplifier-map designer and Soundvision flysheet generator. Granted automatically after a responsable sound assignment or manually by admin/management.';

CREATE OR REPLACE FUNCTION public.grant_soundvision_tool_access_from_responsable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_department text;
  v_role text;
  v_technician_id uuid := NEW.technician_id;
BEGIN
  IF v_technician_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'job_assignments' THEN
    v_department := 'sound';
    v_role := v_new ->> 'sound_role';

    IF TG_OP = 'UPDATE'
       AND v_role IS NOT DISTINCT FROM (v_old ->> 'sound_role')
       AND (v_new ->> 'technician_id') IS NOT DISTINCT FROM (v_old ->> 'technician_id') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'tour_assignments' THEN
    v_department := v_new ->> 'department';
    v_role := v_new ->> 'role';

    IF TG_OP = 'UPDATE'
       AND v_department IS NOT DISTINCT FROM (v_old ->> 'department')
       AND v_role IS NOT DISTINCT FROM (v_old ->> 'role')
       AND (v_new ->> 'technician_id') IS NOT DISTINCT FROM (v_old ->> 'technician_id') THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF lower(btrim(COALESCE(v_department, ''))) = 'sound'
     AND upper(btrim(COALESCE(v_role, ''))) ~ '^[A-Z]{3}-[A-Z0-9_]+-R$' THEN
    UPDATE public.profiles
    SET soundvision_tool_access_enabled = true
    WHERE id = v_technician_id
      AND lower(btrim(COALESCE(department, ''))) = 'sound'
      AND soundvision_tool_access_enabled IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.grant_soundvision_tool_access_from_responsable() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.grant_soundvision_tool_access_from_responsable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_soundvision_tool_access_from_responsable()
  TO service_role;

DROP TRIGGER IF EXISTS grant_soundvision_tool_access_from_job_responsable ON public.job_assignments;
CREATE TRIGGER grant_soundvision_tool_access_from_job_responsable
AFTER INSERT OR UPDATE ON public.job_assignments
FOR EACH ROW
EXECUTE FUNCTION public.grant_soundvision_tool_access_from_responsable();

DROP TRIGGER IF EXISTS grant_soundvision_tool_access_from_tour_responsable ON public.tour_assignments;
CREATE TRIGGER grant_soundvision_tool_access_from_tour_responsable
AFTER INSERT OR UPDATE ON public.tour_assignments
FOR EACH ROW
EXECUTE FUNCTION public.grant_soundvision_tool_access_from_responsable();

-- Honor already-recorded responsable assignments at rollout. This is the only
-- broad backfill; a later manual revocation remains in force until a future
-- responsable assignment event grants access again.
--
-- Production already has the profile privilege guard from
-- 20260623160000_phase0_authorization_hardening.sql. The migration connection
-- has no PostgREST JWT claims, so that guard rejects a root-level UPDATE even
-- though the migration owns the table. Disable only that exact guard for this
-- trusted backfill and immediately restore it. PostgreSQL rolls both ALTERs
-- back with the migration if any statement fails.
ALTER TABLE public.profiles
  DISABLE TRIGGER enforce_profile_privilege_changes;

UPDATE public.profiles p
SET soundvision_tool_access_enabled = true
WHERE p.soundvision_tool_access_enabled IS DISTINCT FROM true
  AND lower(btrim(COALESCE(p.department, ''))) = 'sound'
  AND (
    EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      WHERE ja.technician_id = p.id
        AND upper(btrim(COALESCE(ja.sound_role, ''))) ~ '^[A-Z]{3}-[A-Z0-9_]+-R$'
    )
    OR EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.technician_id = p.id
        AND lower(btrim(ta.department)) = 'sound'
        AND upper(btrim(ta.role)) ~ '^[A-Z]{3}-[A-Z0-9_]+-R$'
    )
  );

ALTER TABLE public.profiles
  ENABLE TRIGGER enforce_profile_privilege_changes;

-- profiles has intentionally broad authenticated UPDATE RLS plus a trigger
-- privilege boundary. Guard this new entitlement explicitly so a technician
-- cannot self-enable it. Nested writes (depth > 1) are only produced by the
-- trusted assignment trigger above and are allowed to make the automatic grant.
CREATE OR REPLACE FUNCTION public.enforce_soundvision_tool_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_department text;
BEGIN
  IF lower(btrim(COALESCE(NEW.department, ''))) <> 'sound'
     AND NEW.soundvision_tool_access_enabled = true THEN
    IF lower(btrim(COALESCE(OLD.department, ''))) = 'sound'
       AND OLD.department IS DISTINCT FROM NEW.department
       AND OLD.soundvision_tool_access_enabled = true THEN
      -- A department move immediately removes eligibility, even when the
      -- caller did not include the entitlement column in the update payload.
      NEW.soundvision_tool_access_enabled := false;
    ELSE
      RAISE EXCEPTION 'Only sound department users are eligible for Soundvision tool access'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.soundvision_tool_access_enabled IS NOT DISTINCT FROM NEW.soundvision_tool_access_enabled THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role::text, p.department
  INTO v_actor_role, v_actor_department
  FROM public.profiles p
  WHERE p.id = v_actor;

  IF v_actor = OLD.id THEN
    RAISE EXCEPTION 'Soundvision tool access cannot be changed on your own account'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only administrators and management may change Soundvision tool access'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'management'
     AND OLD.department IS DISTINCT FROM v_actor_department THEN
    RAISE EXCEPTION 'Management may only change profiles in their department'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource,
    severity,
    metadata
  ) VALUES (
    v_actor,
    'profile_privilege_change',
    'profile:' || OLD.id::text,
    'high',
    jsonb_build_object(
      'changed_fields', jsonb_build_array('soundvision_tool_access_enabled'),
      'actor_role', v_actor_role,
      'old_value', OLD.soundvision_tool_access_enabled,
      'new_value', NEW.soundvision_tool_access_enabled
    )
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_soundvision_tool_access_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_soundvision_tool_access_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_soundvision_tool_access_change()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_soundvision_tool_access_change ON public.profiles;
CREATE TRIGGER enforce_soundvision_tool_access_change
BEFORE UPDATE OF soundvision_tool_access_enabled, department ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_soundvision_tool_access_change();
