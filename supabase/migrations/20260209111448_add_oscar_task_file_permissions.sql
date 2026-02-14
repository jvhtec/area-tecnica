-- Allow the Oscar role to upload/download/manage files associated with tasks.
-- This includes:
--   1) Task attachment files in `task_documents` storage bucket.
--   2) Mirrored task files in `job_documents` / `tour-documents` buckets.
--   3) Corresponding rows in `public.job_documents` / `public.tour_documents`
--      when the file path follows the task-mirror convention.

-- -----------------------------------------------------------------------------
-- public.job_documents: Oscar can manage only task-mirrored document rows.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_job_documents_oscar_task_select" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_select"
ON public.job_documents
FOR SELECT
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_job_documents_oscar_task_insert" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_insert"
ON public.job_documents
FOR INSERT
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_job_documents_oscar_task_update" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_update"
ON public.job_documents
FOR UPDATE
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
)
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_job_documents_oscar_task_delete" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_delete"
ON public.job_documents
FOR DELETE
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

-- -----------------------------------------------------------------------------
-- public.tour_documents: Oscar can manage only task-mirrored schedule rows.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_tour_documents_oscar_task_select" ON public.tour_documents;
CREATE POLICY "p_tour_documents_oscar_task_select"
ON public.tour_documents
FOR SELECT
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_tour_documents_oscar_task_insert" ON public.tour_documents;
CREATE POLICY "p_tour_documents_oscar_task_insert"
ON public.tour_documents
FOR INSERT
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_tour_documents_oscar_task_update" ON public.tour_documents;
CREATE POLICY "p_tour_documents_oscar_task_update"
ON public.tour_documents
FOR UPDATE
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^schedules/[^/]+/task-[^/]+/.+'
)
WITH CHECK (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_tour_documents_oscar_task_delete" ON public.tour_documents;
CREATE POLICY "p_tour_documents_oscar_task_delete"
ON public.tour_documents
FOR DELETE
USING (
  public.current_user_role() = 'oscar'
  AND file_path ~ '^schedules/[^/]+/task-[^/]+/.+'
);

-- -----------------------------------------------------------------------------
-- storage.objects: Oscar access for task-associated files.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_storage_task_documents_oscar_select" ON storage.objects;
CREATE POLICY "p_storage_task_documents_oscar_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task_documents'
  AND public.current_user_role() = 'oscar'
);

DROP POLICY IF EXISTS "p_storage_task_documents_oscar_insert" ON storage.objects;
CREATE POLICY "p_storage_task_documents_oscar_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task_documents'
  AND public.current_user_role() = 'oscar'
);

DROP POLICY IF EXISTS "p_storage_task_documents_oscar_update" ON storage.objects;
CREATE POLICY "p_storage_task_documents_oscar_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task_documents'
  AND public.current_user_role() = 'oscar'
)
WITH CHECK (
  bucket_id = 'task_documents'
  AND public.current_user_role() = 'oscar'
);

DROP POLICY IF EXISTS "p_storage_task_documents_oscar_delete" ON storage.objects;
CREATE POLICY "p_storage_task_documents_oscar_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task_documents'
  AND public.current_user_role() = 'oscar'
);

DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_select" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_insert" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_update" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job_documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
)
WITH CHECK (
  bucket_id = 'job_documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_delete" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job_documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^(sound|lights|video)/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_tour_documents_oscar_task_select" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_oscar_task_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tour-documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_tour_documents_oscar_task_insert" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_oscar_task_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tour-documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_tour_documents_oscar_task_update" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_oscar_task_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tour-documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^schedules/[^/]+/task-[^/]+/.+'
)
WITH CHECK (
  bucket_id = 'tour-documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^schedules/[^/]+/task-[^/]+/.+'
);

DROP POLICY IF EXISTS "p_storage_tour_documents_oscar_task_delete" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_oscar_task_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tour-documents'
  AND public.current_user_role() = 'oscar'
  AND name ~ '^schedules/[^/]+/task-[^/]+/.+'
);;
