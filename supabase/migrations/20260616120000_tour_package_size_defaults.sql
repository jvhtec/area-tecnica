-- Tour package size defaults and per-date package intent.
-- This is intentionally additive: existing tour dates, default sets, tables,
-- and overrides remain valid.

ALTER TABLE public.tour_default_sets
  ADD COLUMN IF NOT EXISTS package_size text;

ALTER TABLE public.tour_dates
  ADD COLUMN IF NOT EXISTS sound_package_size text,
  ADD COLUMN IF NOT EXISTS lights_package_size text,
  ADD COLUMN IF NOT EXISTS video_package_size text,
  ADD COLUMN IF NOT EXISTS sound_default_set_id uuid,
  ADD COLUMN IF NOT EXISTS lights_default_set_id uuid,
  ADD COLUMN IF NOT EXISTS video_default_set_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_default_sets_package_size_check'
  ) THEN
    ALTER TABLE public.tour_default_sets
      ADD CONSTRAINT tour_default_sets_package_size_check
      CHECK (package_size IS NULL OR package_size = ANY (ARRAY['xl'::text, 'l'::text, 'm'::text, 's'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_sound_package_size_check'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_sound_package_size_check
      CHECK (sound_package_size IS NULL OR sound_package_size = ANY (ARRAY['xl'::text, 'l'::text, 'm'::text, 's'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_lights_package_size_check'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_lights_package_size_check
      CHECK (lights_package_size IS NULL OR lights_package_size = ANY (ARRAY['xl'::text, 'l'::text, 'm'::text, 's'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_video_package_size_check'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_video_package_size_check
      CHECK (video_package_size IS NULL OR video_package_size = ANY (ARRAY['xl'::text, 'l'::text, 'm'::text, 's'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_sound_default_set_id_fkey'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_sound_default_set_id_fkey
      FOREIGN KEY (sound_default_set_id)
      REFERENCES public.tour_default_sets(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_lights_default_set_id_fkey'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_lights_default_set_id_fkey
      FOREIGN KEY (lights_default_set_id)
      REFERENCES public.tour_default_sets(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tour_dates_video_default_set_id_fkey'
  ) THEN
    ALTER TABLE public.tour_dates
      ADD CONSTRAINT tour_dates_video_default_set_id_fkey
      FOREIGN KEY (video_default_set_id)
      REFERENCES public.tour_default_sets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_default_sets_tour_department_package
  ON public.tour_default_sets (tour_id, department, package_size);

CREATE INDEX IF NOT EXISTS idx_tour_dates_sound_default_set_id
  ON public.tour_dates (sound_default_set_id)
  WHERE sound_default_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_dates_lights_default_set_id
  ON public.tour_dates (lights_default_set_id)
  WHERE lights_default_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_dates_video_default_set_id
  ON public.tour_dates (video_default_set_id)
  WHERE video_default_set_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_tour_date_default_set_pin(
  p_default_set_id uuid,
  p_tour_id uuid,
  p_department text,
  p_package_size text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set record;
BEGIN
  IF p_default_set_id IS NULL THEN
    RETURN;
  END IF;

  SELECT tour_id, department, package_size
    INTO v_set
  FROM public.tour_default_sets
  WHERE id = p_default_set_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour default set % does not exist', p_default_set_id
      USING ERRCODE = '23503';
  END IF;

  IF v_set.tour_id IS DISTINCT FROM p_tour_id THEN
    RAISE EXCEPTION 'Tour default set % belongs to a different tour', p_default_set_id
      USING ERRCODE = '23514';
  END IF;

  IF v_set.department IS DISTINCT FROM p_department THEN
    RAISE EXCEPTION 'Tour default set % belongs to department %, expected %',
      p_default_set_id, v_set.department, p_department
      USING ERRCODE = '23514';
  END IF;

  IF p_package_size IS NOT NULL
    AND v_set.package_size IS NOT NULL
    AND v_set.package_size IS DISTINCT FROM p_package_size
  THEN
    RAISE EXCEPTION 'Tour default set % package size % does not match selected package size %',
      p_default_set_id, v_set.package_size, p_package_size
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tour_date_default_set_pins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.validate_tour_date_default_set_pin(
    NEW.sound_default_set_id,
    NEW.tour_id,
    'sound',
    NEW.sound_package_size
  );

  PERFORM public.validate_tour_date_default_set_pin(
    NEW.lights_default_set_id,
    NEW.tour_id,
    'lights',
    NEW.lights_package_size
  );

  PERFORM public.validate_tour_date_default_set_pin(
    NEW.video_default_set_id,
    NEW.tour_id,
    'video',
    NEW.video_package_size
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_tour_date_default_set_pins
  BEFORE INSERT OR UPDATE OF
    tour_id,
    sound_package_size,
    lights_package_size,
    video_package_size,
    sound_default_set_id,
    lights_default_set_id,
    video_default_set_id
  ON public.tour_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tour_date_default_set_pins();

UPDATE public.tour_default_sets
SET package_size = 's'
WHERE package_size IS NULL
  AND (
    lower(coalesce(name, '') || ' ' || coalesce(description, '')) LIKE '%tour pack%'
    OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) LIKE '%tourpack%'
    OR lower(coalesce(name, '') || ' ' || coalesce(description, '')) LIKE '%pack s%'
    OR coalesce(name, '') ~ '(^|[^[:alnum:]])[sS]([^[:alnum:]]|$)'
    OR coalesce(description, '') ~ '(^|[^[:alnum:]])[sS]([^[:alnum:]]|$)'
  );

UPDATE public.tour_dates
SET
  sound_package_size = coalesce(sound_package_size, 's'),
  lights_package_size = coalesce(lights_package_size, 's'),
  video_package_size = coalesce(video_package_size, 's')
WHERE is_tour_pack_only IS TRUE;

WITH unique_s_sets AS (
  SELECT tour_id, department, min(id) AS default_set_id, count(*) AS match_count
  FROM public.tour_default_sets
  WHERE package_size = 's'
    AND department = ANY (ARRAY['sound'::text, 'lights'::text, 'video'::text])
  GROUP BY tour_id, department
  HAVING count(*) = 1
)
UPDATE public.tour_dates td
SET sound_default_set_id = unique_s_sets.default_set_id
FROM unique_s_sets
WHERE td.is_tour_pack_only IS TRUE
  AND td.sound_default_set_id IS NULL
  AND td.tour_id = unique_s_sets.tour_id
  AND unique_s_sets.department = 'sound';

WITH unique_s_sets AS (
  SELECT tour_id, department, min(id) AS default_set_id, count(*) AS match_count
  FROM public.tour_default_sets
  WHERE package_size = 's'
    AND department = ANY (ARRAY['sound'::text, 'lights'::text, 'video'::text])
  GROUP BY tour_id, department
  HAVING count(*) = 1
)
UPDATE public.tour_dates td
SET lights_default_set_id = unique_s_sets.default_set_id
FROM unique_s_sets
WHERE td.is_tour_pack_only IS TRUE
  AND td.lights_default_set_id IS NULL
  AND td.tour_id = unique_s_sets.tour_id
  AND unique_s_sets.department = 'lights';

WITH unique_s_sets AS (
  SELECT tour_id, department, min(id) AS default_set_id, count(*) AS match_count
  FROM public.tour_default_sets
  WHERE package_size = 's'
    AND department = ANY (ARRAY['sound'::text, 'lights'::text, 'video'::text])
  GROUP BY tour_id, department
  HAVING count(*) = 1
)
UPDATE public.tour_dates td
SET video_default_set_id = unique_s_sets.default_set_id
FROM unique_s_sets
WHERE td.is_tour_pack_only IS TRUE
  AND td.video_default_set_id IS NULL
  AND td.tour_id = unique_s_sets.tour_id
  AND unique_s_sets.department = 'video';

COMMENT ON COLUMN public.tour_default_sets.package_size IS
  'Optional tour package size for this default set: xl, l, m, or s. Null keeps legacy/unassigned default sets valid.';

COMMENT ON COLUMN public.tour_dates.sound_package_size IS
  'Sound package size intent for this tour date. Legacy is_tour_pack_only dates are treated as sound S when null.';
COMMENT ON COLUMN public.tour_dates.lights_package_size IS
  'Lights package size intent for this tour date. Legacy is_tour_pack_only dates are treated as lights S when null.';
COMMENT ON COLUMN public.tour_dates.video_package_size IS
  'Video package size intent for this tour date. Legacy is_tour_pack_only dates are treated as video S when null.';

COMMENT ON COLUMN public.tour_dates.sound_default_set_id IS
  'Optional explicit sound default set pin for package resolution.';
COMMENT ON COLUMN public.tour_dates.lights_default_set_id IS
  'Optional explicit lights default set pin for package resolution.';
COMMENT ON COLUMN public.tour_dates.video_default_set_id IS
  'Optional explicit video default set pin for package resolution.';
