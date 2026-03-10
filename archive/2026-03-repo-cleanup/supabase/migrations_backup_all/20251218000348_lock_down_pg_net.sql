-- =============================================================================
-- LOCK DOWN pg_net / net SCHEMA (PROD)
-- =============================================================================
-- Goals:
--   - Reduce SSRF surface area by removing PUBLIC/anon/authenticated access to net.*
--   - Ensure dreamlit_auth_admin_executor is service_role only (belt + suspenders)
--
-- NOTE:
--   In Supabase, pg_net objects are typically owned by supabase_admin. If this
--   migration runs as postgres without membership, some REVOKE/GRANT statements
--   may fail with insufficient_privilege. We intentionally swallow those errors
--   so the migration can still apply the parts we DO control.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Attempt to remove PUBLIC access to schema net and its objects
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    -- Schema-level access (USAGE drives visibility and routine resolution)
    REVOKE USAGE ON SCHEMA net FROM PUBLIC;

    -- Routines
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC;

    -- Relation objects (the extension can include helper tables/sequences)
    REVOKE ALL ON ALL TABLES IN SCHEMA net FROM PUBLIC;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA net FROM PUBLIC;

    -- Keep operational access for privileged roles
    GRANT USAGE ON SCHEMA net TO postgres, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, service_role;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- Most pg_net objects are owned by supabase_admin; postgres may not be able
      -- to modify their ACLs. This is still valuable to attempt in environments
      -- where ownership differs.
      NULL;
    WHEN undefined_schema THEN
      -- pg_net not installed in this environment.
      NULL;
  END;
END
$$;

-- -----------------------------------------------------------------------------
-- 2) Ensure the admin executor RPC is NOT callable by PUBLIC roles
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.dreamlit_auth_admin_executor(text)
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dreamlit_app') THEN
    REVOKE EXECUTE ON FUNCTION public.dreamlit_auth_admin_executor(text)
      FROM dreamlit_app;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.dreamlit_auth_admin_executor(text)
  TO service_role;
