-- Fix search_path for functions that exist in database but not in migration files
-- These functions were reported by the database linter

-- Fix tg_touch_updated_at if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'tg_touch_updated_at'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = ''''
      AS $func$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $func$;
    ';
    RAISE NOTICE 'Fixed search_path for public.tg_touch_updated_at';
  ELSE
    RAISE NOTICE 'Function public.tg_touch_updated_at does not exist, skipping';
  END IF;
END $$;

-- Fix dreamlit.send_supabase_auth_email if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'dreamlit' AND p.proname = 'send_supabase_auth_email'
  ) THEN
    -- Note: We can't recreate this function without knowing its exact signature and body
    -- This is a placeholder that will attempt to add search_path to the existing function
    -- If the function has complex logic, manual review may be needed
    RAISE NOTICE 'Function dreamlit.send_supabase_auth_email exists but cannot be automatically fixed';
    RAISE NOTICE 'Manual review required to add SET search_path = '''' to this function';
  ELSE
    RAISE NOTICE 'Function dreamlit.send_supabase_auth_email does not exist, skipping';
  END IF;
END $$;
