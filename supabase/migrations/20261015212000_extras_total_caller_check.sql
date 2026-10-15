-- extras_total_for_job_tech() is SECURITY DEFINER, so it reads job_rate_extras
-- and custom_tech_rates past RLS, and it had no caller check: anon and every
-- signed-in user could call it with any job and technician id and read that
-- technician's extras and custom travel rates. The security-invoker payout
-- views (v_job_tech_payout_2025[_base]) call it once per visible
-- job/technician pair, so the same figures also reached anyone who could see
-- another technician's assignment.
--
-- Apply the rule get_timesheet_amounts_visible() uses for money: admins and
-- management, the technician themself, and server-side callers (service_role,
-- or a database session with no request JWT, such as cron). Anyone else gets
-- NULL, which the payout view already turns into an empty breakdown, so
-- queries over the view keep working; they just stop exposing other people's
-- extras. The body below the guard is unchanged.

create or replace function public.extras_total_for_job_tech(_job_id uuid, _technician_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  v_result jsonb;
  v_qualifies_for_fixed_travel_rate boolean := false;
  v_fixed_travel_rate numeric := 20.00;
  v_custom_travel_half numeric := NULL;
  v_custom_travel_full numeric := NULL;
  v_preventive_resource_extra numeric := 10.00;
  v_role text := auth.role();
BEGIN
  IF v_role = 'anon' THEN
    RETURN NULL;
  END IF;

  IF v_role = 'authenticated'
     AND _technician_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin_or_management() THEN
    RETURN NULL;
  END IF;

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

revoke all on function public.extras_total_for_job_tech(uuid, uuid) from public, anon;
grant execute on function public.extras_total_for_job_tech(uuid, uuid) to authenticated, service_role;
