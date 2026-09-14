-- Producer ownership is intentionally separate from technical staffing. A row
-- here means that a production-department user is carrying the job; it must
-- never create a job_assignment, timesheet, rate, or staffing side effect.

-- Supabase bootstrap defaults can explicitly grant future public-schema
-- functions to API roles. Require every new function to opt into execution.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

CREATE TABLE public.job_producer_claims (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  producer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, producer_id)
);

CREATE INDEX job_producer_claims_producer_id_idx
  ON public.job_producer_claims (producer_id);

COMMENT ON TABLE public.job_producer_claims IS
  'Self-service production ownership for jobs. Independent from job_assignments and staffing.';
COMMENT ON COLUMN public.job_producer_claims.producer_id IS
  'Production-department profile that has claimed responsibility for the job.';

CREATE OR REPLACE FUNCTION public.enforce_job_producer_claim_department()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  producer_department text;
BEGIN
  SELECT lower(coalesce(p.department, ''))
  INTO producer_department
  FROM public.profiles AS p
  WHERE p.id = NEW.producer_id;

  IF producer_department NOT IN ('production', 'produccion', 'producción') THEN
    RAISE EXCEPTION 'job producer claims require a production-department profile'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_job_producer_claim_department() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_job_producer_claim_department
BEFORE INSERT OR UPDATE OF producer_id ON public.job_producer_claims
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_producer_claim_department();

ALTER TABLE public.job_producer_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_producer_claims_select
ON public.job_producer_claims
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY job_producer_claims_insert_self
ON public.job_producer_claims
FOR INSERT
TO authenticated
WITH CHECK (
  producer_id = (SELECT auth.uid())
  AND lower(coalesce((SELECT public.current_user_department()), ''))
    IN ('production', 'produccion', 'producción')
);

CREATE POLICY job_producer_claims_delete_self
ON public.job_producer_claims
FOR DELETE
TO authenticated
USING (producer_id = (SELECT auth.uid()));

-- Explicit grants are required for Data API exposure on current Supabase
-- projects. There is deliberately no UPDATE privilege: a claim is immutable.
REVOKE ALL ON TABLE public.job_producer_claims FROM anon;
REVOKE ALL ON TABLE public.job_producer_claims FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.job_producer_claims TO authenticated;
GRANT ALL ON TABLE public.job_producer_claims TO service_role;

CREATE OR REPLACE FUNCTION public.get_job_producer_claims(
  p_job_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  producer_id uuid,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    claim.job_id,
    claim.producer_id,
    coalesce(
      nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      nullif(trim(profile.nickname), ''),
      'Producción'
    ) AS display_name
  FROM public.job_producer_claims AS claim
  JOIN public.profiles AS profile ON profile.id = claim.producer_id
  WHERE auth.uid() IS NOT NULL
    AND (p_job_ids IS NULL OR claim.job_id = ANY (p_job_ids))
  ORDER BY claim.claimed_at, claim.producer_id;
$function$;

COMMENT ON FUNCTION public.get_job_producer_claims(uuid[]) IS
  'Authenticated safe producer-claim directory projection for job cards and generated documents.';

REVOKE ALL ON FUNCTION public.get_job_producer_claims(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_producer_claims(uuid[]) TO authenticated, service_role;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'job_producer_claims'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_producer_claims;
  END IF;
END
$block$;
