-- Follow-up to 20260928120000_scope_festival_workspace_reads.sql.
--
-- 1. festival_artists and festival_artist_files use the same technician rule
--    as the rest of the festival workspace (public.can_read_festival_job):
--    declined technicians lose access, and crew who are only on a festival
--    shift (no job_assignments row) can see the artists they work with.
--    Office roles and house techs keep unconditional read, which preserves
--    rows whose job has been deleted (job_id IS NULL).
--
-- 2. Production carries seven storage policies that no migration defines
--    (DB-06 drift). Three of them defeat the scoped policies below:
--      * "riders_bucket_read_all"  - SELECT TO public on the private rider
--        bucket: anyone with the anon key can read every rider file.
--      * "Enable upload/delete access for authenticated users" - any signed-in
--        user can write or delete any rider file.
--      * "Authenticated users can upload festival logos", "Users can update
--        own festival logos", "Users can delete own festival logos" - any
--        signed-in user can overwrite or delete any logo (none check owner).
--    They are dropped. The public artist form now reads its own riders
--    through the token-validated `sign` action of upload-public-artist-rider.
--
-- 3. "Anyone can view festival logos" is kept on purpose and now defined here:
--    the public artist form (anonymous) and many PDFs render job logos, and a
--    logo is not confidential.
--
-- 4. Logo uploads were limited to festival/ciclo jobs in the scoped policies,
--    and single jobs only worked through the permissive drift policies. The
--    workspace serves every job type, so the scoped logo policies now accept
--    any existing job, and a scoped DELETE policy replaces the dropped one.

-- ---------------------------------------------------------------------------
-- 1. Artist and rider metadata
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "p_festival_artists_public_select_598f77"
  ON public.festival_artists;
CREATE POLICY "p_festival_artists_public_select_598f77"
  ON public.festival_artists
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    OR public.can_read_festival_job(job_id)
  );

DROP POLICY IF EXISTS "p_festival_artist_files_public_select_1fa3b3"
  ON public.festival_artist_files;
CREATE POLICY "p_festival_artist_files_public_select_1fa3b3"
  ON public.festival_artist_files
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    OR EXISTS (
      SELECT 1
      FROM public.festival_artists fa
      WHERE fa.id = festival_artist_files.artist_id
        AND public.can_read_festival_job(fa.job_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Rider storage bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "riders_bucket_read_all" ON storage.objects;
DROP POLICY IF EXISTS "Enable upload access for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON storage.objects;

-- Objects are stored under "<artist id>/...": uploaded riders (also listed in
-- festival_artist_files) and stage plots (referenced from festival_artists).
DROP POLICY IF EXISTS "p_storage_festival_artist_files_authorized_select" ON storage.objects;
CREATE POLICY "p_storage_festival_artist_files_authorized_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'festival_artist_files'
    AND (
      EXISTS (
        SELECT 1
        FROM public.festival_artists fa
        WHERE fa.id = CASE
          WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN split_part(storage.objects.name, '/', 1)::uuid
          ELSE NULL
        END
          AND (
            public.get_current_user_role() = ANY (
              ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
            )
            OR public.can_read_festival_job(fa.job_id)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.festival_artist_files faf
        JOIN public.festival_artists fa ON fa.id = faf.artist_id
        WHERE faf.file_path = storage.objects.name
          AND (
            public.get_current_user_role() = ANY (
              ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
            )
            OR public.can_read_festival_job(fa.job_id)
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3 + 4. Logo storage bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can upload festival logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own festival logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own festival logos" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view festival logos" ON storage.objects;
CREATE POLICY "Anyone can view festival logos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'festival-logos');

COMMENT ON POLICY "Anyone can view festival logos" ON storage.objects IS
  'Intentional public read: job logos are rendered by the anonymous artist form and in exported documents, and are not confidential.';

-- Logos are stored as "<job id>.<ext>" (FestivalLogoManager).
DROP POLICY IF EXISTS "p_storage_festival_logos_authorized_insert" ON storage.objects;
CREATE POLICY "p_storage_festival_logos_authorized_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'festival-logos'
    AND public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = CASE
        WHEN storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
          THEN split_part(storage.objects.name, '.', 1)::uuid
        ELSE NULL
      END
    )
  );

DROP POLICY IF EXISTS "p_storage_festival_logos_authorized_update" ON storage.objects;
CREATE POLICY "p_storage_festival_logos_authorized_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'festival-logos'
    AND public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = CASE
        WHEN storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
          THEN split_part(storage.objects.name, '.', 1)::uuid
        ELSE NULL
      END
    )
  )
  WITH CHECK (
    bucket_id = 'festival-logos'
    AND public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = CASE
        WHEN storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
          THEN split_part(storage.objects.name, '.', 1)::uuid
        ELSE NULL
      END
    )
  );

-- A logo whose job was deleted can still be cleaned up, so DELETE checks the
-- role and the path shape only.
DROP POLICY IF EXISTS "p_storage_festival_logos_authorized_delete" ON storage.objects;
CREATE POLICY "p_storage_festival_logos_authorized_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'festival-logos'
    AND public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    AND storage.objects.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9]+$'
  );
