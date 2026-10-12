-- Existing Flex quotes must not be visible to technicians.
UPDATE public.job_documents
SET visible_to_tech = false
WHERE file_path LIKE 'flex-reports/presupuestos/%'
  AND visible_to_tech IS DISTINCT FROM false;

CREATE OR REPLACE FUNCTION public.enforce_flex_quote_document_privacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.file_path LIKE 'flex-reports/presupuestos/%' THEN
    NEW.visible_to_tech := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_flex_quote_document_privacy ON public.job_documents;
CREATE TRIGGER enforce_flex_quote_document_privacy
BEFORE INSERT OR UPDATE ON public.job_documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_flex_quote_document_privacy();
