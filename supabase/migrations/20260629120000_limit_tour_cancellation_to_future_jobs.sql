-- Limit "tour not happening" cascades to work that has not started yet.
-- Completed and already-started jobs remain historical records even when the
-- parent tour is cancelled.

CREATE OR REPLACE FUNCTION public.cascade_tour_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE public.jobs j
    SET status = 'Cancelado'::public.job_status
    WHERE j.tour_id = NEW.id
      AND j.start_time > now()
      AND j.status NOT IN (
        'Cancelado'::public.job_status,
        'Completado'::public.job_status
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Conservative repair for jobs previously overwritten by the old cascade.
-- Only restore past cancelled tour jobs when activity history or worked
-- timesheets prove the date happened; avoid guessing on tours that were
-- cancelled before the crew worked.
WITH worked_cancelled_past_tour_jobs AS (
  SELECT DISTINCT j.id
  FROM public.jobs j
  INNER JOIN public.tours t ON t.id = j.tour_id
  WHERE t.status = 'cancelled'
    AND j.status = 'Cancelado'::public.job_status
    AND j.end_time <= now()
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        WHERE al.job_id = j.id
          AND al.code = 'job.updated'
          AND al.payload #>> '{diff,status,from}' = 'Completado'
          AND al.payload #>> '{diff,status,to}' = 'Cancelado'
      )
      OR EXISTS (
        SELECT 1
        FROM public.timesheets ts
        WHERE ts.job_id = j.id
          AND ts.is_active = true
          AND COALESCE(ts.is_schedule_only, false) = false
          AND ts.status IN (
            'submitted'::public.timesheet_status,
            'approved'::public.timesheet_status
          )
        )
      )
    )
)
UPDATE public.jobs j
SET status = 'Completado'::public.job_status
FROM worked_cancelled_past_tour_jobs worked
WHERE j.id = worked.id;
