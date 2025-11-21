
-- Add foreign key constraint to link timesheets.technician_id to profiles.id
ALTER TABLE public.timesheets 
ADD CONSTRAINT fk_timesheets_technician_id 
FOREIGN KEY (technician_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
