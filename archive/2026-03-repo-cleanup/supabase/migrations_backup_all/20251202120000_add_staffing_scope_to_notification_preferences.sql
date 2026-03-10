-- Add staffing notification scope preference for admin/management users
-- This allows admins to choose between receiving staffing notifications for:
-- - 'all_departments': All staffing events regardless of department
-- - 'own_department': Only staffing events from their own department

-- Create enum type for staffing scope
DO $$ BEGIN
  CREATE TYPE staffing_notification_scope AS ENUM ('all_departments', 'own_department');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add staffing_scope column to notification_preferences table
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS staffing_scope staffing_notification_scope DEFAULT 'all_departments';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_preferences_staffing_scope
ON notification_preferences(staffing_scope)
WHERE staffing_scope IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN notification_preferences.staffing_scope IS
'Controls the scope of staffing notifications for admin/management users:
- all_departments: Receive staffing notifications from all departments
- own_department: Only receive staffing notifications from own department
Defaults to all_departments for backward compatibility.';
