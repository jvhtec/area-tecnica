-- Add missing RLS policies for timesheets table

-- Allow management to create timesheets for any technician
CREATE POLICY "Management can create timesheets" 
ON public.timesheets 
FOR INSERT 
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Allow technicians to create their own timesheets
CREATE POLICY "Technicians can create own timesheets" 
ON public.timesheets 
FOR INSERT 
WITH CHECK (technician_id = auth.uid());

-- Allow technicians to update their own timesheets (not just signatures)
CREATE POLICY "Technicians can update own timesheets" 
ON public.timesheets 
FOR UPDATE 
USING (technician_id = auth.uid());