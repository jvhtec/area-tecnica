CREATE TABLE public.artist_external_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_artist_name text NOT NULL,
  display_artist_name text NOT NULL,
  wikidata_qid text,
  wikipedia_lang text,
  wikipedia_title text,
  wikipedia_url text,
  description text,
  extract text,
  thumbnail_url text,
  country text,
  genres text[] NOT NULL DEFAULT '{}',
  founded_or_birth_year text,
  official_website text,
  match_confidence numeric,
  match_status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'wikimedia',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_external_metadata_normalized_artist_name_key UNIQUE (normalized_artist_name),
  CONSTRAINT artist_external_metadata_match_status_check
    CHECK (match_status IN ('pending', 'matched', 'needs_review', 'no_match', 'manual')),
  CONSTRAINT artist_external_metadata_source_check
    CHECK (source IN ('wikimedia', 'manual')),
  CONSTRAINT artist_external_metadata_match_confidence_check
    CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1))
);

COMMENT ON TABLE public.artist_external_metadata IS
  'Cached public identity metadata (Wikidata/Wikipedia) resolved for artist names in the rider library, keyed by normalized name so it is shared across every job/festival that reuses the same artist.';

CREATE INDEX idx_artist_external_metadata_last_checked_at
  ON public.artist_external_metadata (last_checked_at);

CREATE TRIGGER set_artist_external_metadata_updated_at
  BEFORE UPDATE ON public.artist_external_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_external_metadata ENABLE ROW LEVEL SECURITY;

-- Writes only ever happen from the enrich-artist-metadata Edge Function using
-- the service role (which bypasses RLS), so the only policy needed here is a
-- read policy for the roles that can open the Rider Library.
CREATE POLICY "p_artist_external_metadata_select"
ON public.artist_external_metadata
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

REVOKE ALL ON public.artist_external_metadata FROM anon;
GRANT SELECT ON public.artist_external_metadata TO authenticated;
