-- Allow management to manage availability for any user (warehouse overrides, etc.)
-- Adds permissive policies for admin and management roles

-- INSERT/UPDATE/DELETE/SELECT for management
DROP POLICY IF EXISTS "Management can manage availability" ON public.availability_schedules;
CREATE POLICY "Management can manage availability"
ON public.availability_schedules
FOR ALL
TO authenticated
USING (get_current_user_role() IN ('admin','management'))
WITH CHECK (get_current_user_role() IN ('admin','management'));

-- Ensure users can still manage their own availability (already exists, keep as-is)
-- No changes needed if the existing policy is present.

-- Optional: make sure realtime works with full row images (best practice)
ALTER TABLE public.availability_schedules REPLICA IDENTITY FULL; 

-- Ensure there is a unique constraint that matches our upsert
-- Already present: availability_schedules_user_id_department_date_key (user_id, department, date)
-- Nothing to change here.
