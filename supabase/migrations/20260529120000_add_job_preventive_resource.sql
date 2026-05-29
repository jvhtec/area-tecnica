-- Add a nullable per-job "recurso preventivo" designation.
-- The payout impact is additive through extras_total_for_job_tech so existing payout views keep working.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS preventive_resource_technician_id uuid,
  ADD COLUMN IF NOT EXISTS preventive_resource_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS preventive_resource_assigned_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_preventive_resource_technician_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_preventive_resource_technician_id_fkey
      FOREIGN KEY (preventive_resource_technician_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_preventive_resource_assigned_by_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_preventive_resource_assigned_by_fkey
      FOREIGN KEY (preventive_resource_assigned_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_preventive_resource_not_dryhire'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_preventive_resource_not_dryhire
      CHECK (
        preventive_resource_technician_id IS NULL
        OR job_type <> 'dryhire'::public.job_type
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_preventive_resource_technician_id
  ON public.jobs(preventive_resource_technician_id)
  WHERE preventive_resource_technician_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.preventive_resource_technician_id IS
  'Confirmed assigned technician designated as recurso preventivo for this job. Nullable and not allowed for dry hires.';
COMMENT ON COLUMN public.jobs.preventive_resource_assigned_at IS
  'Timestamp when the recurso preventivo designation was last set.';
COMMENT ON COLUMN public.jobs.preventive_resource_assigned_by IS
  'Profile ID of the user who last set the recurso preventivo designation.';

CREATE OR REPLACE FUNCTION public.clear_job_preventive_resource_when_assignment_inactive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.jobs
    SET
      preventive_resource_technician_id = NULL,
      preventive_resource_assigned_at = NULL,
      preventive_resource_assigned_by = NULL
    WHERE id = OLD.job_id
      AND preventive_resource_technician_id = OLD.technician_id;

    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM 'confirmed'::public.assignment_status
    OR NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
  THEN
    UPDATE public.jobs
    SET
      preventive_resource_technician_id = NULL,
      preventive_resource_assigned_at = NULL,
      preventive_resource_assigned_by = NULL
    WHERE id = OLD.job_id
      AND preventive_resource_technician_id = OLD.technician_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clear_job_preventive_resource_assignment_inactive ON public.job_assignments;
CREATE TRIGGER trg_clear_job_preventive_resource_assignment_inactive
  AFTER DELETE OR UPDATE OF status, job_id, technician_id
  ON public.job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_job_preventive_resource_when_assignment_inactive();

CREATE OR REPLACE FUNCTION public.extras_total_for_job_tech(_job_id uuid, _technician_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_qualifies_for_fixed_travel_rate boolean := false;
  v_fixed_travel_rate numeric := 20.00;
  v_custom_travel_half numeric := NULL;
  v_custom_travel_full numeric := NULL;
  v_preventive_resource_extra numeric := 10.00;
BEGIN
  -- Check if technician qualifies for fixed travel rate:
  -- 1. House techs (role = 'house_tech')
  -- 2. Management users assignable as techs (role IN ('admin', 'management') AND assignable_as_tech = true)
  SELECT (
    role = 'house_tech' OR
    (role IN ('admin', 'management') AND COALESCE(assignable_as_tech, false) = true)
  ) INTO v_qualifies_for_fixed_travel_rate
  FROM public.profiles
  WHERE id = _technician_id;

  -- Fetch per-technician custom travel rates (highest priority)
  SELECT travel_half_day_eur, travel_full_day_eur
  INTO v_custom_travel_half, v_custom_travel_full
  FROM public.custom_tech_rates
  WHERE profile_id = _technician_id;

  -- Calculate extras from job_rate_extras joined with rate_extras_2025 for unit prices.
  -- Resolve the travel rate once per row so the priority logic stays centralized.
  WITH resolved_extras AS (
    SELECT
      jre.extra_type::text AS extra_type,
      jre.quantity,
      jre.amount_override_eur,
      jre.updated_at,
      CASE
        WHEN jre.extra_type = 'travel_half' AND v_custom_travel_half IS NOT NULL
        THEN v_custom_travel_half
        WHEN jre.extra_type = 'travel_full' AND v_custom_travel_full IS NOT NULL
        THEN v_custom_travel_full
        WHEN v_qualifies_for_fixed_travel_rate AND jre.extra_type IN ('travel_half', 'travel_full')
        THEN v_fixed_travel_rate
        ELSE re.amount_eur
      END AS unit_eur,
      jre.amount_override_eur IS NULL
        AND v_qualifies_for_fixed_travel_rate
        AND jre.extra_type IN ('travel_half', 'travel_full')
        AND ((jre.extra_type = 'travel_half' AND v_custom_travel_half IS NULL)
          OR (jre.extra_type = 'travel_full' AND v_custom_travel_full IS NULL)) AS is_house_tech_rate,
      jre.amount_override_eur IS NULL
        AND ((jre.extra_type = 'travel_half' AND v_custom_travel_half IS NOT NULL)
          OR (jre.extra_type = 'travel_full' AND v_custom_travel_full IS NOT NULL)) AS is_custom_travel_rate,
      false AS is_preventive_resource,
      10 AS sort_order
    FROM job_rate_extras jre
    LEFT JOIN rate_extras_2025 re ON re.extra_type = jre.extra_type
    WHERE jre.job_id = _job_id
      AND jre.technician_id = _technician_id
      AND jre.status = 'approved'
  ),
  preventive_extra AS (
    SELECT
      'recurso_preventivo'::text AS extra_type,
      1 AS quantity,
      NULL::numeric AS amount_override_eur,
      jobs.preventive_resource_assigned_at AS updated_at,
      v_preventive_resource_extra AS unit_eur,
      false AS is_house_tech_rate,
      false AS is_custom_travel_rate,
      true AS is_preventive_resource,
      20 AS sort_order
    FROM public.jobs
    WHERE jobs.id = _job_id
      AND jobs.preventive_resource_technician_id = _technician_id
      AND jobs.job_type <> 'dryhire'::public.job_type
  ),
  all_extras AS (
    SELECT * FROM resolved_extras
    UNION ALL
    SELECT * FROM preventive_extra
  )
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(
      COALESCE(
        all_extras.amount_override_eur,
        all_extras.quantity * all_extras.unit_eur
      )
    ), 0),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'extra_type', all_extras.extra_type,
        'quantity', all_extras.quantity,
        'unit_eur', all_extras.unit_eur,
        'amount_eur', COALESCE(
          all_extras.amount_override_eur,
          all_extras.quantity * all_extras.unit_eur
        ),
        'is_house_tech_rate', all_extras.is_house_tech_rate,
        'is_custom_travel_rate', all_extras.is_custom_travel_rate,
        'is_preventive_resource', all_extras.is_preventive_resource
      )
      ORDER BY all_extras.sort_order, all_extras.updated_at NULLS LAST
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM all_extras;

  RETURN COALESCE(v_result, '{"total_eur": 0, "items": []}'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) IS
  'Calculates total rate extras for a specific job and technician. Priority: per-technician custom travel rates > house tech/assignable management fixed €20 rate > catalog rates. Adds the fixed recurso preventivo extra when designated.';
