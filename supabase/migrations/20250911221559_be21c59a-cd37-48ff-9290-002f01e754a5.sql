-- Add selected_job_statuses column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN selected_job_statuses text[] DEFAULT ARRAY['Confirmado', 'Tentativa'];