-- Every fixture is rolled back, including profiles, audit rows, and rates.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(63);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  ('dd100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'category-overtime-' || n || '@test.local', 'test', now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  'authenticated', 'authenticated'
FROM generate_series(1, 6) n;

INSERT INTO public.profiles (
  id, email, first_name, last_name, role, department, autonomo,
  seasonal_house_tech, seasonal_house_tech_start_date, seasonal_house_tech_end_date
)
VALUES
  ('dd100000-0000-0000-0000-000000000001', 'category-overtime-1@test.local', 'Overtime', 'Fixture 1', 'management', 'sound', true, false, null, null),
  ('dd100000-0000-0000-0000-000000000002', 'category-overtime-2@test.local', 'Overtime', 'Fixture 2', 'admin', 'sound', true, false, null, null),
  ('dd100000-0000-0000-0000-000000000003', 'category-overtime-3@test.local', 'Overtime', 'Fixture 3', 'technician', 'sound', true, false, null, null),
  ('dd100000-0000-0000-0000-000000000004', 'category-overtime-4@test.local', 'Overtime', 'Fixture 4', 'house_tech', 'sound', true, false, null, null),
  ('dd100000-0000-0000-0000-000000000005', 'category-overtime-5@test.local', 'Overtime', 'Fixture 5', 'house_tech', 'sound', true, true, '2026-10-01', '2026-10-31'),
  ('dd100000-0000-0000-0000-000000000006', 'category-overtime-6@test.local', 'Overtime', 'Fixture 6', 'technician', 'sound', true, false, null, null)
ON CONFLICT (id) DO UPDATE SET
  role = excluded.role, department = excluded.department, autonomo = true,
  seasonal_house_tech = excluded.seasonal_house_tech,
  seasonal_house_tech_start_date = excluded.seasonal_house_tech_start_date,
  seasonal_house_tech_end_date = excluded.seasonal_house_tech_end_date;

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('job.created', 'Job created', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type, status)
VALUES ('dd200000-0000-0000-0000-000000000001', 'Category overtime regression',
        '2026-10-02 08:00:00+02', '2026-10-04 23:00:00+02', 'single', 'Confirmado');

INSERT INTO public.custom_tech_rates (
  profile_id, base_day_eur, base_day_especialista_eur, base_day_responsable_eur,
  plus_10_12_eur, overtime_hour_eur, overtime_hour_especialista_eur,
  overtime_hour_responsable_eur
)
SELECT id, 180, 180, 200, 30, 15, 17, 20 FROM public.profiles
WHERE id IN ('dd100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000002', 'dd100000-0000-0000-0000-000000000003', 'dd100000-0000-0000-0000-000000000004', 'dd100000-0000-0000-0000-000000000005');

-- The management responsable fixture reproduces the reported overnight shift:
-- 08:00 to 04:15 next day, less a 300-minute break = 15.25 -> 15 hours.
INSERT INTO public.timesheets (
  id, job_id, technician_id, date, start_time, end_time, ends_next_day,
  break_minutes, category, is_active, status, approved_by_manager, amount_eur
)
VALUES
  ('dd300000-0000-0000-0000-000000000001', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001', '2026-10-03', '08:00', '23:00', false, 0, 'tecnico', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000002', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001', '2026-10-04', '08:00', '23:00', false, 0, 'especialista', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000003', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001', '2026-10-02', '08:00', '04:15', true, 300, 'responsable', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000004', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000002', '2026-10-03', '08:00', '23:00', false, 0, 'tecnico', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000005', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000002', '2026-10-04', '08:00', '23:00', false, 0, 'especialista', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000006', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000002', '2026-10-02', '08:00', '23:00', false, 0, 'responsable', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000007', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000003', '2026-10-03', '08:00', '23:00', false, 0, 'tecnico', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000008', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000003', '2026-10-04', '08:00', '23:00', false, 0, 'especialista', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000009', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000003', '2026-10-02', '08:00', '23:00', false, 0, 'responsable', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000010', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000004', '2026-10-03', '08:00', '23:00', false, 0, 'tecnico', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000004', '2026-10-04', '08:00', '23:00', false, 0, 'especialista', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000004', '2026-10-02', '08:00', '23:00', false, 0, 'responsable', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000013', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000005', '2026-10-03', '08:00', '23:00', false, 0, 'tecnico', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000005', '2026-10-04', '08:00', '23:00', false, 0, 'especialista', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000015', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000005', '2026-10-02', '08:00', '23:00', false, 0, 'responsable', true, 'approved', true, 0),
  ('dd300000-0000-0000-0000-000000000016', 'dd200000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000006', '2026-10-02', '08:00', '23:00', false, 0, 'responsable', true, 'draft', false, 0);

CREATE TEMP TABLE overtime_results AS
SELECT t.id, p.role, p.seasonal_house_tech, t.category,
       public.compute_timesheet_amount_2025(t.id, false) AS result
FROM public.timesheets t JOIN public.profiles p ON p.id = t.technician_id
WHERE t.job_id = 'dd200000-0000-0000-0000-000000000001' AND p.id <> 'dd100000-0000-0000-0000-000000000006';

-- Hand-derived expectations: base + 30 plus + three overtime hours;
-- seasonal profiles receive only those three overtime hours.
SELECT unnest(ARRAY[
       is((r.result #>> '{amount_breakdown,overtime_hour_eur}')::numeric, e.rate,
          e.label || ' uses its category overtime rate'),
       is((r.result #>> '{amount_breakdown,overtime_amount_eur}')::numeric, e.rate * 3,
          e.label || ' pays three overtime hours'),
       is((r.result ->> 'amount_eur')::numeric, e.total,
          e.label || ' keeps the expected base/plus or seasonal total')
       ])
FROM overtime_results r
JOIN (VALUES
  ('dd300000-0000-0000-0000-000000000001'::uuid, 'management tecnico', 15::numeric, 255::numeric),
  ('dd300000-0000-0000-0000-000000000002'::uuid, 'management especialista', 17::numeric, 261::numeric),
  ('dd300000-0000-0000-0000-000000000003'::uuid, 'management responsable', 20::numeric, 290::numeric),
  ('dd300000-0000-0000-0000-000000000004'::uuid, 'admin tecnico', 15::numeric, 255::numeric),
  ('dd300000-0000-0000-0000-000000000005'::uuid, 'admin especialista', 17::numeric, 261::numeric),
  ('dd300000-0000-0000-0000-000000000006'::uuid, 'admin responsable', 20::numeric, 290::numeric),
  ('dd300000-0000-0000-0000-000000000007'::uuid, 'technician tecnico', 15::numeric, 255::numeric),
  ('dd300000-0000-0000-0000-000000000008'::uuid, 'technician especialista', 17::numeric, 261::numeric),
  ('dd300000-0000-0000-0000-000000000009'::uuid, 'technician responsable', 20::numeric, 290::numeric),
  ('dd300000-0000-0000-0000-000000000010'::uuid, 'house_tech tecnico', 15::numeric, 255::numeric),
  ('dd300000-0000-0000-0000-000000000011'::uuid, 'house_tech especialista', 17::numeric, 261::numeric),
  ('dd300000-0000-0000-0000-000000000012'::uuid, 'house_tech responsable', 20::numeric, 290::numeric),
  ('dd300000-0000-0000-0000-000000000013'::uuid, 'seasonal house_tech tecnico', 15::numeric, 45::numeric),
  ('dd300000-0000-0000-0000-000000000014'::uuid, 'seasonal house_tech especialista', 17::numeric, 51::numeric),
  ('dd300000-0000-0000-0000-000000000015'::uuid, 'seasonal house_tech responsable', 20::numeric, 60::numeric)
) e(id, label, rate, total) ON e.id = r.id ORDER BY r.id;

SELECT is((SELECT (result #>> '{amount_breakdown,worked_hours}')::numeric FROM overtime_results WHERE id = 'dd300000-0000-0000-0000-000000000003'), 15.25::numeric, 'overnight shift subtracts the break before rounding');

SELECT is((SELECT (result #>> '{amount_breakdown,hours_rounded}')::numeric FROM overtime_results WHERE id = 'dd300000-0000-0000-0000-000000000003'), 15::numeric, 'overnight shift retains whole-hour rounding');

SELECT is((SELECT amount_eur FROM public.timesheets WHERE id = 'dd300000-0000-0000-0000-000000000003'), 0::numeric, 'preview calculation leaves the stored amount unchanged');

SELECT public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000003', true);

SELECT is((SELECT amount_eur FROM public.timesheets WHERE id = 'dd300000-0000-0000-0000-000000000003'), 290::numeric, 'persist saves 200 base plus 30 plus 60 overtime');

SELECT is((SELECT (amount_breakdown ->> 'overtime_amount_eur')::numeric FROM public.timesheets WHERE id = 'dd300000-0000-0000-0000-000000000003'), 60::numeric, 'persisted overtime matches the preview');

SELECT is((SELECT status::text FROM public.timesheets WHERE id = 'dd300000-0000-0000-0000-000000000003'), 'approved'::text, 'recalculation preserves approval status');

UPDATE public.custom_tech_rates SET overtime_hour_especialista_eur = null, overtime_hour_responsable_eur = null WHERE profile_id IN ('dd100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000004');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000003', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 15::numeric, 'management without an override retains legacy overtime');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000012', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 20::numeric, 'house-tech responsable retains the legacy 15-to-20 rule');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000002', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 15::numeric, 'management especialista falls back to the legacy rate');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000011', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 15::numeric, 'house-tech especialista falls back to the legacy rate');

UPDATE public.custom_tech_rates SET overtime_hour_responsable_eur = 0 WHERE profile_id = 'dd100000-0000-0000-0000-000000000002';

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000006', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 0::numeric, 'an explicit zero overtime rate is respected');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000006', false) #>> '{amount_breakdown,overtime_amount_eur}')::numeric, 0::numeric, 'a zero rate pays no overtime');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000006', false) ->> 'amount_eur')::numeric, 230::numeric, 'a zero rate still retains base and plus');

INSERT INTO public.rate_cards_2025 (category, base_day_eur, plus_10_12_eur, overtime_hour_eur) VALUES ('responsable', 220, 40, 25) ON CONFLICT (category) DO UPDATE SET base_day_eur = excluded.base_day_eur, plus_10_12_eur = excluded.plus_10_12_eur, overtime_hour_eur = excluded.overtime_hour_eur;

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000016', false) #>> '{amount_breakdown,overtime_hour_eur}')::numeric, 25::numeric, 'a profile without custom rates uses the category catalog');

SELECT is((public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000016', false) ->> 'amount_eur')::numeric, 335::numeric, 'catalog fallback includes base plus and overtime');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'dd100000-0000-0000-0000-000000000006', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000009', false)$$,
  '42501', 'permission denied', 'an unrelated technician cannot calculate another timesheet'
);
SELECT throws_ok(
  $$SELECT public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000009', true)$$,
  '42501', 'permission denied', 'an unrelated technician cannot persist another timesheet'
);
SELECT lives_ok(
  $$SELECT public.compute_timesheet_amount_2025('dd300000-0000-0000-0000-000000000016', false)$$,
  'a technician can still preview their own timesheet'
);
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
