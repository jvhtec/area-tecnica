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
  -- 1) Attempt to resolve from job assignment roles using the same
  --    normalization as compute_timesheet_amount_2025
  WITH roles AS (
         SELECT unnest(ARRAY[ja.sound_role, ja.lights_role, ja.video_role]) AS role_code
         FROM job_assignments ja
         WHERE ja.job_id = _job_id
           AND ja.technician_id = _tech_id
       ),
       prepared AS (
         SELECT role_code,
                UPPER(NULLIF(split_part(role_code, '-', 3), '')) AS lvl_raw
         FROM roles
         WHERE role_code IS NOT NULL
       ),
       normalized AS (
         SELECT CASE
                  WHEN lvl_raw IS NOT NULL AND lvl_raw <> '' THEN lvl_raw
                  WHEN role_code ~* 'responsable' THEN 'R'
                  WHEN role_code ~* 'especialista' THEN 'E'
                  WHEN role_code ~* 't[eé]cnico' THEN 'T'
                  ELSE NULL
                END AS lvl
         FROM prepared
       ),
       ranked AS (
         SELECT lvl,
                CASE lvl
                  WHEN 'R' THEN 3
                  WHEN 'E' THEN 2
                  WHEN 'T' THEN 1
                  ELSE 0
                END AS weight
         FROM normalized
         WHERE lvl IS NOT NULL
       )
  SELECT CASE lvl
           WHEN 'R' THEN 'responsable'
           WHEN 'E' THEN 'especialista'
           WHEN 'T' THEN 'tecnico'
         END
  INTO cat
  FROM ranked
  ORDER BY weight DESC
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

-- Re-run the backfill so amounts and stored categories match the improved resolver
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT t.id,
           t.category,
           resolve_category_for_timesheet(t.job_id, t.technician_id) AS resolved
    FROM timesheets t
  LOOP
    IF rec.resolved IS NULL THEN
      CONTINUE;
    END IF;

    IF rec.resolved IS DISTINCT FROM rec.category THEN
      UPDATE timesheets
      SET category = rec.resolved
      WHERE id = rec.id;
    END IF;

    PERFORM compute_timesheet_amount_2025(rec.id, true);
  END LOOP;
END;
$$;
