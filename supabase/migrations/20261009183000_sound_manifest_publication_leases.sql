-- Per-pull-sheet leases prevent concurrent workers from publishing duplicate document rows.
CREATE TABLE IF NOT EXISTS public.sound_manifest_publication_leases (
  job_id uuid NOT NULL,
  sheet_id uuid NOT NULL,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (job_id, sheet_id)
);
ALTER TABLE public.sound_manifest_publication_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sound_manifest_publication_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sound_manifest_publication_leases TO service_role;

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
  RETURN claimed = p_token;
END;
$$;
CREATE OR REPLACE FUNCTION public.release_sound_manifest_slot(p_job_id uuid, p_sheet_id uuid, p_token uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  DELETE FROM public.sound_manifest_publication_leases
  WHERE job_id = p_job_id AND sheet_id = p_sheet_id AND token = p_token;
$$;
REVOKE ALL ON FUNCTION public.claim_sound_manifest_slot(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_sound_manifest_slot(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sound_manifest_slot(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sound_manifest_slot(uuid,uuid,uuid) TO service_role;
