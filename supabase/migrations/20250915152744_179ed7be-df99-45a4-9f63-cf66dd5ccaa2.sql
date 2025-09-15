-- Drop the restrictive policy that only allows technicians to see their own assignments
DROP POLICY IF EXISTS "Technicians can view own assignments" ON job_assignments;

-- Create a new policy that allows technicians to see all assignments for jobs they are assigned to
CREATE POLICY "Technicians can view assignments for their jobs" ON job_assignments
FOR SELECT USING (
  job_id IN (
    SELECT job_id FROM job_assignments WHERE technician_id = auth.uid()
  )
);