-- Add version column and trigger for optimistic locking on timesheets
-- Safe to run multiple times; uses IF NOT EXISTS checks.

DO $$
BEGIN
  -- Add version column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='timesheets' AND column_name='version') THEN
    ALTER TABLE public.timesheets
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Create trigger function if missing
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_timesheet_version') THEN
    CREATE OR REPLACE FUNCTION increment_timesheet_version()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.version = OLD.version + 1;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;

  -- Create trigger if missing
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_increment_version') THEN
    CREATE TRIGGER trg_increment_version
      BEFORE UPDATE ON public.timesheets
      FOR EACH ROW
      EXECUTE FUNCTION increment_timesheet_version();
  END IF;
END $$;
