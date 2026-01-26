-- House tech travel rate exception: €20 for both half and full travel days
-- This applies to all technicians with role = 'house_tech' in the profiles table

-- Define the constant for house tech travel rate
-- Both travel_half and travel_full get the same €20 rate for house techs
DO $$ BEGIN
  RAISE NOTICE 'Applying house tech travel rate exception (€20 for travel days)';
END $$;

-- Update the extras_total_for_job_tech function to apply the house tech travel rate exception
CREATE OR REPLACE FUNCTION public.extras_total_for_job_tech(_job_id uuid, _technician_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_is_house_tech boolean := false;
  v_house_tech_travel_rate numeric := 20.00;
BEGIN
  -- Check if technician is a house tech
  SELECT (role = 'house_tech') INTO v_is_house_tech
  FROM public.profiles
  WHERE id = _technician_id;

  -- Calculate extras from job_rate_extras joined with rate_extras_2025 for unit prices
  -- For house techs, travel_half and travel_full use fixed €20 rate
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(
      COALESCE(
        jre.amount_override_eur,
        jre.quantity * (
          CASE
            WHEN v_is_house_tech AND jre.extra_type IN ('travel_half', 'travel_full')
            THEN v_house_tech_travel_rate
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
          WHEN v_is_house_tech AND jre.extra_type IN ('travel_half', 'travel_full')
          THEN v_house_tech_travel_rate
          ELSE re.amount_eur
        END,
        'amount_eur', COALESCE(
          jre.amount_override_eur,
          jre.quantity * (
            CASE
              WHEN v_is_house_tech AND jre.extra_type IN ('travel_half', 'travel_full')
              THEN v_house_tech_travel_rate
              ELSE re.amount_eur
            END
          )
        ),
        'is_house_tech_rate', v_is_house_tech AND jre.extra_type IN ('travel_half', 'travel_full')
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
  'Calculates total rate extras for a specific job and technician. House techs receive a fixed €20 rate for travel days (both half and full) regardless of catalog rates.';
