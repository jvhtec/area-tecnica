-- Add rejection metadata to timesheets
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.timesheets.rejected_at IS 'Timestamp when the timesheet was rejected.';
COMMENT ON COLUMN public.timesheets.rejected_by IS 'Profile that rejected the timesheet.';
COMMENT ON COLUMN public.timesheets.rejection_reason IS 'Optional explanation provided when rejecting the timesheet.';

CREATE INDEX IF NOT EXISTS timesheets_rejected_by_idx ON public.timesheets (rejected_by);
