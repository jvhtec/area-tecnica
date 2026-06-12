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

-- The wallboard consumes this view as a text status. Without an explicit
-- rejected branch, rejected parts fall through to "missing"; voided parts
-- must also stay out of the aggregate.
create or replace view public.wallboard_timesheet_status
with (security_invoker = 'true', security_barrier = 'true') as
select
  t.job_id,
  t.technician_id,
  case
    -- Compare through text because a newly-added enum value cannot be cast
    -- explicitly until the ALTER TYPE transaction commits.
    when bool_or(t.status::text = 'rejected') then 'rejected'::text
    when bool_or(t.status = 'approved'::public.timesheet_status) then 'approved'::text
    when bool_or(t.status = 'submitted'::public.timesheet_status) then 'submitted'::text
    when bool_or(t.status = 'draft'::public.timesheet_status) then 'draft'::text
    else 'missing'::text
  end as status
from public.timesheets t
where t.is_active = true
group by t.job_id, t.technician_id;
