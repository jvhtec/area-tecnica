-- Add changelog.updated event to activity_catalog for push notifications
-- This allows users to receive push notifications when changelog entries are added or updated

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES (
  'changelog.updated',
  'Changelog actualizado',
  'management',  -- Default visibility (handler broadcasts to all users regardless)
  'info',
  TRUE
)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  severity = EXCLUDED.severity,
  toast_enabled = EXCLUDED.toast_enabled;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Added changelog.updated event to activity_catalog';
END $$;
