-- Fix attach_soundvision_template function to use NULL for original_type instead of 'soundvision-template'
-- This fixes the job_documents_original_type_check constraint violation

-- First, update any existing template documents that have invalid original_type values
UPDATE public.job_documents
SET original_type = NULL
WHERE template_type = 'soundvision'
  AND original_type NOT IN ('pdf', 'dwg', 'dxf')
  AND original_type IS NOT NULL;

-- Drop and recreate the function with the corrected original_type value
DROP FUNCTION IF EXISTS public.attach_soundvision_template() CASCADE;

CREATE OR REPLACE FUNCTION public.attach_soundvision_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      NULL
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
        original_type = NULL
      WHERE id = existing.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_attach_soundvision_template ON public.jobs;
CREATE TRIGGER trg_attach_soundvision_template
  AFTER INSERT OR UPDATE OF location_id ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.attach_soundvision_template();