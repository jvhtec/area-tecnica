-- Add missing tables to realtime publication for job card updates
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_documents REPLICA IDENTITY FULL;
ALTER TABLE public.job_departments REPLICA IDENTITY FULL;
ALTER TABLE public.flex_folders REPLICA IDENTITY FULL;
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;