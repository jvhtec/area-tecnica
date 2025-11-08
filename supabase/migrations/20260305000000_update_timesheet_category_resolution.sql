-- Update resolve_category_for_timesheet to prefer job assignment roles
CREATE OR REPLACE FUNCTION public.resolve_category_for_timesheet(_job_id uuid, _tech_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cat text;
BEGIN
  -- 1) Attempt to resolve from job assignment role suffixes (R > E > T)
  SELECT
    CASE
      WHEN (UPPER(COALESCE(sound_role, '')) LIKE '%-R') OR (UPPER(COALESCE(lights_role, '')) LIKE '%-R') OR (UPPER(COALESCE(video_role, '')) LIKE '%-R') THEN 'responsable'
      WHEN (UPPER(COALESCE(sound_role, '')) LIKE '%-E') OR (UPPER(COALESCE(lights_role, '')) LIKE '%-E') OR (UPPER(COALESCE(video_role, '')) LIKE '%-E') THEN 'especialista'
      WHEN (UPPER(COALESCE(sound_role, '')) LIKE '%-T') OR (UPPER(COALESCE(lights_role, '')) LIKE '%-T') OR (UPPER(COALESCE(video_role, '')) LIKE '%-T') THEN 'tecnico'
      ELSE NULL
    END
  INTO cat
  FROM job_assignments
  WHERE job_id = _job_id
    AND technician_id = _tech_id
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 2) Last known category for the same (job, tech)
  SELECT category INTO cat
  FROM timesheets
  WHERE job_id = _job_id AND technician_id = _tech_id AND category IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 3) From profile default
  SELECT default_timesheet_category INTO cat
  FROM profiles
  WHERE id = _tech_id AND default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  RETURN NULL;
END;
$$;

-- Backfill existing timesheets so stored categories and breakdowns match the new resolver
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, resolved
    FROM (
      SELECT t.id,
             t.category,
             resolve_category_for_timesheet(t.job_id, t.technician_id) AS resolved
      FROM timesheets t
    ) s
    WHERE resolved IS NOT NULL
      AND resolved IS DISTINCT FROM category
  LOOP
    UPDATE timesheets
    SET category = rec.resolved
    WHERE id = rec.id;

    PERFORM compute_timesheet_amount_2025(rec.id, true);
  END LOOP;
END;
$$;
