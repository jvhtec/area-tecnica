-- FEST-SEC-01 hardening / roadmap Phase 1.6.
--
-- Public artist-form bearer tokens used to be minted whenever an artist was
-- marked as missing a rider. Delivery was not recorded, so legacy pending
-- rows cannot be proven to have reached an artist. Revoke that legacy set and
-- make token issuance an explicit operation called only by the send flow.

DROP TRIGGER IF EXISTS trg_ensure_artist_form_for_missing_rider
  ON public.festival_artists;

DROP FUNCTION IF EXISTS public.ensure_artist_form_for_missing_rider();

-- Repair the small class of rows where a submission exists but the form status
-- was not advanced, then revoke every remaining legacy pending credential.
UPDATE public.festival_artist_forms AS form
SET
  status = 'submitted'::public.form_status,
  updated_at = timezone('utc', now())
WHERE form.status = 'pending'::public.form_status
  AND EXISTS (
    SELECT 1
    FROM public.festival_artist_form_submissions AS submission
    WHERE submission.form_id = form.id
  );

UPDATE public.festival_artist_forms AS form
SET
  status = 'expired'::public.form_status,
  expires_at = LEAST(form.expires_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
WHERE form.status = 'pending'::public.form_status;

CREATE UNIQUE INDEX IF NOT EXISTS festival_artist_forms_one_pending_per_artist_idx
  ON public.festival_artist_forms (artist_id)
  WHERE status = 'pending'::public.form_status;

CREATE OR REPLACE FUNCTION public.get_or_create_festival_artist_form_for_send(
  p_artist_id uuid
)
RETURNS TABLE (
  form_id uuid,
  token uuid,
  expires_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_form public.festival_artist_forms%ROWTYPE;
BEGIN
  IF p_artist_id IS NULL THEN
    RAISE EXCEPTION 'artist id is required' USING ERRCODE = '22023';
  END IF;

  -- RLS on festival_artists keeps callers from issuing a token for an artist
  -- they cannot access.
  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_artists AS artist
    WHERE artist.id = p_artist_id
  ) THEN
    RAISE EXCEPTION 'artist not found or inaccessible' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.festival_artist_forms AS form
  SET
    status = 'expired'::public.form_status,
    updated_at = timezone('utc', now())
  WHERE form.artist_id = p_artist_id
    AND form.status = 'pending'::public.form_status
    AND form.expires_at <= timezone('utc', now());

  SELECT form.*
  INTO v_form
  FROM public.festival_artist_forms AS form
  WHERE form.artist_id = p_artist_id
    AND form.status = 'pending'::public.form_status
    AND form.expires_at > timezone('utc', now())
  ORDER BY form.created_at DESC NULLS LAST, form.id DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_form.id, v_form.token, v_form.expires_at, false;
    RETURN;
  END IF;

  INSERT INTO public.festival_artist_forms AS form (
    artist_id,
    status,
    expires_at
  )
  VALUES (
    p_artist_id,
    'pending'::public.form_status,
    timezone('utc', now()) + interval '7 days'
  )
  ON CONFLICT (artist_id) WHERE status = 'pending'::public.form_status
  DO NOTHING
  RETURNING form.* INTO v_form;

  IF NOT FOUND THEN
    SELECT form.*
    INTO STRICT v_form
    FROM public.festival_artist_forms AS form
    WHERE form.artist_id = p_artist_id
      AND form.status = 'pending'::public.form_status
      AND form.expires_at > timezone('utc', now())
    ORDER BY form.created_at DESC NULLS LAST, form.id DESC
    LIMIT 1;

    RETURN QUERY
    SELECT v_form.id, v_form.token, v_form.expires_at, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_form.id, v_form.token, v_form.expires_at, true;
END;
$function$;

COMMENT ON FUNCTION public.get_or_create_festival_artist_form_for_send(uuid) IS
  'Returns the artist active public-form token or creates one for an explicit send action. Subject to caller RLS.';

REVOKE ALL ON FUNCTION public.get_or_create_festival_artist_form_for_send(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_festival_artist_form_for_send(uuid)
  TO authenticated, service_role;
