-- Create table to track SoundVision file downloads
CREATE TABLE IF NOT EXISTS public.soundvision_file_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.soundvision_files(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  UNIQUE (file_id, profile_id)
);

-- Enable row level security
ALTER TABLE public.soundvision_file_downloads ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own download records, management/admin can view all
DROP POLICY IF EXISTS soundvision_file_downloads_select_self_or_management ON public.soundvision_file_downloads;
CREATE POLICY soundvision_file_downloads_select_self_or_management
  ON public.soundvision_file_downloads FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  );

-- Allow users to insert download records for themselves
DROP POLICY IF EXISTS soundvision_file_downloads_insert_self ON public.soundvision_file_downloads;
CREATE POLICY soundvision_file_downloads_insert_self
  ON public.soundvision_file_downloads FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Allow users to delete their own records and management/admin to manage all records
DROP POLICY IF EXISTS soundvision_file_downloads_delete_self_or_management ON public.soundvision_file_downloads;
CREATE POLICY soundvision_file_downloads_delete_self_or_management
  ON public.soundvision_file_downloads FOR DELETE
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  );

-- Update review policies to enforce download requirement before inserting/updating reviews
DROP POLICY IF EXISTS soundvision_file_reviews_insert_self_or_management ON public.soundvision_file_reviews;
CREATE POLICY soundvision_file_reviews_insert_self_or_management
  ON public.soundvision_file_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_management_or_admin(auth.uid())
    OR (
      reviewer_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.soundvision_file_downloads d
        WHERE d.file_id = soundvision_file_reviews.file_id
          AND d.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS soundvision_file_reviews_update_self_or_management ON public.soundvision_file_reviews;
CREATE POLICY soundvision_file_reviews_update_self_or_management
  ON public.soundvision_file_reviews FOR UPDATE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  )
  WITH CHECK (
    public.is_management_or_admin(auth.uid())
    OR (
      reviewer_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.soundvision_file_downloads d
        WHERE d.file_id = soundvision_file_reviews.file_id
          AND d.profile_id = auth.uid()
      )
    )
  );

-- Helpful indexes for queries
CREATE INDEX IF NOT EXISTS idx_soundvision_file_downloads_file_id ON public.soundvision_file_downloads(file_id);
CREATE INDEX IF NOT EXISTS idx_soundvision_file_downloads_profile_id ON public.soundvision_file_downloads(profile_id);
CREATE INDEX IF NOT EXISTS idx_soundvision_file_downloads_downloaded_at ON public.soundvision_file_downloads(downloaded_at DESC);
