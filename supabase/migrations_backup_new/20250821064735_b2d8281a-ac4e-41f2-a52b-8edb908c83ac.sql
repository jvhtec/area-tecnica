-- Create RLS policies for vacation_requests table

-- Users can view their own requests
CREATE POLICY "Users can view own vacation requests" ON vacation_requests
FOR SELECT USING (technician_id = auth.uid());

-- Users can create their own requests  
CREATE POLICY "Users can create own vacation requests" ON vacation_requests
FOR INSERT WITH CHECK (technician_id = auth.uid());

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending requests" ON vacation_requests
FOR UPDATE USING (
  technician_id = auth.uid() 
  AND status = 'pending'
);

-- Management can view requests from their department
CREATE POLICY "Management can view department requests" ON vacation_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles manager_profile
    WHERE manager_profile.id = auth.uid()
    AND manager_profile.role = 'management'
    AND EXISTS (
      SELECT 1 FROM profiles tech_profile
      WHERE tech_profile.id = vacation_requests.technician_id
      AND tech_profile.department = manager_profile.department
    )
  )
);

-- Management can approve/reject requests from their department
CREATE POLICY "Management can manage department requests" ON vacation_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles manager_profile
    WHERE manager_profile.id = auth.uid()
    AND manager_profile.role = 'management'
    AND EXISTS (
      SELECT 1 FROM profiles tech_profile
      WHERE tech_profile.id = vacation_requests.technician_id
      AND tech_profile.department = manager_profile.department
    )
  )
);