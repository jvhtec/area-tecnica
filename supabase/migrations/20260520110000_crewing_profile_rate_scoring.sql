-- Add profile-era cost/rate scoring to rank_staffing_candidates without
-- changing the RPC signature or returned columns.

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.rank_staffing_candidates(uuid,text,text,text,jsonb)'::regprocedure)
  INTO v_sql;

  v_sql := replace(
    v_sql,
$old$
  w_experience numeric := COALESCE((p_policy->'weights'->>'experience')::numeric, 0.1);
  w_sum numeric;
$old$,
$new$
  w_experience numeric := COALESCE((p_policy->'weights'->>'role_progression')::numeric, COALESCE((p_policy->'weights'->>'experience')::numeric, 0.1));
  w_cost_efficiency numeric := COALESCE((p_policy->'weights'->>'cost_efficiency')::numeric, 0);
  w_sum numeric;
  v_apply_rate_adjustment boolean := COALESCE((p_policy->'cost_scoring'->>'enabled')::boolean, false);
  v_rate_penalty_multiplier numeric := CASE COALESCE(p_policy->'cost_scoring'->>'penalty_strength', 'normal')
    WHEN 'disabled' THEN 0
    WHEN 'low' THEN 0.5
    WHEN 'high' THEN 1.5
    ELSE 1
  END;
  v_max_rate_penalty numeric := COALESCE((p_policy->'cost_scoring'->>'max_rate_penalty')::numeric, 10);
  v_rate_category text;
$new$
  );

  v_sql := replace(
    v_sql,
$old$
  v_role_prefix := public.staffing_role_prefix(v_normalized_role_code);
$old$,
$new$
  v_role_prefix := public.staffing_role_prefix(v_normalized_role_code);
  v_rate_category := CASE
    WHEN v_normalized_role_code ~ '-R$'
      OR v_normalized_role_code ~* '(RESP|LEAD|CHIEF|PM)'
    THEN 'responsable'
    WHEN v_normalized_role_code ~ '-E$' THEN 'especialista'
    ELSE 'tecnico'
  END;
$new$
  );

  v_sql := replace(
    v_sql,
$old$
  w_sum := w_skills + w_proximity + w_reliability + w_fairness + w_experience;
$old$,
$new$
  w_sum := w_skills + w_proximity + w_reliability + w_fairness + w_experience + w_cost_efficiency;
$new$
  );

  v_sql := replace(
    v_sql,
$old$
    w_experience := 0.1;
    w_sum := 1;
$old$,
$new$
    w_experience := 0.1;
    w_cost_efficiency := 0;
    w_sum := 1;
$new$
  );

  v_sql := replace(
    v_sql,
$old$
  w_experience := w_experience / w_sum;
$old$,
$new$
  w_experience := w_experience / w_sum;
  w_cost_efficiency := w_cost_efficiency / w_sum;
$new$
  );

  v_sql := replace(
    v_sql,
$old$
  role_declines AS (
$old$,
$new$
  rate_adjustments AS (
    SELECT
      b.profile_id,
      COALESCE(std.base_day_eur, 0)::numeric AS standard_role_rate,
      COALESCE(
        CASE v_rate_category
          WHEN 'responsable' THEN COALESCE(ctr.base_day_responsable_eur, ctr.base_day_especialista_eur, ctr.base_day_eur)
          WHEN 'especialista' THEN COALESCE(ctr.base_day_especialista_eur, ctr.base_day_eur)
          ELSE ctr.base_day_eur
        END,
        std.base_day_eur,
        0
      )::numeric AS candidate_rate,
      ctr.profile_id IS NOT NULL AS has_custom_rate_override
    FROM base b
    LEFT JOIN public.rate_cards_2025 std ON std.category = v_rate_category
    LEFT JOIN public.custom_tech_rates ctr ON ctr.profile_id = b.profile_id
  ),
  role_declines AS (
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      )::int AS role_decline_penalty
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN role_declines rd ON rd.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
$old$,
$new$
      )::int AS role_decline_penalty,
      COALESCE(ra.standard_role_rate, 0)::numeric AS standard_role_rate,
      COALESCE(ra.candidate_rate, ra.standard_role_rate, 0)::numeric AS candidate_rate,
      COALESCE(ra.has_custom_rate_override, false) AS has_custom_rate_override,
      CASE
        WHEN COALESCE(ra.standard_role_rate, 0) > 0
        THEN COALESCE(ra.candidate_rate, ra.standard_role_rate, 0)::numeric / ra.standard_role_rate
        ELSE 1
      END AS rate_ratio,
      CASE
        WHEN v_apply_rate_adjustment
          AND COALESCE(ra.standard_role_rate, 0) > 0
          AND COALESCE(ra.candidate_rate, ra.standard_role_rate, 0) > ra.standard_role_rate
        THEN LEAST(
          ((COALESCE(ra.candidate_rate, ra.standard_role_rate, 0)::numeric / ra.standard_role_rate) - 1) * 25 * v_rate_penalty_multiplier,
          v_max_rate_penalty
        )
        ELSE 0
      END AS rate_penalty
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN role_declines rd ON rd.profile_id = b.profile_id
    LEFT JOIN rate_adjustments ra ON ra.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      wr.role_declined_requests,
      wr.role_decline_penalty,
      wr.jobs_worked,
$old$,
$new$
      wr.role_declined_requests,
      wr.role_decline_penalty,
      wr.standard_role_rate,
      wr.candidate_rate,
      wr.has_custom_rate_override,
      wr.rate_ratio,
      wr.rate_penalty,
      GREATEST(0, 100 - ROUND(wr.rate_penalty * 10)::int) AS cost_efficiency_score,
      wr.jobs_worked,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
          (f.fairness_score::numeric * 10) * w_fairness +
          (f.experience_score::numeric * 10) * w_experience
$old$,
$new$
          (f.fairness_score::numeric * 10) * w_fairness +
          (f.experience_score::numeric * 10) * w_experience +
          (f.cost_efficiency_score::numeric) * w_cost_efficiency
$new$
  );

  v_sql := replace(
    v_sql,
$old$
    (CASE
      WHEN f.user_role = 'house_tech' AND f.current_month_days < 4
      THEN jsonb_build_array('House tech boost (+30%)')
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
$old$,
$new$
    (CASE
      WHEN f.user_role = 'house_tech' AND f.current_month_days < 4
      THEN jsonb_build_array('House tech boost (+30%)')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.standard_role_rate > 0
      THEN jsonb_build_array(
        'Standard role rate: €' || ROUND(f.standard_role_rate::numeric, 2),
        'Candidate rate: €' || ROUND(f.candidate_rate::numeric, 2),
        'Custom rate override: ' || CASE WHEN f.has_custom_rate_override THEN 'Yes' ELSE 'No' END
      )
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.rate_penalty > 0
      THEN jsonb_build_array(
        'Rate adjustment: -' || ROUND(f.rate_penalty::numeric, 1) ||
        ' (' || ROUND(((f.rate_ratio - 1) * 100)::numeric, 0) || '% above standard)'
      )
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
$new$
  );

  IF v_sql NOT LIKE '%rate_adjustments AS%'
    OR v_sql NOT LIKE '%cost_efficiency_score%'
    OR v_sql NOT LIKE '%Rate adjustment:%'
    OR v_sql NOT LIKE '%custom_tech_rates%'
  THEN
    RAISE EXCEPTION 'Failed to patch rank_staffing_candidates with profile cost/rate scoring';
  END IF;

  EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
