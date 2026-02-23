-- Track invoice reception per (job, technician) assignment.
-- This avoids per-timesheet duplication when a technician has multiple worked dates.

ALTER TABLE public.job_assignments
  ADD COLUMN IF NOT EXISTS invoice_received_at timestamp with time zone;

ALTER TABLE public.job_assignments
  ADD COLUMN IF NOT EXISTS invoice_received_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_assignments_invoice_received_by_fkey'
      AND conrelid = 'public.job_assignments'::regclass
  ) THEN
    ALTER TABLE public.job_assignments
      ADD CONSTRAINT job_assignments_invoice_received_by_fkey
      FOREIGN KEY (invoice_received_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_job_assignments_invoice_received_at
  ON public.job_assignments (invoice_received_at);

COMMENT ON COLUMN public.job_assignments.invoice_received_at IS
  'Timestamp when administration confirms invoice receipt for this job+technician assignment.';

COMMENT ON COLUMN public.job_assignments.invoice_received_by IS
  'Profile ID that marked invoice_received_at.';
