-- Hourly technician/date overrides are the exception to the normal tour-date
-- rule: they require a real timesheet that technicians can fill and management
-- can review. Keep the source table admin-only and expose only the identifiers
-- needed by the timesheet UI.

CREATE OR REPLACE FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(
  _job_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  technician_id uuid,
  date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT
    override_row.job_id,
    override_row.technician_id,
    override_row.date
  FROM public.job_technician_rate_mode_dates AS override_row
  WHERE override_row.rate_mode = 'hourly'
    AND (_job_ids IS NULL OR override_row.job_id = ANY(_job_ids))
    AND (
      public.is_admin_or_management()
      OR override_row.technician_id = (SELECT auth.uid())
    );
$function$;

REVOKE ALL ON FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_hourly_rate_mode_timesheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.rate_mode = 'hourly' THEN
    INSERT INTO public.timesheets (
      job_id,
      technician_id,
      date,
      created_by,
      source,
      is_active
    ) VALUES (
      NEW.job_id,
      NEW.technician_id,
      NEW.date,
      COALESCE(NEW.updated_by, NEW.created_by),
      'hourly_rate_override',
      true
    )
    ON CONFLICT (job_id, technician_id, date)
    DO UPDATE
      SET is_active = true,
          source = CASE
            WHEN public.timesheets.source IS NULL OR public.timesheets.source = 'matrix'
              THEN 'hourly_rate_override'
            ELSE public.timesheets.source
          END,
          updated_at = now()
      WHERE public.timesheets.is_active IS DISTINCT FROM true
         OR public.timesheets.source IS NULL
         OR public.timesheets.source = 'matrix';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_hourly_rate_mode_timesheet() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_hourly_rate_mode_timesheet() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_ensure_hourly_rate_mode_timesheet
  ON public.job_technician_rate_mode_dates;
CREATE TRIGGER trg_ensure_hourly_rate_mode_timesheet
  AFTER INSERT OR UPDATE OF rate_mode
  ON public.job_technician_rate_mode_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_hourly_rate_mode_timesheet();

-- Repair any hourly overrides created before this invariant existed, including
-- reactivating a soft-deleted timesheet that occupies the unique key.
INSERT INTO public.timesheets (
  job_id,
  technician_id,
  date,
  created_by,
  source,
  is_active
)
SELECT
  override_row.job_id,
  override_row.technician_id,
  override_row.date,
  COALESCE(override_row.updated_by, override_row.created_by),
  'hourly_rate_override',
  true
FROM public.job_technician_rate_mode_dates AS override_row
WHERE override_row.rate_mode = 'hourly'
ON CONFLICT (job_id, technician_id, date)
DO UPDATE
  SET is_active = true,
      source = CASE
        WHEN public.timesheets.source IS NULL OR public.timesheets.source = 'matrix'
          THEN 'hourly_rate_override'
        ELSE public.timesheets.source
      END,
      updated_at = now()
  WHERE public.timesheets.is_active IS DISTINCT FROM true
     OR public.timesheets.source IS NULL
     OR public.timesheets.source = 'matrix';

COMMENT ON FUNCTION public.ensure_hourly_rate_mode_timesheet() IS
  'Maintains the invariant that every hourly technician/date rate override has an active timesheet.';
