-- =============================================================================
-- REMOVE dreamlit_app RLS POLICIES
-- =============================================================================
-- User-confirmed: all Dreamlit-related policies can be removed.
-- This drops the legacy policy `dreamlit_dreamlit_app_select_policy` everywhere
-- it exists.
-- =============================================================================

DO $$
DECLARE
  r record;
  dropped_count integer := 0;
  skipped_count integer := 0;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname = 'dreamlit_dreamlit_app_select_policy'
    ORDER BY schemaname, tablename
  ) LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      dropped_count := dropped_count + 1;
    EXCEPTION
      WHEN insufficient_privilege THEN
        skipped_count := skipped_count + 1;
      WHEN undefined_table THEN
        skipped_count := skipped_count + 1;
      WHEN undefined_object THEN
        skipped_count := skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Removed dreamlit policy instances: %, skipped: %', dropped_count, skipped_count;
END
$$;

