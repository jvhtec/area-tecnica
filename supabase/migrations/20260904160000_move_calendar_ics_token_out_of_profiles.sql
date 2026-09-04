-- =============================================================================
-- SEC-13: move `calendar_ics_token` out of the client-readable `profiles` row
-- =============================================================================
-- `profiles_select` is `USING (true)` for `authenticated`, so every logged-in
-- account can read every profile row. Measured on production at audit time:
-- 313 rows visible, including all 313 `calendar_ics_token` values.
--
-- That column is not merely PII. `tech-calendar-ics` authenticates a request
-- purely by matching `?tid=<uuid>&token=<value>` against it, so any
-- authenticated user could read a colleague's token and fetch their personal
-- calendar from an unauthenticated endpoint. That is privilege escalation, not
-- an over-broad read, which is why the token is separated here ahead of the
-- broader `profiles_select` narrowing (tracked separately).
--
-- Why a separate table rather than a column-level REVOKE
-- -----------------------------------------------------
-- Postgres consults column privileges only when the role lacks the table-level
-- privilege, so restricting one column means revoking table-level SELECT and
-- re-granting every other column by name. That buys the same protection at the
-- cost of two permanent hazards: `SELECT *` on profiles would fail for
-- `authenticated` forever (this repo has 177 `select('*')` call sites), and
-- every future `ALTER TABLE profiles ADD COLUMN` would be silently unreadable
-- until someone remembered to grant it. A separate table carries neither, and
-- expresses the real rule — this row belongs to exactly one user — as RLS,
-- which is row-aware in the way column grants are not.
--
-- Deploy order
-- ------------
-- This migration drops `profiles.calendar_ics_token`. The `tech-calendar-ics`
-- Edge Function and the two client reads are updated in the same change, but
-- migrations and Function deploys are separate steps: deploy the Function
-- first, or accept a short window in which existing calendar subscriptions
-- return 403 until it lands. Subscriptions recover on their own once deployed;
-- no token values change here.
--
-- Existing tokens are carried over as-is rather than regenerated. They have
-- been readable org-wide for as long as the policy has existed and should be
-- treated as disclosed, but rotating them invalidates every user's existing
-- calendar subscription and forces a manual re-add. That is a visible user
-- impact and therefore an owner's decision, not this migration's. Once decided,
-- a full rotation is:
--     UPDATE public.profile_calendar_tokens
--        SET token = encode(extensions.gen_random_bytes(18), 'hex'),
--            rotated_at = now();
-- =============================================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "public"."profile_calendar_tokens" (
  "profile_id" "uuid" PRIMARY KEY
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "token" "text" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "rotated_at" timestamp with time zone
);

COMMENT ON TABLE "public"."profile_calendar_tokens" IS
  'Bearer tokens for the tech-calendar-ics feed. One row per profile, readable only by its owner. Separated from profiles so a broad profile read cannot disclose a credential (SEC-13).';

-- Carry existing tokens over before the column is dropped, so live calendar
-- subscriptions keep working across the deploy.
INSERT INTO "public"."profile_calendar_tokens" ("profile_id", "token")
SELECT "id", "calendar_ics_token"
  FROM "public"."profiles"
 WHERE "calendar_ics_token" IS NOT NULL
ON CONFLICT ("profile_id") DO NOTHING;

ALTER TABLE "public"."profile_calendar_tokens" ENABLE ROW LEVEL SECURITY;

-- Owner-only read. There is deliberately no INSERT/UPDATE/DELETE policy for
-- `authenticated`: rotation is the only legitimate write and it goes through
-- `rotate_my_calendar_ics_token()`, which is SECURITY DEFINER and self-scoped.
-- Without a policy those commands are denied even though the grants below
-- would otherwise permit them.
CREATE POLICY "profile_calendar_tokens_select_own"
  ON "public"."profile_calendar_tokens"
  FOR SELECT TO "authenticated"
  USING ("profile_id" = (SELECT "auth"."uid"()));

CREATE POLICY "profile_calendar_tokens_service_role_all"
  ON "public"."profile_calendar_tokens"
  FOR ALL TO "service_role"
  USING (true) WITH CHECK (true);

-- SELECT only for authenticated; the write path is the definer function.
GRANT SELECT ON TABLE "public"."profile_calendar_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_calendar_tokens" TO "service_role";
REVOKE ALL ON TABLE "public"."profile_calendar_tokens" FROM "anon", PUBLIC;

-- -----------------------------------------------------------------------------
-- Rotation now targets the new table. Signature and return value are unchanged,
-- so `dataLayerClient.rpc('rotate_my_calendar_ics_token')` keeps working.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."rotate_my_calendar_ics_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  new_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  new_token := encode(extensions.gen_random_bytes(18), 'hex');

  INSERT INTO public.profile_calendar_tokens AS t (profile_id, token, rotated_at)
  VALUES (auth.uid(), new_token, now())
  ON CONFLICT (profile_id)
  DO UPDATE SET token = EXCLUDED.token, rotated_at = now();

  RETURN new_token;
END;
$$;

COMMENT ON FUNCTION "public"."rotate_my_calendar_ics_token"() IS
  'Generates, stores and returns a new ICS token for the calling profile.';

-- -----------------------------------------------------------------------------
-- Read path for the owner's current token. The client previously obtained this
-- by selecting the column off its own profile row; that read now needs a
-- definer function because the value no longer lives on `profiles`.
-- Self-scoped by construction: it ignores any argument and keys off auth.uid().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_my_calendar_ics_token"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT t.token
    FROM public.profile_calendar_tokens t
   WHERE t.profile_id = auth.uid();
$$;

COMMENT ON FUNCTION "public"."get_my_calendar_ics_token"() IS
  'Returns the calling profile''s ICS token, or NULL if none has been generated.';

REVOKE ALL ON FUNCTION "public"."rotate_my_calendar_ics_token"() FROM "anon", PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_my_calendar_ics_token"() FROM "anon", PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."rotate_my_calendar_ics_token"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_my_calendar_ics_token"() TO "authenticated";

-- -----------------------------------------------------------------------------
-- Remove the credential from the broadly-readable row. This is the actual fix;
-- everything above exists so that dropping it is non-breaking.
-- -----------------------------------------------------------------------------
ALTER TABLE "public"."profiles" DROP COLUMN IF EXISTS "calendar_ics_token";

RESET lock_timeout;
