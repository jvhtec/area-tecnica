-- Ensure job_assignments can store multiple single-day rows per technician per job
-- by removing legacy PK collisions and using a surrogate primary key + partial uniques.

-- 1) Make sure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  pk_name text;
  has_id_col boolean;
  id_default text;
BEGIN
  -- Detect existing primary key (if any)
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.job_assignments'::regclass
    AND contype = 'p'
  LIMIT 1;

  -- Add id column if missing
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_assignments' AND column_name = 'id'
  ) INTO has_id_col;

  IF NOT has_id_col THEN
    ALTER TABLE public.job_assignments ADD COLUMN id uuid;
  END IF;

  -- If there is an existing primary key (often on job_id,technician_id), drop it
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.job_assignments DROP CONSTRAINT %I', pk_name);
  END IF;

  -- Ensure default for id
  SELECT column_default INTO id_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'job_assignments' AND column_name = 'id';

  IF id_default IS NULL THEN
    ALTER TABLE public.job_assignments ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Backfill null ids
  UPDATE public.job_assignments SET id = gen_random_uuid() WHERE id IS NULL;

  -- Set new primary key on id (idempotent guard)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_assignments'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 2) Enforce intended business uniqueness with partial unique indexes
-- Whole-job unique: at most one whole-job assignment per tech per job
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_whole_job_unique
  ON public.job_assignments (job_id, technician_id)
  WHERE (single_day = false OR assignment_date IS NULL);

-- Single-day unique: at most one single-day row per tech per job per date
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_single_day_unique
  ON public.job_assignments (job_id, technician_id, assignment_date)
  WHERE (single_day = true AND assignment_date IS NOT NULL);

-- 3) Check constraint to guarantee date presence when single_day is true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_assignments'::regclass AND conname = 'job_assignments_single_day_check'
  ) THEN
    ALTER TABLE public.job_assignments
      ADD CONSTRAINT job_assignments_single_day_check
      CHECK (single_day = false OR assignment_date IS NOT NULL);
  END IF;
END $$;

COMMENT ON INDEX job_assignments_whole_job_unique IS 'Uniqueness for whole-job assignments (assignment_date NULL or single_day=false).';
COMMENT ON INDEX job_assignments_single_day_unique IS 'Uniqueness for single-day assignments (one row per date).';

-- 4) Verification notices
DO $$
BEGIN
  RAISE NOTICE 'job_assignments PK fixed to surrogate id and partial uniques applied.';
END $$;

