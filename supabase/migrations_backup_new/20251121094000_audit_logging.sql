-- Add audit logging for timesheets
-- Safe to run multiple times; uses IF NOT EXISTS checks.

DO $$
BEGIN
  -- Create audit log table if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timesheet_audit_log') THEN
    CREATE TABLE public.timesheet_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id),
      action TEXT NOT NULL,
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_audit_timesheet ON public.timesheet_audit_log(timesheet_id);
    CREATE INDEX idx_audit_user ON public.timesheet_audit_log(user_id);
    CREATE INDEX idx_audit_created ON public.timesheet_audit_log(created_at);
  END IF;

  -- Create trigger function if missing
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_timesheet_changes') THEN
    CREATE OR REPLACE FUNCTION log_timesheet_changes()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- For DELETE operations, skip audit logging since the timesheet_id FK will fail
      -- The audit log table has ON DELETE CASCADE, so it will be cleaned up automatically
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      -- For INSERT and UPDATE, log normally
      INSERT INTO public.timesheet_audit_log (
        timesheet_id,
        user_id,
        action,
        old_values,
        new_values
      ) VALUES (
        NEW.id,
        auth.uid(),
        TG_OP,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
      );

      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;

  -- Create trigger if missing
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_timesheets') THEN
    CREATE TRIGGER trg_audit_timesheets
      AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
      FOR EACH ROW
      EXECUTE FUNCTION log_timesheet_changes();
  END IF;
END $$;
