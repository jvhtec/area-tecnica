-- Fix RLS policies for push_notification_schedules
-- Allow both admin and management to modify schedules

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and management can view schedules" ON push_notification_schedules;
DROP POLICY IF EXISTS "Only admins can modify schedules" ON push_notification_schedules;

-- Recreate policies with correct permissions
-- Policy: Admins and management can view schedules
CREATE POLICY "Admins and management can view schedules"
ON push_notification_schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);

-- Policy: Admins and management can modify schedules
CREATE POLICY "Admins and management can modify schedules"
ON push_notification_schedules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'management')
  )
);
