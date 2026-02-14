-- Production/administrative task department support
CREATE TABLE IF NOT EXISTS public.production_job_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid,
  task_type text NOT NULL,
  assigned_to uuid,
  progress integer DEFAULT 0,
  status public.task_status DEFAULT 'not_started'::public.task_status,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  tour_id uuid,
  due_at timestamptz,
  priority integer,
  completed_at timestamptz,
  completed_by uuid,
  completion_source text,
  created_by uuid,
  description text,
  CONSTRAINT production_job_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT production_job_tasks_source_check CHECK (NOT (job_id IS NOT NULL AND tour_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.administrative_job_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid,
  task_type text NOT NULL,
  assigned_to uuid,
  progress integer DEFAULT 0,
  status public.task_status DEFAULT 'not_started'::public.task_status,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  tour_id uuid,
  due_at timestamptz,
  priority integer,
  completed_at timestamptz,
  completed_by uuid,
  completion_source text,
  created_by uuid,
  description text,
  CONSTRAINT administrative_job_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT administrative_job_tasks_source_check CHECK (NOT (job_id IS NOT NULL AND tour_id IS NOT NULL))
);

ALTER TABLE ONLY public.production_job_tasks REPLICA IDENTITY FULL;
ALTER TABLE ONLY public.administrative_job_tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_job_tasks_assigned_to_fkey') THEN
    ALTER TABLE ONLY public.production_job_tasks
      ADD CONSTRAINT production_job_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_job_tasks_completed_by_fkey') THEN
    ALTER TABLE ONLY public.production_job_tasks
      ADD CONSTRAINT production_job_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_job_tasks_created_by_fkey') THEN
    ALTER TABLE ONLY public.production_job_tasks
      ADD CONSTRAINT production_job_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_job_tasks_job_id_fkey') THEN
    ALTER TABLE ONLY public.production_job_tasks
      ADD CONSTRAINT production_job_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_job_tasks_tour_id_fkey') THEN
    ALTER TABLE ONLY public.production_job_tasks
      ADD CONSTRAINT production_job_tasks_tour_id_fkey FOREIGN KEY (tour_id) REFERENCES public.tours(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administrative_job_tasks_assigned_to_fkey') THEN
    ALTER TABLE ONLY public.administrative_job_tasks
      ADD CONSTRAINT administrative_job_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administrative_job_tasks_completed_by_fkey') THEN
    ALTER TABLE ONLY public.administrative_job_tasks
      ADD CONSTRAINT administrative_job_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administrative_job_tasks_created_by_fkey') THEN
    ALTER TABLE ONLY public.administrative_job_tasks
      ADD CONSTRAINT administrative_job_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administrative_job_tasks_job_id_fkey') THEN
    ALTER TABLE ONLY public.administrative_job_tasks
      ADD CONSTRAINT administrative_job_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administrative_job_tasks_tour_id_fkey') THEN
    ALTER TABLE ONLY public.administrative_job_tasks
      ADD CONSTRAINT administrative_job_tasks_tour_id_fkey FOREIGN KEY (tour_id) REFERENCES public.tours(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_production_job_tasks_created_by ON public.production_job_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_administrative_job_tasks_created_by ON public.administrative_job_tasks(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS uq_production_job_tasks_task_assignee_context ON public.production_job_tasks (task_type, assigned_to, job_id, tour_id) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_administrative_job_tasks_task_assignee_context ON public.administrative_job_tasks (task_type, assigned_to, job_id, tour_id) NULLS NOT DISTINCT;

ALTER TABLE public.production_job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_job_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.production_job_tasks TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.production_job_tasks TO authenticated;
GRANT ALL ON TABLE public.production_job_tasks TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.administrative_job_tasks TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.administrative_job_tasks TO authenticated;
GRANT ALL ON TABLE public.administrative_job_tasks TO service_role;

DROP POLICY IF EXISTS "p_production_job_tasks_public_select_4a8af1" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_select_4a8af1" ON public.production_job_tasks FOR SELECT USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR ((tour_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.tour_assignments ta
      WHERE ta.tour_id = production_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
  ))
  OR assigned_to = auth.uid()
);
DROP POLICY IF EXISTS "p_production_job_tasks_public_insert_3c32f0" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_insert_3c32f0" ON public.production_job_tasks FOR INSERT WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.is_admin_or_management()
);
DROP POLICY IF EXISTS "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_update_8f14c7" ON public.production_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
);
DROP POLICY IF EXISTS "p_production_job_tasks_public_delete_b2f39c" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_public_delete_b2f39c" ON public.production_job_tasks FOR DELETE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['production'::text, 'admin'::text, 'management'::text])
);

