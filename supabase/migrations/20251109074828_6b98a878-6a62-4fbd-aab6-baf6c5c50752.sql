-- Register job requirements updated event for activity log and push routing
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'job.requirements.updated',
  'Job crew requirements updated',
  'job_participants',
  'info',
  TRUE,
  '{actor_name} adjusted crew requirements for {job_title}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  severity = EXCLUDED.severity,
  toast_enabled = EXCLUDED.toast_enabled,
  template = EXCLUDED.template;