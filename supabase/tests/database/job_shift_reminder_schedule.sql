CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.push_notification_schedules
    WHERE event_type = 'job.shift.reminder'
      AND schedule_time = '20:00:00'::time
      AND timezone = 'Europe/Madrid'
  ),
  'the shift reminder ships with an evening schedule'
);

SELECT lives_ok(
  $$UPDATE public.push_notification_schedules
    SET schedule_time = '21:30:00' WHERE event_type = 'job.shift.reminder'$$,
  'the shift reminder accepts an evening time'
);

SELECT throws_ok(
  $$UPDATE public.push_notification_schedules
    SET schedule_time = '09:00:00' WHERE event_type = 'job.shift.reminder'$$,
  '23514',
  NULL,
  'the shift reminder rejects a morning time'
);

INSERT INTO public.push_notification_schedules (event_type, schedule_time)
VALUES ('daily.morning.summary', '08:00:00')
ON CONFLICT (event_type) DO NOTHING;

SELECT throws_ok(
  $$UPDATE public.push_notification_schedules
    SET schedule_time = '20:00:00' WHERE event_type = 'daily.morning.summary'$$,
  '23514',
  NULL,
  'the morning summary keeps its 06:00-12:00 window'
);

SELECT lives_ok(
  $$UPDATE public.push_notification_schedules
    SET schedule_time = '07:30:00' WHERE event_type = 'daily.morning.summary'$$,
  'the morning summary still accepts a morning time'
);

SELECT * FROM finish();

ROLLBACK;
