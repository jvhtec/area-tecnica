-- Technicians need to know which production-department user is carrying a job
-- and how to reach them. get_job_producer_claims() deliberately exposes only a
-- display name, so this adds a second, narrower projection that also returns
-- the producer's phone and email.
--
-- profiles.phone/email are private (see the profiles_select policy installed by
-- 20260904162000_narrow_profile_and_rate_visibility.sql), so the contact
-- details are released per row and only to callers with a reason to have them:
-- operational administrators, the producer themselves, and technicians who are
-- actually assigned to that job. Everyone else keeps using the name-only RPC.

CREATE OR REPLACE FUNCTION public.get_job_producer_contacts(
  p_job_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  producer_id uuid,
  display_name text,
  phone text,
  email text
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
    ) AS display_name,
    nullif(trim(profile.phone), '') AS phone,
    nullif(trim(profile.email), '') AS email
  FROM public.job_producer_claims AS claim
  JOIN public.profiles AS profile ON profile.id = claim.producer_id
  WHERE auth.uid() IS NOT NULL
    AND (p_job_ids IS NULL OR claim.job_id = ANY (p_job_ids))
    AND (
      (SELECT public.current_user_role()) IN ('admin', 'management', 'logistics')
      OR claim.producer_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.job_assignments AS assignment
        WHERE assignment.job_id = claim.job_id
          AND assignment.technician_id = (SELECT auth.uid())
      )
    )
  ORDER BY claim.claimed_at, claim.producer_id;
$function$;

COMMENT ON FUNCTION public.get_job_producer_contacts(uuid[]) IS
  'Producer-claim contact projection (name, phone, email) for operational roles, the producer themselves, and technicians assigned to the job. Name-only callers must use get_job_producer_claims().';

REVOKE ALL ON FUNCTION public.get_job_producer_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_producer_contacts(uuid[]) TO authenticated, service_role;
