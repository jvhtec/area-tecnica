-- Index foreign key used for invoice receipt tracking lookups and FK maintenance.
CREATE INDEX IF NOT EXISTS idx_job_assignments_invoice_received_by
  ON public.job_assignments (invoice_received_by)
  WHERE invoice_received_by IS NOT NULL;
