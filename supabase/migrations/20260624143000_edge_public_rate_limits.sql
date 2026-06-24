-- ---------------------------------------------------------------------------
-- Phase 2: durable abuse controls for public/tokenized Edge Functions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edge_rate_limit_counters (
  scope text NOT NULL,
  identifier_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_rate_limit_counters_pkey
    PRIMARY KEY (scope, identifier_hash, window_start, window_seconds),
  CONSTRAINT edge_rate_limit_counters_scope_check
    CHECK (scope ~ '^[a-z0-9._:-]{1,80}$'),
  CONSTRAINT edge_rate_limit_counters_identifier_hash_check
    CHECK (identifier_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT edge_rate_limit_counters_window_seconds_check
    CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT edge_rate_limit_counters_request_count_check
    CHECK (request_count >= 0)
);

COMMENT ON TABLE public.edge_rate_limit_counters IS
  'Durable, service-role-only counters for public/tokenized Edge Function rate limits. identifier_hash is a one-way SHA-256 bucket; never store raw IPs, tokens, emails, or secrets here.';
COMMENT ON COLUMN public.edge_rate_limit_counters.scope IS
  'Reviewed Edge Function or endpoint scope, e.g. submit-public-artist-form.';
COMMENT ON COLUMN public.edge_rate_limit_counters.identifier_hash IS
  'SHA-256 hash of the rate-limit bucket material generated in the Edge Function.';

CREATE INDEX IF NOT EXISTS edge_rate_limit_counters_cleanup_idx
ON public.edge_rate_limit_counters (window_start);

ALTER TABLE public.edge_rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.edge_rate_limit_counters TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'edge_rate_limit_counters'
      AND policyname = 'edge_rate_limit_counters_service_role_all'
  ) THEN
    CREATE POLICY edge_rate_limit_counters_service_role_all
    ON public.edge_rate_limit_counters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_scope text := lower(trim(p_scope));
  v_identifier_hash text := lower(trim(p_identifier_hash));
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_scope IS NULL
     OR v_scope !~ '^[a-z0-9._:-]{1,80}$'
     OR v_identifier_hash IS NULL
     OR v_identifier_hash !~ '^[a-f0-9]{64}$'
     OR p_window_seconds IS NULL
     OR p_window_seconds < 1
     OR p_window_seconds > 86400
     OR p_max_requests IS NULL
     OR p_max_requests < 1 THEN
    RAISE EXCEPTION 'Invalid edge rate limit request';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_scope || ':' || v_identifier_hash || ':' || v_window_start::text || ':' || p_window_seconds::text, 0)
  );

  INSERT INTO public.edge_rate_limit_counters (
    scope,
    identifier_hash,
    window_start,
    window_seconds,
    request_count,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    v_scope,
    v_identifier_hash,
    v_window_start,
    p_window_seconds,
    1,
    v_now,
    v_now
  )
  ON CONFLICT (scope, identifier_hash, window_start, window_seconds)
  DO UPDATE SET
    request_count = public.edge_rate_limit_counters.request_count + 1,
    last_seen_at = EXCLUDED.last_seen_at
  RETURNING request_count INTO v_count;

  -- Best-effort retention: keep rate-limit counters bounded without adding a
  -- separate scheduled task. This is deliberately probabilistic to avoid
  -- turning every public request into a cleanup scan.
  IF random() < 0.005 THEN
    DELETE FROM public.edge_rate_limit_counters
    WHERE window_start < v_now - interval '7 days';
  END IF;

  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  allowed := v_count <= p_max_requests;
  remaining := greatest(p_max_requests - v_count, 0);
  retry_after_seconds := CASE
    WHEN allowed THEN 0
    ELSE greatest(1, ceil(extract(epoch from (reset_at - v_now)))::integer)
  END;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer) IS
  'Atomically consumes one durable rate-limit unit for a public Edge Function bucket. Callable only by service_role; identifier_hash must already be SHA-256 hashed by the Edge Function.';

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer)
TO service_role;
