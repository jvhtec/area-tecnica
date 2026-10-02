-- Disposable PR989 review database ONLY. No production credentials or delivery.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('cb910000-0000-0000-0000-000000000001', 'rest-tech@test.local', '{}', '{}', 'authenticated', 'authenticated'),
       ('cb910000-0000-0000-0000-000000000002', 'rest-manager@test.local', '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO activity_catalog (code, label, default_visibility, severity, toast_enabled)
SELECT code, code, 'management', 'info', false FROM unnest(ARRAY[
  'job.created', 'job.updated', 'job.deleted',
  'assignment.created', 'assignment.updated', 'assignment.removed',
  'staffing.offer.sent', 'staffing.offer.confirmed', 'staffing.offer.declined',
  'staffing.availability.sent', 'staffing.availability.confirmed', 'staffing.availability.declined',
  'timesheet.approved'
]) AS code
ON CONFLICT (code) DO NOTHING;
