-- Dry-hire jobs are equipment-only work and cannot carry producer ownership.
-- Remove historical rows before installing the invariant that prevents them.
DELETE FROM public.job_producer_claims AS claim
USING public.jobs AS job
WHERE job.id = claim.job_id
  AND job.job_type = 'dryhire'::public.job_type;

CREATE OR REPLACE FUNCTION public.enforce_job_producer_claim_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  producer_department text;
  claimed_job_type public.job_type;
BEGIN
  -- FOR NO KEY UPDATE conflicts with the lock taken by an UPDATE that changes
  -- jobs.job_type, so a claim insert and a dry-hire conversion serialize.
  SELECT job.job_type
  INTO claimed_job_type
  FROM public.jobs AS job
  WHERE job.id = NEW.job_id
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job producer claim references an unknown job'
      USING ERRCODE = '23503';
  END IF;

  IF claimed_job_type = 'dryhire'::public.job_type THEN
    RAISE EXCEPTION 'job producer claims are not allowed for dryhire jobs'
      USING ERRCODE = '23514';
  END IF;

  SELECT lower(coalesce(profile.department, ''))
  INTO producer_department
  FROM public.profiles AS profile
  WHERE profile.id = NEW.producer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job producer claim references an unknown profile'
      USING ERRCODE = '23503';
  END IF;

  IF producer_department NOT IN ('production', 'produccion', 'producción') THEN
    RAISE EXCEPTION 'job producer claims require a production-department profile'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_job_producer_claim_department() IS
  'Trigger-only claim validation. Locks the job against job_type changes and requires a production-department target on a non-dryhire job.';

REVOKE ALL ON FUNCTION public.enforce_job_producer_claim_department() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_job_producer_claim_department
ON public.job_producer_claims;

CREATE TRIGGER enforce_job_producer_claim_department
BEFORE INSERT OR UPDATE ON public.job_producer_claims
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_producer_claim_department();

CREATE OR REPLACE FUNCTION public.remove_job_producer_claims_for_dryhire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.job_type = 'dryhire'::public.job_type
     AND OLD.job_type IS DISTINCT FROM NEW.job_type THEN
    DELETE FROM public.job_producer_claims
    WHERE job_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.remove_job_producer_claims_for_dryhire() IS
  'Trigger-only cleanup that removes every producer claim when a job becomes dryhire.';

REVOKE ALL ON FUNCTION public.remove_job_producer_claims_for_dryhire() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS remove_job_producer_claims_when_dryhire
ON public.jobs;

CREATE TRIGGER remove_job_producer_claims_when_dryhire
AFTER UPDATE OF job_type ON public.jobs
FOR EACH ROW
WHEN (
  NEW.job_type = 'dryhire'::public.job_type
  AND OLD.job_type IS DISTINCT FROM NEW.job_type
)
EXECUTE FUNCTION public.remove_job_producer_claims_for_dryhire();

DROP POLICY IF EXISTS job_producer_claims_insert_self
ON public.job_producer_claims;

CREATE POLICY job_producer_claims_insert
ON public.job_producer_claims
FOR INSERT
TO authenticated
WITH CHECK (
  lower(coalesce((SELECT public.current_user_department()), ''))
    IN ('production', 'produccion', 'producción')
  AND (
    producer_id = (SELECT auth.uid())
    OR (
      producer_id <> (SELECT auth.uid())
      AND (SELECT public.current_user_role()) = 'management'
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS target_profile
    WHERE target_profile.id = producer_id
      AND lower(coalesce(target_profile.department, ''))
        IN ('production', 'produccion', 'producción')
  )
);

COMMENT ON POLICY job_producer_claims_insert
ON public.job_producer_claims IS
  'Production users may claim themselves; production management may assign another production-department profile.';

COMMENT ON TABLE public.job_producer_claims IS
  'Production ownership claims for non-dryhire jobs. Users may self-claim and production management may assign production peers. Independent from job_assignments and staffing.';

COMMENT ON COLUMN public.job_producer_claims.producer_id IS
  'Production-department profile that claimed or was assigned responsibility for the job.';
