-- The app has had a full rejection workflow in the UI (reject dialog,
-- 'Rechazado' badge, rejection_reason alert, resubmit path) and the
-- timesheets table has rejected_at/rejected_by/rejection_reason columns —
-- but the timesheet_status enum never gained a 'rejected' value and the
-- transition trigger didn't allow it, so rejections failed at the database.
--
-- Add the enum value and teach the trigger the full lifecycle:
--   draft     -> submitted
--   submitted -> approved | rejected | draft (reset)
--   approved  -> submitted (revert) | draft (reset)
--   rejected  -> submitted (resubmit) | draft (reset/refill)
-- Any status may move to 'draft' (management reset), preserving the
-- existing behavior of the trigger's first branch.

alter type public.timesheet_status add value if not exists 'rejected';

create or replace function public.validate_timesheet_status_transition() returns trigger
    language plpgsql
    set search_path to 'pg_catalog', 'public'
    as $$
    BEGIN
      IF NEW.status = 'draft' THEN
        RETURN NEW;
      END IF;
      IF OLD.status = 'draft' AND NEW.status NOT IN ('submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: draft can only move to submitted';
      END IF;
      IF OLD.status = 'submitted' AND NEW.status NOT IN ('approved', 'rejected', 'submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: submitted can only move to approved, rejected or draft';
      END IF;
      IF OLD.status = 'approved' AND NEW.status NOT IN ('submitted', 'approved') THEN
        RAISE EXCEPTION 'Invalid transition: approved can only be reverted to submitted';
      END IF;
      IF OLD.status = 'rejected' AND NEW.status NOT IN ('submitted', 'rejected', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: rejected can only move to submitted or draft';
      END IF;
      RETURN NEW;
    END;
    $$;
