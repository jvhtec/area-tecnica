-- Add critical push notification events to activity catalog
-- This migration adds support for:
-- 1. Incident report uploads (safety-critical)
-- 2. Timesheet approval/rejection notifications
-- 3. Job deletion notifications
-- 4. Assignment removal notifications

-- Insert new activity catalog entries
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  -- Incident reports (safety-critical)
  (
    'incident.report.uploaded',
    'Reporte de incidencia',
    'management',
    'critical',
    TRUE,
    '{actor_name} reportó una incidencia en {job_title}: {file_name}'
  ),

  -- Timesheet approval/rejection
  (
    'timesheet.approved',
    'Parte aprobado',
    'job_participants',
    'success',
    TRUE,
    'Tu parte para {job_title} ha sido aprobado'
  ),
  (
    'timesheet.rejected',
    'Parte rechazado',
    'job_participants',
    'warn',
    TRUE,
    'Tu parte para {job_title} ha sido rechazado'
  ),

  -- Job deletion (critical workflow event)
  (
    'job.deleted',
    'Trabajo eliminado',
    'management',
    'warn',
    TRUE,
    '{actor_name} eliminó el trabajo {job_title}'
  ),

  -- Assignment removal (critical for technicians)
  (
    'assignment.removed',
    'Asignación eliminada',
    'job_participants',
    'warn',
    TRUE,
    '{actor_name} eliminó a {tech_name} de {job_title}'
  )
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  severity = EXCLUDED.severity,
  toast_enabled = EXCLUDED.toast_enabled,
  template = EXCLUDED.template;

-- Update the timesheet.approved event visibility (it was already in the catalog but with wrong visibility)
-- The original migration set it to 'job_participants' which is correct, keeping it
-- Just ensuring consistency

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'Successfully added 5 critical push notification events to activity catalog';
  RAISE NOTICE '  - incident.report.uploaded (safety-critical)';
  RAISE NOTICE '  - timesheet.approved';
  RAISE NOTICE '  - timesheet.rejected';
  RAISE NOTICE '  - job.deleted';
  RAISE NOTICE '  - assignment.removed';
END $$;
