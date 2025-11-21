-- Enable Supabase Realtime for timesheets table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'timesheets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheets;
  END IF;
END
$$;

