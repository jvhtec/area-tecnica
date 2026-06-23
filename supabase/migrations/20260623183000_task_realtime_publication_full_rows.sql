-- Normalize task realtime publications to full-row entries.
--
-- The task tables use REPLICA IDENTITY FULL so realtime DELETE/UPDATE events can
-- include the previous row. PostgreSQL rejects DELETE operations when a
-- column-list publication omits any replica-identity column, and historical
-- migrations added these task tables with narrowed column lists.
--
-- Re-adding the task tables without column lists keeps fresh database replay and
-- production behavior aligned with the replica identity configuration.
DO $$
DECLARE
  task_table text;
BEGIN
  FOREACH task_table IN ARRAY ARRAY[
    'sound_job_tasks',
    'lights_job_tasks',
    'video_job_tasks',
    'production_job_tasks',
    'administrative_job_tasks'
  ] LOOP
    IF to_regclass(format('public.%I', task_table)) IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = task_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', task_table);
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', task_table);
  END LOOP;
END
$$;
