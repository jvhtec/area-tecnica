-- A scheduled occurrence is complete only when both the worker reports success
-- and every durable inbox item for that occurrence is terminal. This keeps the
-- scheduler lease state aligned with per-recipient delivery state: one accepted
-- recipient must not hide another recipient that is still pending or failed.
CREATE OR REPLACE FUNCTION public.finish_push_schedule(
  p_event_type text,
  p_occurrence_key text,
  p_success boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_retryable_recipient boolean := false;
  v_effective_success boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_inbox
    WHERE event_key = p_event_type || ':' || p_occurrence_key
      AND provider_status IN ('pending', 'failed')
  )
  INTO v_has_retryable_recipient;

  v_effective_success := p_success AND NOT v_has_retryable_recipient;

  UPDATE public.push_schedule_claims
  SET status = CASE WHEN v_effective_success THEN 'completed' ELSE 'retryable' END,
      lease_expires_at = now(),
      next_attempt_at = CASE WHEN v_effective_success THEN NULL ELSE now() + interval '2 minutes' END,
      last_error = CASE
        WHEN v_effective_success THEN NULL
        WHEN v_has_retryable_recipient THEN left(COALESCE(p_error, 'recipient_delivery_failed'), 500)
        ELSE left(COALESCE(p_error, 'delivery_failed'), 500)
      END,
      updated_at = now()
  WHERE event_type = p_event_type
    AND occurrence_key = p_occurrence_key;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_push_schedule(text, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_schedule(text, text, boolean, text)
  TO service_role;
