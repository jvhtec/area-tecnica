-- Separate pre-auth security telemetry from identified audit records and keep
-- it for a deliberately short period. Only the service role can access it.

CREATE TABLE IF NOT EXISTS public.anonymous_security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('auth_login', 'password_reset_request')),
  resource text NOT NULL CHECK (resource = 'authentication'),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anonymous_security_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.anonymous_security_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.anonymous_security_audit_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_anonymous_security_audit_log_created_at
  ON public.anonymous_security_audit_log (created_at);

CREATE OR REPLACE FUNCTION public.cleanup_anonymous_security_audit_log()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.anonymous_security_audit_log
  WHERE created_at < now() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_anonymous_security_audit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_anonymous_security_audit_log() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-security-audit-log') THEN
      PERFORM cron.schedule(
        'cleanup-anonymous-security-audit-log',
        '23 3 * * *',
        'SELECT public.cleanup_anonymous_security_audit_log();'
      );
    END IF;
  END IF;
END;
$$;

