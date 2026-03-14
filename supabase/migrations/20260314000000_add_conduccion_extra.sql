-- Add 'conduccion' (driving) extra type to the catalog
-- Valued at €50 with a limit of 1 per technician per job

-- Add enum value (safe: IF NOT EXISTS)
ALTER TYPE public.job_extra_type ADD VALUE IF NOT EXISTS 'conduccion';

-- Add quantity check constraint (max 1 per tech per job)
-- Must use a DO block because enum values added in the same transaction are not immediately visible to CHECK constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'job_rate_extras'
      AND constraint_name = 'job_rate_extras_check3'
  ) THEN
    ALTER TABLE public.job_rate_extras
      ADD CONSTRAINT job_rate_extras_check3
      CHECK ((extra_type <> 'conduccion'::public.job_extra_type) OR (quantity <= 1));
  END IF;
END
$$;

-- Seed catalog with €50 default rate
INSERT INTO public.rate_extras_2025 (extra_type, amount_eur)
VALUES ('conduccion', 50.00)
ON CONFLICT (extra_type) DO NOTHING;
