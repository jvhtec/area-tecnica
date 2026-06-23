-- Enable realtime replication for task tables used by pending task subscriptions.
-- Without these publication entries, postgres_changes listeners never receive updates.
--
-- Publish full task rows. These tables use REPLICA IDENTITY FULL and later
-- migrations delete duplicate rows; column-list publications that omit replica
-- identity columns cause PostgreSQL to reject those DELETE statements.
DO $$
DECLARE
  task_table text;
BEGIN
  FOREACH task_table IN ARRAY ARRAY[
    'sound_job_tasks',
    'lights_job_tasks',
    'video_job_tasks'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = task_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', task_table);
    END IF;
  END LOOP;
END
$$;
