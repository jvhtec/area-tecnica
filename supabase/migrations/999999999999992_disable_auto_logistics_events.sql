-- Disable automatic logistics event creation on job creation

-- 1) Replace the trigger function with a no-op
CREATE OR REPLACE FUNCTION public.create_default_logistics_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Disabled: do not auto-create logistics events on job insert
  RETURN NEW;
END;
$$;

-- 2) Drop any triggers on public.jobs that call the function (if present)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE c.relname = 'jobs'
      AND n.nspname = 'public'
      AND p.proname = 'create_default_logistics_events'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.jobs', r.tgname);
  END LOOP;
END $$;

