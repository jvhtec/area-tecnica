-- Add batch grouping to sub_rentals so multiple items created together are linked

ALTER TABLE public.sub_rentals
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Backfill existing rows: use id as batch id to keep them grouped individually
UPDATE public.sub_rentals
SET batch_id = id
WHERE batch_id IS NULL;

-- Make it not null and default for future inserts
ALTER TABLE public.sub_rentals
  ALTER COLUMN batch_id SET NOT NULL,
  ALTER COLUMN batch_id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_sub_rentals_batch ON public.sub_rentals(batch_id);

