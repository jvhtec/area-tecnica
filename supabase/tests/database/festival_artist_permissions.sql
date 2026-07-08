CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(21);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND policyname IN (
        'p_festival_artists_public_delete_8f2ede',
        'p_festival_artists_public_insert_d3bb11',
        'p_festival_artists_public_update_4616fe'
      )
  ),
  3,
  'festival_artists keeps the expected mutation policies'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%logistics%'
  ),
  'festival_artists mutation policies do not allow logistics'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may insert festival artists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may update festival artists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'DELETE'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual NOT ILIKE '%house_tech%'
      AND qual NOT ILIKE '%logistics%'
  ),
  'festival artist deletes remain management-only'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artists'
      AND cmd = 'SELECT'
      AND qual ILIKE '%house_tech%'
  ),
  'house techs retain festival artist read access'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_files'
      AND policyname = 'p_festival_artist_files_public_select_1fa3b3'
      AND cmd = 'SELECT'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%job_assignments%'
      AND qual ILIKE '%auth.uid%'
      AND qual ILIKE '%''technician''%'
      AND qual NOT ILIKE '%OR true%'
  ),
  'festival artist file metadata reads are scoped to elevated roles or assigned technicians'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_files'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may insert festival artist file metadata'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_files'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%house_tech%'
      AND qual NOT ILIKE '%''technician''%'
      AND with_check NOT ILIKE '%''technician''%'
  ),
  'house techs may update festival artist file metadata while technicians cannot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_artist_files'
      AND cmd = 'DELETE'
      AND qual ILIKE '%house_tech%'
      AND qual NOT ILIKE '%''technician''%'
  ),
  'house techs may delete festival artist file metadata while technicians cannot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'delete_festival_artist_file_reference'
      AND pg_get_function_identity_arguments(p.oid) = 'p_file_id uuid, p_artist_id uuid'
      AND pg_get_functiondef(p.oid) ILIKE '%house_tech%'
      AND pg_get_functiondef(p.oid) NOT ILIKE '%''technician''%'
  ),
  'rider file delete RPC allows house techs but not technicians'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_logos'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may insert festival logo metadata'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'festival_logos'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may update festival logo metadata'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_artist_files_authorized_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%festival_artist_files%'
      AND qual ILIKE '%file_path%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%job_assignments%'
      AND qual ILIKE '%auth.uid%'
      AND qual ILIKE '%''technician''%'
      AND qual ILIKE '%festival_artists%'
  ),
  'house techs and assigned technicians may view festival artist file storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_artist_files_authorized_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%festival_artist_files%'
      AND with_check ILIKE '%admin%'
      AND with_check ILIKE '%management%'
      AND with_check ILIKE '%logistics%'
      AND with_check ILIKE '%house_tech%'
      AND with_check ILIKE '%festival_artists%'
      AND with_check NOT ILIKE '%''technician''%'
  ),
  'house techs may upload festival artist file storage objects while technicians cannot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_artist_files_authorized_update'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%festival_artist_files%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%festival_artist_files%'
      AND with_check ILIKE '%admin%'
      AND with_check ILIKE '%management%'
      AND with_check ILIKE '%logistics%'
      AND with_check ILIKE '%house_tech%'
      AND qual NOT ILIKE '%''technician''%'
      AND with_check NOT ILIKE '%''technician''%'
  ),
  'house techs may upsert festival artist file storage objects while technicians cannot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_artist_files_authorized_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%festival_artist_files%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%festival_artists%'
      AND qual ILIKE '%NOT EXISTS%'
      AND qual NOT ILIKE '%''technician''%'
  ),
  'house techs may delete festival artist file storage objects while technicians cannot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_logos_authorized_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%festival-logos%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND qual ILIKE '%festival%'
      AND qual ILIKE '%ciclo%'
  ),
  'house techs may view festival logo storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_logos_authorized_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%festival-logos%'
      AND with_check ILIKE '%admin%'
      AND with_check ILIKE '%management%'
      AND with_check ILIKE '%logistics%'
      AND with_check ILIKE '%house_tech%'
      AND with_check ILIKE '%festival%'
      AND with_check ILIKE '%ciclo%'
  ),
  'house techs may upload festival logo storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'p_storage_festival_logos_authorized_update'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%festival-logos%'
      AND qual ILIKE '%admin%'
      AND qual ILIKE '%management%'
      AND qual ILIKE '%logistics%'
      AND qual ILIKE '%house_tech%'
      AND with_check ILIKE '%festival-logos%'
      AND with_check ILIKE '%admin%'
      AND with_check ILIKE '%management%'
      AND with_check ILIKE '%logistics%'
      AND with_check ILIKE '%house_tech%'
  ),
  'house techs may upsert festival logo storage objects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id IN ('festival_artist_files', 'festival-logos')
    HAVING count(*) = 2
  ),
  'festival upload buckets are declared by migrations'
);

SELECT * FROM finish();
