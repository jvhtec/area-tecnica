-- Extend house tech travel rate exception (€20) to management users assignable as techs
-- This applies to technicians with:
--   - role = 'house_tech' OR
--   - role IN ('admin', 'management') AND assignable_as_tech = true

DO $$ BEGIN
  RAISE NOTICE 'Extending travel rate exception (€20) to assignable management users';
END $$;

-- Update the extras_total_for_job_tech function to apply travel rate exception to assignable management users
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

  -- Calculate extras from job_rate_extras joined with rate_extras_2025 for unit prices
  -- For qualifying users, travel_half and travel_full use fixed €20 rate
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(
      COALESCE(
        jre.amount_override_eur,
        jre.quantity * (
          CASE
            WHEN v_qualifies_for_fixed_travel_rate AND jre.extra_type IN ('travel_half', 'travel_full')
            THEN v_fixed_travel_rate
            ELSE re.amount_eur
          END
        )
      )
    ), 0),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'extra_type', jre.extra_type,
        'quantity', jre.quantity,
        'unit_eur', CASE
          WHEN v_qualifies_for_fixed_travel_rate AND jre.extra_type IN ('travel_half', 'travel_full')
          THEN v_fixed_travel_rate
          ELSE re.amount_eur
        END,
        'amount_eur', COALESCE(
          jre.amount_override_eur,
          jre.quantity * (
            CASE
              WHEN v_qualifies_for_fixed_travel_rate AND jre.extra_type IN ('travel_half', 'travel_full')
              THEN v_fixed_travel_rate
              ELSE re.amount_eur
            END
          )
        ),
        'is_house_tech_rate', v_qualifies_for_fixed_travel_rate AND jre.extra_type IN ('travel_half', 'travel_full')
      )
      ORDER BY jre.updated_at
    ) FILTER (WHERE jre.status = 'approved'), '[]'::jsonb)
  )
  INTO v_result
  FROM job_rate_extras jre
  LEFT JOIN rate_extras_2025 re ON re.extra_type = jre.extra_type
  WHERE jre.job_id = _job_id
    AND jre.technician_id = _technician_id
    AND jre.status = 'approved';

  RETURN COALESCE(v_result, '{"total_eur": 0, "items": []}'::jsonb);
END;
$function$;

-- Revoke/grant permissions to match existing function
REVOKE EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.extras_total_for_job_tech(uuid, uuid) IS
  'Calculates total rate extras for a specific job and technician. House techs and assignable management users receive a fixed €20 rate for travel days (both half and full) regardless of catalog rates.';
