-- Add job linkage and stock extension flag to sub_rentals table
-- This allows subrentals to be optionally associated with specific jobs
-- and to be marked as long-term stock extensions vs job-specific rentals

ALTER TABLE public.sub_rentals
ADD COLUMN IF NOT EXISTS job_id uuid NULL REFERENCES public.jobs(id) ON DELETE SET NULL;

ALTER TABLE public.sub_rentals
ADD COLUMN IF NOT EXISTS is_stock_extension boolean DEFAULT false;

-- Add index for performance when querying sub-rentals by job
CREATE INDEX IF NOT EXISTS idx_sub_rentals_job_id ON public.sub_rentals(job_id) WHERE job_id IS NOT NULL;

COMMENT ON COLUMN public.sub_rentals.job_id IS 'Optional link to a specific job when the subrental is job-related';
COMMENT ON COLUMN public.sub_rentals.is_stock_extension IS 'True if this is a long-term stock extension not tied to a specific job';

-- Update RLS policies to allow access based on job assignments
DROP POLICY IF EXISTS "Department can view sub_rentals" ON public.sub_rentals;
DROP POLICY IF EXISTS "Department can insert sub_rentals" ON public.sub_rentals;
DROP POLICY IF EXISTS "Department can update sub_rentals" ON public.sub_rentals;
DROP POLICY IF EXISTS "Department can delete sub_rentals" ON public.sub_rentals;

-- View: Users can see sub_rentals for their department OR for jobs they're assigned to
CREATE POLICY "Users can view department or job-related sub_rentals"
  ON public.sub_rentals
  FOR SELECT
  USING (
    -- Same department access
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
    OR
    -- Job-based access (if sub_rental has a job_id)
    (
      public.sub_rentals.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = public.sub_rentals.job_id
          AND ja.user_id = auth.uid()
      )
    )
  );

-- Insert: Users can create sub_rentals for their department OR for jobs they're assigned to
CREATE POLICY "Users can insert department or job-related sub_rentals"
  ON public.sub_rentals
  FOR INSERT
  WITH CHECK (
    -- Same department access
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
    OR
    -- Job-based access (if sub_rental has a job_id)
    (
      public.sub_rentals.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = public.sub_rentals.job_id
          AND ja.user_id = auth.uid()
      )
    )
  );

-- Update: Users can update sub_rentals for their department OR for jobs they're assigned to
CREATE POLICY "Users can update department or job-related sub_rentals"
  ON public.sub_rentals
  FOR UPDATE
  USING (
    -- Same department access
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
    OR
    -- Job-based access (if sub_rental has a job_id)
    (
      public.sub_rentals.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = public.sub_rentals.job_id
          AND ja.user_id = auth.uid()
      )
    )
  );

-- Delete: Users can delete sub_rentals for their department OR for jobs they're assigned to
CREATE POLICY "Users can delete department or job-related sub_rentals"
  ON public.sub_rentals
  FOR DELETE
  USING (
    -- Same department access
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
    OR
    -- Job-based access (if sub_rental has a job_id)
    (
      public.sub_rentals.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = public.sub_rentals.job_id
          AND ja.user_id = auth.uid()
      )
    )
  );
