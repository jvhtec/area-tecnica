-- Tour team role edits must reach future jobs in the tour without rewriting
-- historical job_assignments.
--
-- tour_assignments already syncs to job_assignments on INSERT
-- (tour_assignment_insert_trigger) and DELETE (tour_assignment_delete_trigger),
-- but there was no trigger for UPDATEs, so changing a team member's role left
-- future per-job job_assignments rows stale. This trigger deliberately does not
-- reuse sync_tour_assignments_to_jobs because that insert-sync function touches
-- every job in the tour, including past dates.

CREATE OR REPLACE FUNCTION public.sync_tour_assignment_role_update_to_future_jobs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Madrid')::date;
BEGIN
  IF NEW.technician_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH future_tour_jobs AS (
    SELECT j.id AS job_id
    FROM public.jobs j
    LEFT JOIN public.tour_dates td
      ON td.id = j.tour_date_id
    LEFT JOIN LATERAL (
      SELECT MIN(jdt.date) AS schedule_start
      FROM public.job_date_types jdt
      WHERE jdt.job_id = j.id
        AND jdt.type <> 'prep_day'
    ) jdt ON TRUE
    WHERE j.tour_id = NEW.tour_id
      AND j.job_type = 'tourdate'
      AND COALESCE(
        jdt.schedule_start,
        td.start_date,
        (j.start_time AT TIME ZONE 'Europe/Madrid')::date,
        td.date
      ) >= v_today
  )
  INSERT INTO public.job_assignments (
    job_id,
    technician_id,
    sound_role,
    lights_role,
    video_role,
    assigned_by,
    assigned_at,
    assignment_source
  )
  SELECT
    ftj.job_id,
    NEW.technician_id,
    CASE WHEN NEW.department = 'sound' THEN NEW.role END,
    CASE WHEN NEW.department = 'lights' THEN NEW.role END,
    CASE WHEN NEW.department = 'video' THEN NEW.role END,
    NEW.assigned_by,
    NEW.assigned_at,
    'tour'
  FROM future_tour_jobs ftj
  ON CONFLICT (job_id, technician_id)
  DO UPDATE SET
    sound_role = CASE
      WHEN NEW.department = 'sound' AND EXCLUDED.assignment_source = 'tour'
      THEN NEW.role
      ELSE job_assignments.sound_role
    END,
    lights_role = CASE
      WHEN NEW.department = 'lights' AND EXCLUDED.assignment_source = 'tour'
      THEN NEW.role
      ELSE job_assignments.lights_role
    END,
    video_role = CASE
      WHEN NEW.department = 'video' AND EXCLUDED.assignment_source = 'tour'
      THEN NEW.role
      ELSE job_assignments.video_role
    END,
    assigned_at = CASE
      WHEN EXCLUDED.assignment_source = 'tour'
      THEN NEW.assigned_at
      ELSE job_assignments.assigned_at
    END
  WHERE job_assignments.assignment_source = 'tour';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tour_assignment_update_trigger ON public.tour_assignments;

CREATE TRIGGER tour_assignment_update_trigger
  AFTER UPDATE OF role ON public.tour_assignments
  FOR EACH ROW
  WHEN (NEW.technician_id IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION public.sync_tour_assignment_role_update_to_future_jobs();
