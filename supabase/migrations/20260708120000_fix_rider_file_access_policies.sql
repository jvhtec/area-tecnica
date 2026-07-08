-- Align rider file metadata and storage access with the festival role contract:
-- house_tech can manage rider files end to end, while assigned technicians can
-- only read metadata and download/view storage objects for their assigned jobs.

DROP POLICY IF EXISTS "p_festival_artist_files_public_select_1fa3b3" ON public.festival_artist_files;
DROP POLICY IF EXISTS "p_festival_artist_files_public_insert_279f74" ON public.festival_artist_files;
DROP POLICY IF EXISTS "p_festival_artist_files_public_update_29eab2" ON public.festival_artist_files;
DROP POLICY IF EXISTS "p_festival_artist_files_public_delete_d213bb" ON public.festival_artist_files;

CREATE POLICY "p_festival_artist_files_public_select_1fa3b3"
ON public.festival_artist_files
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  OR (
    public.get_current_user_role() = 'technician'::text
    AND EXISTS (
      SELECT 1
      FROM public.festival_artists fa
      JOIN public.job_assignments ja ON ja.job_id = fa.job_id
      WHERE fa.id = festival_artist_files.artist_id
        AND ja.technician_id = auth.uid()
    )
  )
  OR public.is_admin_or_management()
);

CREATE POLICY "p_festival_artist_files_public_insert_279f74"
ON public.festival_artist_files
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

CREATE POLICY "p_festival_artist_files_public_update_29eab2"
ON public.festival_artist_files
FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
)
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

CREATE POLICY "p_festival_artist_files_public_delete_d213bb"
ON public.festival_artist_files
FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

DROP POLICY IF EXISTS "p_storage_festival_artist_files_authorized_select" ON storage.objects;
DROP POLICY IF EXISTS "p_storage_festival_artist_files_authorized_insert" ON storage.objects;
DROP POLICY IF EXISTS "p_storage_festival_artist_files_authorized_update" ON storage.objects;
DROP POLICY IF EXISTS "p_storage_festival_artist_files_authorized_delete" ON storage.objects;

CREATE POLICY "p_storage_festival_artist_files_authorized_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'festival_artist_files'
  AND (
    (
      public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
      AND (
        EXISTS (
          SELECT 1
          FROM public.festival_artists fa
          WHERE fa.id = CASE
            WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN split_part(storage.objects.name, '/', 1)::uuid
            ELSE NULL
          END
        )
        OR EXISTS (
          SELECT 1
          FROM public.festival_artist_files faf
          WHERE faf.file_path = storage.objects.name
        )
      )
    )
    OR (
      public.get_current_user_role() = 'technician'::text
      AND EXISTS (
        SELECT 1
        FROM public.festival_artist_files faf
        JOIN public.festival_artists fa ON fa.id = faf.artist_id
        JOIN public.job_assignments ja ON ja.job_id = fa.job_id
        WHERE faf.file_path = storage.objects.name
          AND ja.technician_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "p_storage_festival_artist_files_authorized_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'festival_artist_files'
  AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.festival_artists fa
    WHERE fa.id = CASE
      WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN split_part(storage.objects.name, '/', 1)::uuid
      ELSE NULL
    END
  )
);

CREATE POLICY "p_storage_festival_artist_files_authorized_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'festival_artist_files'
  AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.festival_artists fa
    WHERE fa.id = CASE
      WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN split_part(storage.objects.name, '/', 1)::uuid
      ELSE NULL
    END
  )
)
WITH CHECK (
  bucket_id = 'festival_artist_files'
  AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.festival_artists fa
    WHERE fa.id = CASE
      WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN split_part(storage.objects.name, '/', 1)::uuid
      ELSE NULL
    END
  )
);

CREATE POLICY "p_storage_festival_artist_files_authorized_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'festival_artist_files'
  AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
  AND NOT EXISTS (
    SELECT 1
    FROM public.festival_artist_files faf
    WHERE faf.file_path = storage.objects.name
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.festival_artists fa
      WHERE fa.id = CASE
        WHEN split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          THEN split_part(storage.objects.name, '/', 1)::uuid
        ELSE NULL
      END
    )
  )
);

CREATE OR REPLACE FUNCTION public.delete_festival_artist_file_reference(
  p_file_id uuid,
  p_artist_id uuid DEFAULT NULL
)
RETURNS TABLE (
  deleted_file_id uuid,
  file_path text,
  should_delete_storage boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_file public.festival_artist_files%ROWTYPE;
  v_remaining_references integer;
BEGIN
  v_role := public.get_current_user_role();
  IF auth.role() <> 'service_role'
    AND (v_role IS NULL OR v_role <> ALL (ARRAY['admin', 'management', 'logistics', 'house_tech'])) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_file_id IS NULL THEN
    RAISE EXCEPTION 'missing_required_argument'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_file
  FROM public.festival_artist_files
  WHERE id = p_file_id
    AND (p_artist_id IS NULL OR artist_id = p_artist_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'file_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_file.file_path, 0));

  DELETE FROM public.festival_artist_files
  WHERE id = v_file.id;

  SELECT count(*)::integer
  INTO v_remaining_references
  FROM public.festival_artist_files remaining_file
  WHERE remaining_file.file_path = v_file.file_path;

  RETURN QUERY
  SELECT v_file.id, v_file.file_path, v_remaining_references = 0;
END;
$$;

COMMENT ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) IS
  'Deletes one rider file metadata reference and reports whether the shared storage object has no remaining references.';

REVOKE ALL ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) TO authenticated, service_role;
