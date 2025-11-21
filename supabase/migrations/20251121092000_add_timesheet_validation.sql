-- Add validation constraints and status transition trigger for timesheets
-- Safe to run multiple times; uses IF NOT EXISTS where applicable.

DO $$
BEGIN
  -- CHECK constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_break_minutes_positive') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT chk_break_minutes_positive
        CHECK (break_minutes >= 0 AND break_minutes <= 1440);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_overtime_positive') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT chk_overtime_positive
        CHECK (overtime_hours >= 0 AND overtime_hours <= 24);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_times') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT chk_valid_times
        CHECK (
          (start_time IS NULL AND end_time IS NULL) OR
          (start_time IS NOT NULL AND end_time IS NOT NULL)
        );
  END IF;

  -- Signature constraint skipped - existing production data doesn't have signatures
  -- Future enhancement: Consider adding this constraint after backfilling signature data

  -- Status transition trigger function
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_timesheet_status_transition') THEN
    CREATE OR REPLACE FUNCTION validate_timesheet_status_transition()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF NEW.status = 'draft' THEN
        RETURN NEW;
      END IF;
      IF OLD.status = 'draft' AND NEW.status NOT IN ('submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: draft can only move to submitted';
      END IF;
      IF OLD.status = 'submitted' AND NEW.status NOT IN ('approved', 'submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: submitted can only move to approved or draft';
      END IF;
      IF OLD.status = 'approved' AND NEW.status NOT IN ('submitted', 'approved') THEN
        RAISE EXCEPTION 'Invalid transition: approved can only be reverted to submitted';
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;

  -- Trigger for status transition
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_status_transition') THEN
    CREATE TRIGGER trg_validate_status_transition
      BEFORE UPDATE OF status ON public.timesheets
      FOR EACH ROW
      EXECUTE FUNCTION validate_timesheet_status_transition();
  END IF;
END $$;
