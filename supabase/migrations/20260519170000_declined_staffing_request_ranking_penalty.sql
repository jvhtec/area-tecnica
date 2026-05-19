-- Penalize repeated declined staffing requests for the same role prefix.
-- Availability rows remain job-scoped; role intent for those rows comes from
-- the latest send event metadata.

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.rank_staffing_candidates(uuid,text,text,text,jsonb)'::regprocedure)
  INTO v_sql;

  v_sql := replace(
    v_sql,
$old$
  reliability_stats AS (
$old$,
$new$
  role_declines AS (
    SELECT
      b.profile_id,
      COUNT(DISTINCT sr.id)::int AS role_declined_requests
    FROM base b
    JOIN staffing_requests sr ON sr.profile_id = b.profile_id
      AND sr.status = 'declined'
    LEFT JOIN LATERAL (
      SELECT NULLIF(BTRIM(se.meta->>'role'), '') AS event_role_code
      FROM staffing_events se
      WHERE se.staffing_request_id = sr.id
        AND se.event IN ('email_sent', 'whatsapp_sent')
        AND se.meta->>'phase' = sr.phase
        AND NULLIF(BTRIM(se.meta->>'role'), '') IS NOT NULL
      ORDER BY se.created_at DESC
      LIMIT 1
    ) latest_role ON true
    WHERE public.staffing_role_prefix(
      COALESCE(NULLIF(BTRIM(sr.role_code), ''), latest_role.event_role_code)
    ) = v_role_prefix
    GROUP BY b.profile_id
  ),
  reliability_stats AS (
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
$old$,
$new$
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total,
      COALESCE(rd.role_declined_requests, 0)::int AS role_declined_requests,
      (
        CASE
          WHEN COALESCE(rd.role_declined_requests, 0) >= 5 THEN 30
          WHEN COALESCE(rd.role_declined_requests, 0) >= 3 THEN 20
          WHEN COALESCE(rd.role_declined_requests, 0) = 2 THEN 12
          WHEN COALESCE(rd.role_declined_requests, 0) = 1 THEN 6
          ELSE 0
        END
      )::int AS role_decline_penalty
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN role_declines rd ON rd.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      GREATEST(wr.manual_skill_score, wr.role_experience_score)::int AS skills_score,
      wr.manual_skill_score,
      wr.best_skill,
      wr.role_completed_jobs,
      wr.role_experience_score,
$old$,
$new$
      GREATEST(0, GREATEST(wr.manual_skill_score, wr.role_experience_score) - wr.role_decline_penalty)::int AS skills_score,
      wr.manual_skill_score,
      wr.best_skill,
      wr.role_completed_jobs,
      wr.role_experience_score,
      wr.role_declined_requests,
      wr.role_decline_penalty,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
    (CASE
      WHEN f.role_experience_score > f.manual_skill_score
      THEN jsonb_build_array('Skill score boosted by completed role history')
      ELSE '[]'::jsonb
    END) ||
$old$,
$new$
    (CASE
      WHEN f.role_experience_score > f.manual_skill_score
      THEN jsonb_build_array('Skill score boosted by completed role history')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.role_declined_requests > 0
      THEN jsonb_build_array('Declined role requests: ' || f.role_declined_requests || ' previous ' || COALESCE(v_role_prefix, p_role_code) || ' declines (-' || f.role_decline_penalty || ' skill pts)')
      ELSE '[]'::jsonb
    END) ||
$new$
  );

  IF v_sql NOT LIKE '%role_declines AS%'
    OR v_sql NOT LIKE '%role_decline_penalty%'
    OR v_sql NOT LIKE '%Declined role requests:%'
  THEN
    RAISE EXCEPTION 'Failed to patch rank_staffing_candidates with declined request penalty';
  END IF;

  EXECUTE v_sql;
END;
$$;
