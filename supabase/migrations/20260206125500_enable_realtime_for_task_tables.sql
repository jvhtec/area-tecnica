-- Enable realtime replication for task tables used by pending task subscriptions.
-- Without these publication entries, postgres_changes listeners never receive updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sound_job_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.sound_job_tasks (
        id,
        job_id,
        tour_id,
        task_type,
        assigned_to,
        status,
        progress,
        due_at,
        priority,
        created_at,
        updated_at
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lights_job_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.lights_job_tasks (
        id,
        job_id,
        tour_id,
        task_type,
        assigned_to,
        status,
        progress,
        due_at,
        priority,
        created_at,
        updated_at
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'video_job_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.video_job_tasks (
        id,
        job_id,
        tour_id,
        task_type,
        assigned_to,
        status,
        progress,
        due_at,
        priority,
        created_at,
        updated_at
      );
  END IF;
END
$$;