DROP POLICY IF EXISTS "p_administrative_job_tasks_public_select_e8a7a0" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_select_e8a7a0" ON public.administrative_job_tasks FOR SELECT USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR ((tour_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.tour_assignments ta
      WHERE ta.tour_id = administrative_job_tasks.tour_id
        AND ta.technician_id = auth.uid()
  ))
  OR assigned_to = auth.uid()
);
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_insert_9450fe" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_insert_9450fe" ON public.administrative_job_tasks FOR INSERT WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.is_admin_or_management()
);
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_update_2d3442" ON public.administrative_job_tasks FOR UPDATE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
) WITH CHECK (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.is_admin_or_management()
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
  OR assigned_to = auth.uid()
);
DROP POLICY IF EXISTS "p_administrative_job_tasks_public_delete_8ea2db" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_public_delete_8ea2db" ON public.administrative_job_tasks FOR DELETE USING (
  ((tour_id IS NOT NULL) AND public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]))
  OR public.current_user_department() = ANY (ARRAY['administrative'::text, 'admin'::text, 'management'::text])
);

DROP POLICY IF EXISTS "production_tasks_creator_update" ON public.production_job_tasks;
CREATE POLICY "production_tasks_creator_update" ON public.production_job_tasks FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "administrative_tasks_creator_update" ON public.administrative_job_tasks;
CREATE POLICY "administrative_tasks_creator_update" ON public.administrative_job_tasks FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "p_production_job_tasks_oscar_select" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_oscar_select" ON public.production_job_tasks FOR SELECT USING (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_production_job_tasks_oscar_insert" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_oscar_insert" ON public.production_job_tasks FOR INSERT WITH CHECK (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_production_job_tasks_oscar_update" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_oscar_update" ON public.production_job_tasks FOR UPDATE USING (public.current_user_role() = 'oscar') WITH CHECK (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_production_job_tasks_oscar_delete" ON public.production_job_tasks;
CREATE POLICY "p_production_job_tasks_oscar_delete" ON public.production_job_tasks FOR DELETE USING (public.current_user_role() = 'oscar');

DROP POLICY IF EXISTS "p_administrative_job_tasks_oscar_select" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_oscar_select" ON public.administrative_job_tasks FOR SELECT USING (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_administrative_job_tasks_oscar_insert" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_oscar_insert" ON public.administrative_job_tasks FOR INSERT WITH CHECK (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_administrative_job_tasks_oscar_update" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_oscar_update" ON public.administrative_job_tasks FOR UPDATE USING (public.current_user_role() = 'oscar') WITH CHECK (public.current_user_role() = 'oscar');
DROP POLICY IF EXISTS "p_administrative_job_tasks_oscar_delete" ON public.administrative_job_tasks;
CREATE POLICY "p_administrative_job_tasks_oscar_delete" ON public.administrative_job_tasks FOR DELETE USING (public.current_user_role() = 'oscar');

