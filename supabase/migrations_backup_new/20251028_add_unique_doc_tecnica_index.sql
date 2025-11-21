-- Ensure only one Documentación Técnica record per job/department
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'ux_flex_folders_job_dept_doc_tecnica'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_flex_folders_job_dept_doc_tecnica
             ON public.flex_folders (job_id, department)
             WHERE folder_type = ''doc_tecnica''';
  END IF;
END $$;

