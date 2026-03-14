-- Step 2: Add quantity constraint and seed catalog for 'conduccion'.
-- Runs in a separate transaction from the enum addition (20260314000000)
-- so the new enum value is already committed and safe to reference.

-- Quantity check constraint (max 1 per tech per job)
ALTER TABLE public.job_rate_extras
  ADD CONSTRAINT job_rate_extras_check3
  CHECK ((extra_type <> 'conduccion'::public.job_extra_type) OR (quantity <= 1));

-- Seed catalog with €50 default rate
INSERT INTO public.rate_extras_2025 (extra_type, amount_eur)
VALUES ('conduccion', 50.00)
ON CONFLICT (extra_type) DO NOTHING;