ALTER TABLE public.task_documents ADD COLUMN IF NOT EXISTS production_task_id uuid;
ALTER TABLE public.task_documents ADD COLUMN IF NOT EXISTS administrative_task_id uuid;
CREATE INDEX IF NOT EXISTS idx_task_documents_production_task_id_fk_11742a ON public.task_documents(production_task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_administrative_task_id_fk_d6f2f1 ON public.task_documents(administrative_task_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_documents_production_task_id_fkey') THEN
    ALTER TABLE ONLY public.task_documents
      ADD CONSTRAINT task_documents_production_task_id_fkey FOREIGN KEY (production_task_id) REFERENCES public.production_job_tasks(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_documents_administrative_task_id_fkey') THEN
    ALTER TABLE ONLY public.task_documents
      ADD CONSTRAINT task_documents_administrative_task_id_fkey FOREIGN KEY (administrative_task_id) REFERENCES public.administrative_job_tasks(id) ON DELETE CASCADE;
  END IF;
END
$$;
ALTER TABLE public.task_documents DROP CONSTRAINT IF EXISTS task_type_check;
ALTER TABLE public.task_documents ADD CONSTRAINT task_type_check CHECK (((sound_task_id IS NOT NULL)::int + (lights_task_id IS NOT NULL)::int + (video_task_id IS NOT NULL)::int + (production_task_id IS NOT NULL)::int + (administrative_task_id IS NOT NULL)::int) = 1);

CREATE OR REPLACE FUNCTION public.update_task_status_on_document_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.sound_task_id IS NOT NULL THEN
    UPDATE public.sound_job_tasks SET status = 'in_progress', progress = 50 WHERE id = OLD.sound_task_id;
  END IF;
  IF OLD.lights_task_id IS NOT NULL THEN
    UPDATE public.lights_job_tasks SET status = 'in_progress', progress = 50 WHERE id = OLD.lights_task_id;
  END IF;
  IF OLD.video_task_id IS NOT NULL THEN
    UPDATE public.video_job_tasks SET status = 'in_progress', progress = 50 WHERE id = OLD.video_task_id;
  END IF;
  IF OLD.production_task_id IS NOT NULL THEN
    UPDATE public.production_job_tasks SET status = 'in_progress', progress = 50 WHERE id = OLD.production_task_id;
  END IF;
  IF OLD.administrative_task_id IS NOT NULL THEN
    UPDATE public.administrative_job_tasks SET status = 'in_progress', progress = 50 WHERE id = OLD.administrative_task_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE VIEW public.pending_tasks_view
WITH (security_invoker = true) AS
SELECT t.id, t.job_id, NULL::uuid AS tour_id, 'sound'::text AS department, t.task_type, t.assigned_to, t.status, t.progress, t.due_at, t.priority, t.created_at, t.updated_at, j.title AS job_name, NULL::text AS client, NULL::text AS tour_name, p.first_name AS assignee_first_name, p.last_name AS assignee_last_name, p.role AS assignee_role, t.description
FROM public.sound_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress') AND p.role IN ('management', 'admin', 'logistics', 'oscar')
UNION ALL
SELECT t.id, t.job_id, NULL::uuid AS tour_id, 'lights'::text AS department, t.task_type, t.assigned_to, t.status, t.progress, t.due_at, t.priority, t.created_at, t.updated_at, j.title AS job_name, NULL::text AS client, NULL::text AS tour_name, p.first_name AS assignee_first_name, p.last_name AS assignee_last_name, p.role AS assignee_role, t.description
FROM public.lights_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress') AND p.role IN ('management', 'admin', 'logistics', 'oscar')
UNION ALL
SELECT t.id, t.job_id, NULL::uuid AS tour_id, 'video'::text AS department, t.task_type, t.assigned_to, t.status, t.progress, t.due_at, t.priority, t.created_at, t.updated_at, j.title AS job_name, NULL::text AS client, NULL::text AS tour_name, p.first_name AS assignee_first_name, p.last_name AS assignee_last_name, p.role AS assignee_role, t.description
FROM public.video_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress') AND p.role IN ('management', 'admin', 'logistics', 'oscar')
UNION ALL
SELECT t.id, t.job_id, NULL::uuid AS tour_id, 'production'::text AS department, t.task_type, t.assigned_to, t.status, t.progress, t.due_at, t.priority, t.created_at, t.updated_at, j.title AS job_name, NULL::text AS client, NULL::text AS tour_name, p.first_name AS assignee_first_name, p.last_name AS assignee_last_name, p.role AS assignee_role, t.description
FROM public.production_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress') AND p.role IN ('management', 'admin', 'logistics', 'oscar')
UNION ALL
SELECT t.id, t.job_id, NULL::uuid AS tour_id, 'administrative'::text AS department, t.task_type, t.assigned_to, t.status, t.progress, t.due_at, t.priority, t.created_at, t.updated_at, j.title AS job_name, NULL::text AS client, NULL::text AS tour_name, p.first_name AS assignee_first_name, p.last_name AS assignee_last_name, p.role AS assignee_role, t.description
FROM public.administrative_job_tasks t
LEFT JOIN public.jobs j ON j.id = t.job_id
LEFT JOIN public.profiles p ON p.id = t.assigned_to
WHERE t.status IN ('not_started', 'in_progress') AND p.role IN ('management', 'admin', 'logistics', 'oscar');

DROP POLICY IF EXISTS "p_job_documents_oscar_task_select" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_select" ON public.job_documents FOR SELECT USING (public.current_user_role() = 'oscar' AND file_path ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_job_documents_oscar_task_insert" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_insert" ON public.job_documents FOR INSERT WITH CHECK (public.current_user_role() = 'oscar' AND file_path ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_job_documents_oscar_task_update" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_update" ON public.job_documents FOR UPDATE USING (public.current_user_role() = 'oscar' AND file_path ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+') WITH CHECK (public.current_user_role() = 'oscar' AND file_path ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_job_documents_oscar_task_delete" ON public.job_documents;
CREATE POLICY "p_job_documents_oscar_task_delete" ON public.job_documents FOR DELETE USING (public.current_user_role() = 'oscar' AND file_path ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_select" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'job_documents' AND public.current_user_role() = 'oscar' AND name ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_insert" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'job_documents' AND public.current_user_role() = 'oscar' AND name ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_update" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'job_documents' AND public.current_user_role() = 'oscar' AND name ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+') WITH CHECK (bucket_id = 'job_documents' AND public.current_user_role() = 'oscar' AND name ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');
DROP POLICY IF EXISTS "p_storage_job_documents_oscar_task_delete" ON storage.objects;
CREATE POLICY "p_storage_job_documents_oscar_task_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'job_documents' AND public.current_user_role() = 'oscar' AND name ~ '^(sound|lights|video|production|administrative)/[^/]+/task-[^/]+/.+');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'production_job_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.production_job_tasks (id, job_id, tour_id, task_type, assigned_to, status, progress, due_at, priority, created_at, updated_at);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'administrative_job_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.administrative_job_tasks (id, job_id, tour_id, task_type, assigned_to, status, progress, due_at, priority, created_at, updated_at);
  END IF;
END
$$;;
