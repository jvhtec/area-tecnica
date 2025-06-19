
-- Add unique constraint to festival_stages table to allow proper upsert operations
ALTER TABLE public.festival_stages 
ADD CONSTRAINT festival_stages_job_id_number_unique 
UNIQUE (job_id, number);
