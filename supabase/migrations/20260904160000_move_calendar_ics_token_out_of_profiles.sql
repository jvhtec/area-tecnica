-- =============================================================================
-- SEC-13: isolate and rotate the bearer token used by tech-calendar-ics
-- =============================================================================
-- Safe rollout order:
--   1. Deploy the dual-read Edge Function and the RPC-compatible web client.
--   2. Apply this migration.
--
-- Before this migration, the new Function falls back to the legacy profiles
-- column only when PostgREST reports that this table does not exist. Once the
-- table exists it fails closed and never accepts the legacy token. This
-- migration rotates every existing token and NULLs the compatibility column,
-- invalidating credentials that were exposed by the broad profiles policy.
-- The nullable column remains for one release so cached PWA bundles can still
-- select it without making their entire profile query fail. A later migration
-- may drop it after those bundles have aged out.
-- =============================================================================

SET lock_timeout = '5s';

CREATE TABLE "public"."profile_calendar_tokens" (
  "profile_id" "uuid" PRIMARY KEY
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "token" "text" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "rotated_at" timestamp with time zone,
  CONSTRAINT "profile_calendar_tokens_token_key" UNIQUE ("token")
);

COMMENT ON TABLE "public"."profile_calendar_tokens" IS
  'Bearer tokens for the tech-calendar-ics feed. One row per profile, readable only by its owner. Separated from profiles so a broad profile read cannot disclose a credential (SEC-13).';

ALTER TABLE "public"."profile_calendar_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_calendar_tokens_select_own"
  ON "public"."profile_calendar_tokens"
  FOR SELECT TO "authenticated"
  USING ("profile_id" = (SELECT "auth"."uid"()));

CREATE POLICY "profile_calendar_tokens_service_role_all"
  ON "public"."profile_calendar_tokens"
  FOR ALL TO "service_role"
  USING (true) WITH CHECK (true);

GRANT ALL ON TABLE "public"."profile_calendar_tokens" TO "service_role";
REVOKE ALL ON TABLE "public"."profile_calendar_tokens" FROM "anon", "authenticated", PUBLIC;
GRANT SELECT ON TABLE "public"."profile_calendar_tokens" TO "authenticated";

-- Generate fresh credentials instead of copying values that were readable by
-- every authenticated account. rotated_at records the incident-wide rotation.
INSERT INTO "public"."profile_calendar_tokens" ("profile_id", "token", "rotated_at")
SELECT "id", encode(extensions.gen_random_bytes(18), 'hex'), now()
  FROM "public"."profiles";

-- Preserve the column shape for cached clients while removing every secret and
-- preventing future profile inserts from generating a credential there.
ALTER TABLE "public"."profiles"
  ALTER COLUMN "calendar_ics_token" DROP DEFAULT,
  ALTER COLUMN "calendar_ics_token" DROP NOT NULL;

-- The profile privilege trigger requires JWT claims before any UPDATE, even
-- when only a non-privileged field changes. Linked migrations run without JWT
-- claims, so suspend the trigger for this controlled credential purge.
ALTER TABLE "public"."profiles"
  DISABLE TRIGGER "enforce_profile_privilege_changes";

UPDATE "public"."profiles" SET "calendar_ics_token" = NULL
 WHERE "calendar_ics_token" IS NOT NULL;

ALTER TABLE "public"."profiles"
  ENABLE TRIGGER "enforce_profile_privilege_changes";

COMMENT ON COLUMN "public"."profiles"."calendar_ics_token" IS
  'Deprecated compatibility column. Always NULL; remove after pre-SEC-13 PWA bundles have aged out.';

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

-- RLS already self-scopes this read, so it does not need definer privileges.
CREATE OR REPLACE FUNCTION "public"."get_my_calendar_ics_token"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY INVOKER
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

RESET lock_timeout;
