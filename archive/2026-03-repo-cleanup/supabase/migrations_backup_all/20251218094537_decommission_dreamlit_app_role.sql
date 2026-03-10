-- =============================================================================
-- DECOMMISSION dreamlit_app ROLE
-- =============================================================================
-- User-confirmed: Dreamlit access is being fully removed.
-- Steps:
--   - Prevent logins
--   - Terminate any existing sessions
--   - Remove default privileges + object privileges (DROP OWNED)
--   - Remove role memberships
--   - Drop role
-- =============================================================================

DO $$
DECLARE
  dreamlit_oid oid;
  r record;
BEGIN
  SELECT oid INTO dreamlit_oid
  FROM pg_roles
  WHERE rolname = 'dreamlit_app';

  IF dreamlit_oid IS NULL THEN
    RAISE NOTICE 'Role dreamlit_app does not exist; nothing to do.';
    RETURN;
  END IF;

  -- 1) Disable logins immediately
  BEGIN
    EXECUTE 'ALTER ROLE dreamlit_app NOLOGIN';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- 2) Terminate active sessions (best-effort)
  BEGIN
    FOR r IN (
      SELECT pid
      FROM pg_stat_activity
      WHERE usename = 'dreamlit_app'
        AND pid <> pg_backend_pid()
    ) LOOP
      PERFORM pg_terminate_backend(r.pid);
    END LOOP;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN undefined_table THEN
      NULL;
  END;

  -- 3) Remove owned objects + revoke all privileges in this DB (includes pg_default_acl rows)
  BEGIN
    EXECUTE 'DROP OWNED BY dreamlit_app';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 4) Remove role memberships (both directions)
  --    a) Revoke dreamlit_app from any members
  FOR r IN (
    SELECT pg_get_userbyid(member) as member_name
    FROM pg_auth_members
    WHERE roleid = dreamlit_oid
  ) LOOP
    BEGIN
      EXECUTE format('REVOKE %I FROM %I', 'dreamlit_app', r.member_name);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  --    b) Revoke any roles granted to dreamlit_app
  FOR r IN (
    SELECT pg_get_userbyid(roleid) as role_name
    FROM pg_auth_members
    WHERE member = dreamlit_oid
  ) LOOP
    BEGIN
      EXECUTE format('REVOKE %I FROM %I', r.role_name, 'dreamlit_app');
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  -- 5) Drop role
  BEGIN
    EXECUTE 'DROP ROLE dreamlit_app';
  EXCEPTION
    WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Could not drop role dreamlit_app due to dependencies.';
    WHEN object_in_use THEN
      RAISE NOTICE 'Could not drop role dreamlit_app because it is in use (active sessions may remain).';
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not drop role dreamlit_app due to insufficient privileges.';
  END;
END
$$;

