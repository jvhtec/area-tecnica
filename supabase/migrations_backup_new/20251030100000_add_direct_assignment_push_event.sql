-- Add new push notification event for direct assignments
-- This allows configuring who receives notifications when management directly assigns technicians

-- Add the new event to the activity catalog
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'assignment.created',
  'Direct assignment created',
  'job_participants',
  'info',
  TRUE,
  '{actor_name} assigned {tech_name} to {job_title}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Update the existing 'assignment.created' if it exists with different meaning
-- and create our specific one for direct assignments
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'job.assignment.direct',
  'Direct job assignment',
  'job_participants',
  'success',
  TRUE,
  '{actor_name} directly assigned {tech_name} to {job_title}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Note: The push function handler and frontend will be updated to use 'job.assignment.direct'
-- This event is distinct from 'job.assignment.confirmed' which is used when a technician
-- confirms an invitation through the staffing workflow
