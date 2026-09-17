-- A scheduled occurrence is complete only when every claimed recipient has a
-- terminal outcome. The worker can report aggregate success after at least one
-- recipient succeeds, so finish_push_schedule must also consult the durable
-- inbox before closing the occurrence. Pending/failed rows remain reclaimable
-- on the next lease; accepted/partial/skipped rows are terminal for that user.

CREATE OR REPLACE FUNCTION public.finish_push_schedule(
  p_event_type text,
  p_occurrence_key text,
  p_success boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH outcome AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.notification_inbox
      WHERE event_key = p_event_type || ':' || p_occurrence_key
        AND provider_status IN ('pending', 'failed')
    ) AS has_retryable_recipients
  )
  UPDATE public.push_schedule_claims AS claim
  SET status = CASE
        WHEN p_success AND NOT outcome.has_retryable_recipients THEN 'completed'
        ELSE 'retryable'
      END,
      lease_expires_at = now(),
      next_attempt_at = CASE
        WHEN p_success AND NOT outcome.has_retryable_recipients THEN NULL
        ELSE now() + interval '2 minutes'
      END,
      last_error = CASE
        WHEN p_success AND NOT outcome.has_retryable_recipients THEN NULL
        WHEN p_success AND outcome.has_retryable_recipients THEN 'recipient_delivery_incomplete'
        ELSE left(COALESCE(p_error, 'delivery_failed'), 500)
      END,
      updated_at = now()
  FROM outcome
  WHERE claim.event_type = p_event_type
    AND claim.occurrence_key = p_occurrence_key;
$$;

REVOKE ALL ON FUNCTION public.finish_push_schedule(text, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_schedule(text, text, boolean, text)
  TO service_role;
