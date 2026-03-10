-- =============================================================================
-- SET search_path for dreamlit.send_supabase_auth_email (SECURITY)
-- =============================================================================

ALTER FUNCTION dreamlit.send_supabase_auth_email(jsonb)
  SET search_path = pg_catalog, dreamlit;

