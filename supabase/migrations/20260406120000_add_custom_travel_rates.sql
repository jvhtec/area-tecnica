-- Add per-technician custom travel rates to custom_tech_rates
-- These override both the house tech fixed €20 rate and the catalog default

ALTER TABLE public.custom_tech_rates
  ADD COLUMN IF NOT EXISTS travel_half_day_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS travel_full_day_eur numeric(10,2);

COMMENT ON COLUMN public.custom_tech_rates.travel_half_day_eur IS
  'Custom half travel day rate. If set, overrides house tech fixed rate and catalog default.';
COMMENT ON COLUMN public.custom_tech_rates.travel_full_day_eur IS
  'Custom full travel day rate. If set, overrides house tech fixed rate and catalog default.';

-- Update extras_total_for_job_tech to use custom travel rates with priority:
-- 1. custom_tech_rates.travel_*_day_eur (per-technician custom rate)
-- 2. Fixed €20 for house techs / assignable management
-- 3. Catalog rate from rate_extras_2025

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
      jre.extra_type,
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
      END AS unit_eur
    FROM job_rate_extras jre
    LEFT JOIN rate_extras_2025 re ON re.extra_type = jre.extra_type
    WHERE jre.job_id = _job_id
      AND jre.technician_id = _technician_id
      AND jre.status = 'approved'
  )
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(
      COALESCE(
        resolved_extras.amount_override_eur,
        resolved_extras.quantity * resolved_extras.unit_eur
      )
    ), 0),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'extra_type', resolved_extras.extra_type,
        'quantity', resolved_extras.quantity,
        'unit_eur', resolved_extras.unit_eur,
        'amount_eur', COALESCE(
          resolved_extras.amount_override_eur,
          resolved_extras.quantity * resolved_extras.unit_eur
        ),
        'is_house_tech_rate', resolved_extras.amount_override_eur IS NULL
          AND v_qualifies_for_fixed_travel_rate
          AND resolved_extras.extra_type IN ('travel_half', 'travel_full')
          AND ((resolved_extras.extra_type = 'travel_half' AND v_custom_travel_half IS NULL)
            OR (resolved_extras.extra_type = 'travel_full' AND v_custom_travel_full IS NULL)),
        'is_custom_travel_rate', resolved_extras.amount_override_eur IS NULL
          AND ((resolved_extras.extra_type = 'travel_half' AND v_custom_travel_half IS NOT NULL)
          OR (resolved_extras.extra_type = 'travel_full' AND v_custom_travel_full IS NOT NULL))
      )
      ORDER BY resolved_extras.updated_at
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM resolved_extras;

  RETURN COALESCE(v_result, '{"total_eur": 0, "items": []}'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) IS
  'Calculates total rate extras for a specific job and technician. Priority: per-technician custom travel rates > house tech/assignable management fixed €20 rate > catalog rates.';
