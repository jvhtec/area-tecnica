-- Add push notification events for tour date type changes
-- This allows configuring who receives notifications when tour date types are changed

-- General tour date type change event
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'tourdate.type.changed',
  'Tour date type changed',
  'management',
  'info',
  TRUE,
  '{actor_name} changed tour date type for {location} from {old_type} to {new_type}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Specific events for each tour date type change
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  (
    'tourdate.type.changed.show',
    'Tour date changed to Show',
    'management',
    'success',
    TRUE,
    '{actor_name} changed {location} to a Show date'
  ),
  (
    'tourdate.type.changed.rehearsal',
    'Tour date changed to Rehearsal',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {location} to a Rehearsal date'
  ),
  (
    'tourdate.type.changed.travel',
    'Tour date changed to Travel',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {location} to a Travel day'
  ),
  (
    'tourdate.type.changed.setup',
    'Tour date changed to Setup',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {location} to a Setup date'
  ),
  (
    'tourdate.type.changed.off',
    'Tour date changed to Day Off',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {location} to a Day Off'
  )
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- ============================================================================
-- JOB TYPE CHANGE EVENTS
-- ============================================================================

-- General job type change event
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES (
  'job.type.changed',
  'Job type changed',
  'management',
  'info',
  TRUE,
  '{actor_name} changed job type for {job_title} from {old_type} to {new_type}'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Specific events for each job type change
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  (
    'job.type.changed.single',
    'Job changed to Single',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {job_title} to a Single job'
  ),
  (
    'job.type.changed.tour',
    'Job changed to Tour',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {job_title} to a Tour job'
  ),
  (
    'job.type.changed.festival',
    'Job changed to Festival',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {job_title} to a Festival job'
  ),
  (
    'job.type.changed.dryhire',
    'Job changed to Dry Hire',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {job_title} to a Dry Hire'
  ),
  (
    'job.type.changed.tourdate',
    'Job changed to Tour Date',
    'management',
    'info',
    TRUE,
    '{actor_name} changed {job_title} to a Tour Date'
  )
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  default_visibility = EXCLUDED.default_visibility,
  template = EXCLUDED.template;

-- Note: These events will be triggered from the frontend when:
-- - A tour date's tour_date_type field is updated (show, rehearsal, travel, setup, off)
-- - A job's job_type field is updated (single, tour, festival, dryhire, tourdate)
-- The push notification system will use the push_notification_routes table to determine recipients
