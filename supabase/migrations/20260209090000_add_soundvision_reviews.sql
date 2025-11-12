-- Adds review aggregation columns and review table for SoundVision files

-- Add cached aggregate columns to soundvision_files
ALTER TABLE public.soundvision_files
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS ratings_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create soundvision_file_reviews table
CREATE TABLE IF NOT EXISTS public.soundvision_file_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.soundvision_files(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  is_initial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT soundvision_file_reviews_unique_reviewer UNIQUE (file_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_soundvision_file_reviews_file_id
  ON public.soundvision_file_reviews(file_id);

CREATE INDEX IF NOT EXISTS idx_soundvision_file_reviews_reviewer_id
  ON public.soundvision_file_reviews(reviewer_id);

-- Enable RLS
ALTER TABLE public.soundvision_file_reviews ENABLE ROW LEVEL SECURITY;

-- Helper expression to detect management roles
CREATE OR REPLACE FUNCTION public.is_management_or_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = p_user_id
      AND profiles.role IN ('admin', 'management')
  );
$$;

-- RLS Policies
CREATE POLICY soundvision_file_reviews_select_authenticated
  ON public.soundvision_file_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY soundvision_file_reviews_insert_self_or_management
  ON public.soundvision_file_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  );

CREATE POLICY soundvision_file_reviews_update_self_or_management
  ON public.soundvision_file_reviews FOR UPDATE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  )
  WITH CHECK (
    reviewer_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  );

CREATE POLICY soundvision_file_reviews_delete_self_or_management
  ON public.soundvision_file_reviews FOR DELETE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.is_management_or_admin(auth.uid())
  );

-- Trigger to maintain updated_at on reviews
CREATE OR REPLACE FUNCTION public.touch_soundvision_file_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soundvision_file_reviews_updated_at ON public.soundvision_file_reviews;
CREATE TRIGGER trg_soundvision_file_reviews_updated_at
  BEFORE UPDATE ON public.soundvision_file_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_soundvision_file_reviews_updated_at();

-- Trigger function to refresh aggregates
CREATE OR REPLACE FUNCTION public.refresh_soundvision_file_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_file_id UUID;
BEGIN
  v_file_id := COALESCE(NEW.file_id, OLD.file_id);

  UPDATE public.soundvision_files f
  SET
    ratings_count = stats.review_count,
    rating_total = stats.rating_sum,
    average_rating = CASE WHEN stats.review_count > 0
      THEN ROUND(stats.rating_sum::NUMERIC / stats.review_count, 2)
      ELSE NULL
    END,
    last_reviewed_at = stats.last_reviewed_at
  FROM (
    SELECT
      file_id,
      COUNT(*) AS review_count,
      COALESCE(SUM(rating), 0) AS rating_sum,
      MAX(updated_at) AS last_reviewed_at
    FROM public.soundvision_file_reviews
    WHERE file_id = v_file_id
    GROUP BY file_id
  ) AS stats
  WHERE f.id = stats.file_id;

  IF NOT FOUND THEN
    UPDATE public.soundvision_files
    SET
      ratings_count = 0,
      rating_total = 0,
      average_rating = NULL,
      last_reviewed_at = NULL
    WHERE id = v_file_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_soundvision_file_reviews_refresh_stats ON public.soundvision_file_reviews;
CREATE TRIGGER trg_soundvision_file_reviews_refresh_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.soundvision_file_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_soundvision_file_review_stats();
