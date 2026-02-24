-- Keep invoice_received_by for auditing, but remove FK to avoid
-- PostgREST relationship ambiguity on job_assignments -> profiles joins.
-- Several existing screens rely on implicit relationship resolution.

ALTER TABLE public.job_assignments
  DROP CONSTRAINT IF EXISTS job_assignments_invoice_received_by_fkey;
