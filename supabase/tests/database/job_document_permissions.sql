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
      AND qual ILIKE '%can_read_job_document_storage%'
  )
  AND pg_get_functiondef('public.can_read_job_document_storage(text)'::regprocedure)
      ILIKE '%house_tech%',
  'house techs may view job document storage objects through the scoped authorization helper'
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
      AND with_check ILIKE '%can_write_job_document_storage%'
  ),
  'house techs may upload job document storage objects through the scoped authorization helper'
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
      AND qual ILIKE '%can_write_job_document_storage%'
      AND with_check ILIKE '%job-documents%'
      AND with_check ILIKE '%house_tech%'
      AND with_check ILIKE '%can_write_job_document_storage%'
  ),
  'house techs may update job document storage objects through the scoped authorization helper'
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
      AND qual ILIKE '%can_delete_job_document_storage%'
  )
  AND pg_get_functiondef('public.can_delete_job_document_storage(text)'::regprocedure)
      ILIKE '%house_tech%',
  'house techs may remove job document storage objects through the scoped authorization helper'
);

SELECT * FROM finish();
