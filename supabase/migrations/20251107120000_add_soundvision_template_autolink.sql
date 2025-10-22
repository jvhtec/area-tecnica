-- Add read-only/template metadata to job documents
ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS read_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_type text;

-- Ensure only one template entry per job for a given template_type
CREATE UNIQUE INDEX IF NOT EXISTS job_documents_unique_template
  ON public.job_documents (job_id, template_type)
  WHERE template_type IS NOT NULL;

-- Helper function to normalize text for comparisons
CREATE OR REPLACE FUNCTION public.normalize_text_for_match(input text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE lower(regexp_replace(input, '[^a-z0-9]', '', 'g'))
  END;
$$;

-- Function to automatically attach SoundVision templates based on job location
CREATE OR REPLACE FUNCTION public.attach_soundvision_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loc RECORD;
  matching RECORD;
  existing RECORD;
  prefixed_path text;
BEGIN
  -- Remove template if location cleared
  IF NEW.location_id IS NULL THEN
    DELETE FROM public.job_documents
    WHERE job_id = NEW.id
      AND template_type = 'soundvision';
    RETURN NEW;
  END IF;

  SELECT * INTO loc
  FROM public.locations
  WHERE id = NEW.location_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 1. Match by Google Place ID
  IF loc.google_place_id IS NOT NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE v.google_place_id = loc.google_place_id
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- 2. Match by normalized address
  IF matching IS NULL AND loc.formatted_address IS NOT NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE normalize_text_for_match(v.full_address) = normalize_text_for_match(loc.formatted_address)
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- 3. Match by venue name + city/state inside formatted address
  IF matching IS NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE lower(v.name) = lower(loc.name)
      AND (
        (v.city IS NULL OR (loc.formatted_address IS NOT NULL AND loc.formatted_address ILIKE '%' || v.city || '%'))
      )
      AND (
        (v.state_region IS NULL OR (loc.formatted_address IS NOT NULL AND loc.formatted_address ILIKE '%' || v.state_region || '%'))
      )
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- No matching template found; ensure any stale template is removed
  IF matching IS NULL THEN
    DELETE FROM public.job_documents
    WHERE job_id = NEW.id
      AND template_type = 'soundvision';
    RETURN NEW;
  END IF;

  prefixed_path := 'soundvision-files/' || matching.file_path;

  -- Find existing template document for this job
  SELECT * INTO existing
  FROM public.job_documents
  WHERE job_id = NEW.id
    AND template_type = 'soundvision'
  LIMIT 1;

  IF existing IS NULL THEN
    INSERT INTO public.job_documents (
      job_id,
      file_name,
      file_path,
      file_size,
      file_type,
      uploaded_by,
      visible_to_tech,
      read_only,
      template_type,
      has_preview,
      original_type
    )
    VALUES (
      NEW.id,
      matching.file_name,
      prefixed_path,
      matching.file_size,
      matching.file_type,
      matching.uploaded_by,
      true,
      true,
      'soundvision',
      false,
      'soundvision-template'
    );
  ELSE
    IF existing.file_path <> prefixed_path OR NOT existing.read_only THEN
      UPDATE public.job_documents
      SET
        file_name = matching.file_name,
        file_path = prefixed_path,
        file_size = matching.file_size,
        file_type = matching.file_type,
        uploaded_at = now(),
        uploaded_by = matching.uploaded_by,
        visible_to_tech = true,
        read_only = true,
        template_type = 'soundvision',
        original_type = 'soundvision-template'
      WHERE id = existing.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_attach_soundvision ON public.jobs;
CREATE TRIGGER trg_jobs_attach_soundvision
AFTER INSERT OR UPDATE OF location_id ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.attach_soundvision_template();
