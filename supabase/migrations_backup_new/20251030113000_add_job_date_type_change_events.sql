-- Add push notification events for per-job date type changes
-- These are emitted when a single job's date type is set via the dashboard context menu

-- General job date type change event
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'jobdate.type.changed',
  'Job date type changed',
  'management',
  'info',
  TRUE,
  '{actor_name} marked {job_title} as {new_type} on {target_date}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Specific events for each job date type change
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  (
    'jobdate.type.changed.show',
    'Job date changed to Show',
    'management',
    'success',
    TRUE,
    '{actor_name} marked {job_title} as Show on {target_date}'
  ),
  (
    'jobdate.type.changed.rehearsal',
    'Job date changed to Rehearsal',
    'management',
    'info',
    TRUE,
    '{actor_name} marked {job_title} as Rehearsal on {target_date}'
  ),
  (
    'jobdate.type.changed.travel',
    'Job date changed to Travel',
    'management',
    'info',
    TRUE,
    '{actor_name} marked {job_title} as Travel on {target_date}'
  ),
  (
    'jobdate.type.changed.setup',
    'Job date changed to Setup',
    'management',
    'info',
    TRUE,
    '{actor_name} marked {job_title} as Setup on {target_date}'
  ),
  (
    'jobdate.type.changed.off',
    'Job date changed to Day Off',
    'management',
    'info',
    TRUE,
    '{actor_name} marked {job_title} as Day Off on {target_date}'
  )
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

