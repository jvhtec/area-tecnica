-- Denied lease claims must return false rather than SQL NULL.
CREATE OR REPLACE FUNCTION public.claim_sound_manifest_slot(p_job_id uuid, p_sheet_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE claimed uuid;
BEGIN
  INSERT INTO public.sound_manifest_publication_leases(job_id, sheet_id, token, expires_at)
  VALUES (p_job_id, p_sheet_id, p_token, now() + interval '10 minutes')
  ON CONFLICT (job_id, sheet_id) DO UPDATE
    SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
    WHERE public.sound_manifest_publication_leases.expires_at < now()
  RETURNING token INTO claimed;
  RETURN COALESCE(claimed = p_token, false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_sound_manifest_slot(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sound_manifest_slot(uuid,uuid,uuid) TO service_role;

-- Preserve one document row per immutable object even if a worker outlives its lease.
-- Removing duplicate metadata never removes the shared storage object.
WITH duplicates AS (
  SELECT id, row_number() OVER (
    PARTITION BY job_id, file_path ORDER BY uploaded_at DESC, id
  ) AS position
  FROM public.job_documents
  WHERE file_path LIKE 'flex-reports/sound-manifests/%'
)
DELETE FROM public.job_documents WHERE id IN (
  SELECT id FROM duplicates WHERE position > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS job_documents_sound_manifest_path_unique
ON public.job_documents(job_id, file_path)
WHERE file_path LIKE 'flex-reports/sound-manifests/%';
