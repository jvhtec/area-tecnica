-- Follow-ups from docs/PERFORMANCE_AUDIT_2026-07-01.md.

CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id
  ON public.stock_movements USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_technician_availability_technician_id
  ON public.technician_availability USING btree (technician_id);

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING '[v_job_staffing_summary] pg_cron is not installed; skipping refresh schedule setup.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-v-job-staffing-summary') THEN
    PERFORM cron.unschedule('refresh-v-job-staffing-summary');
  END IF;

  PERFORM cron.schedule(
    'refresh-v-job-staffing-summary',
    '*/5 * * * *',
    'SELECT public.refresh_v_job_staffing_summary();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[v_job_staffing_summary] refresh schedule setup skipped: %', SQLERRM;
END $$;
