-- New corporate-email audit rows retain a content fingerprint rather than the
-- full HTML body. The legacy body_html column stays additive/backward-compatible
-- while existing retention and deletion decisions are made.

ALTER TABLE public.corporate_email_logs
  ADD COLUMN IF NOT EXISTS body_hash text;

COMMENT ON COLUMN public.corporate_email_logs.body_hash IS
  'SHA-256 fingerprint of the sanitized email body; new sends do not persist body_html';

CREATE INDEX IF NOT EXISTS idx_corporate_email_logs_body_hash
  ON public.corporate_email_logs (body_hash)
  WHERE body_hash IS NOT NULL;

