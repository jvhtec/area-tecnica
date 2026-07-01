CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(5);

-- The festival management quick action self-attributes uploads; the insert
-- policy must keep accepting rows where uploaded_by = auth.uid() so house
-- techs (not in the privileged role list) can upload job documents.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_documents'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%uploaded_by%'
  ),
  'job document metadata inserts accept self-attributed uploads'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_job_documents_authorized_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%job-documents%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%jobs%'
  ),
  'house techs may view job document storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_job_documents_authorized_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%job-documents%'
      AND with_check ILIKE '%admin%'
      AND with_check ILIKE '%management%'
      AND with_check ILIKE '%logistics%'
      AND with_check ILIKE '%house_tech%'
      AND with_check ILIKE '%jobs%'
  ),
  'house techs may upload job document storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_job_documents_authorized_update'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%job-documents%'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%job-documents%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may update job document storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_job_documents_authorized_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%job-documents%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%jobs%'
  ),
  'house techs may remove job document storage objects'
);

SELECT * FROM finish();
