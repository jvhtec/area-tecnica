CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(23);

SELECT function_privs_are(
  'public',
  'save_hoja_de_ruta',
  ARRAY['uuid', 'integer', 'jsonb'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the guarded aggregate save RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.save_hoja_de_ruta(uuid, integer, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_hoja_de_ruta(uuid)', 'EXECUTE'),
  'anonymous users cannot call Hoja aggregate RPCs'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES ('assignment.removed', 'Assignment removed', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

DELETE FROM public.hoja_de_ruta
WHERE job_id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.job_assignments
WHERE job_id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.jobs
WHERE id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.profiles
WHERE id IN (
  'db100000-0000-0000-0000-000000000001'::uuid,
  'db100000-0000-0000-0000-000000000002'::uuid,
  'db100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM auth.users
WHERE id IN (
  'db100000-0000-0000-0000-000000000001'::uuid,
  'db100000-0000-0000-0000-000000000002'::uuid,
  'db100000-0000-0000-0000-000000000003'::uuid
);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('job.updated', 'Job updated', 'management', 'info', false),
  ('job.deleted', 'Job deleted', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('assignment.updated', 'Assignment updated', 'management', 'info', false),
  ('assignment.removed', 'Assignment removed', 'management', 'info', false),
  ('hoja.updated', 'Hoja updated', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT
  fixture.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.email,
  'test',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
FROM (VALUES
  ('db100000-0000-0000-0000-000000000001'::uuid, 'hoja-manager@test.local'),
  ('db100000-0000-0000-0000-000000000002'::uuid, 'hoja-tech@test.local'),
  ('db100000-0000-0000-0000-000000000003'::uuid, 'hoja-outsider@test.local')
) AS fixture(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('db100000-0000-0000-0000-000000000001'::uuid, 'hoja-manager@test.local', 'Hoja', 'Manager', 'management', 'production'),
  ('db100000-0000-0000-0000-000000000002'::uuid, 'hoja-tech@test.local', 'Tech', 'Assigned', 'technician', 'sound'),
  ('db100000-0000-0000-0000-000000000003'::uuid, 'hoja-outsider@test.local', 'Tech', 'Outside', 'technician', 'lights')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES
  ('db200000-0000-0000-0000-000000000001'::uuid, 'Hoja hardening one', '2032-02-01 09:00:00+01', '2032-02-01 23:00:00+01', 'single'),
  ('db200000-0000-0000-0000-000000000002'::uuid, 'Hoja hardening two', '2032-02-02 09:00:00+01', '2032-02-02 23:00:00+01', 'single');

INSERT INTO public.job_assignments (job_id, technician_id, status, sound_role)
VALUES (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db100000-0000-0000-0000-000000000002'::uuid,
  'confirmed',
  'SND-PA'
);

CREATE TEMP TABLE hoja_hardening_payloads (
  name text PRIMARY KEY,
  payload jsonb NOT NULL
);

GRANT SELECT ON hoja_hardening_payloads TO authenticated;

INSERT INTO hoja_hardening_payloads (name, payload)
VALUES
  (
    'job_one_initial',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Evento uno',
        'eventDates', '1 febrero 2032',
        'contacts', jsonb_build_array(
          jsonb_build_object(
            'id', 'db300000-0000-0000-0000-000000000001',
            'name', 'Contacto eliminado',
            'role', 'Produccion',
            'sort_order', 0
          ),
          jsonb_build_object(
            'id', 'db300000-0000-0000-0000-000000000002',
            'name', 'Contacto conservado',
            'role', 'Promotor',
            'sort_order', 1
          )
        ),
        'staff', jsonb_build_array(
          jsonb_build_object(
            'id', 'db400000-0000-0000-0000-000000000001',
            'technician_id', 'db100000-0000-0000-0000-000000000002',
            'name', 'Tech',
            'surname1', 'Assigned',
            'position', 'SND-PA',
            'dni', '12345678Z',
            'sort_order', 0
          )
        ),
        'logistics', jsonb_build_object(
          'loadingDetails', '',
          'unloadingDetails', '',
          'equipmentLogistics', '',
          'transport', '[]'::jsonb
        )
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', jsonb_build_array(
        jsonb_build_object(
          'id', 'db500000-0000-0000-0000-000000000001',
          'hotel_name', 'Hotel test',
          'address', 'Madrid',
          'sort_order', 0,
          'rooms', jsonb_build_array(
            jsonb_build_object(
              'id', 'db600000-0000-0000-0000-000000000001',
              'room_type', 'single',
              'room_number', '101',
              'staff_member1_hoja_staff_id', 'db400000-0000-0000-0000-000000000001',
              'sort_order', 0
            )
          )
        )
      ),
      'images', '[]'::jsonb
    )
  ),
  (
    'job_one_update',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Evento uno actualizado',
        'contacts', jsonb_build_array(
          jsonb_build_object(
            'id', 'db300000-0000-0000-0000-000000000002',
            'name', 'Contacto actualizado',
            'role', 'Promotor',
            'sort_order', 0
          )
        ),
        'staff', jsonb_build_array(
          jsonb_build_object(
            'id', 'db400000-0000-0000-0000-000000000001',
            'technician_id', 'db100000-0000-0000-0000-000000000002',
            'name', 'Tech',
            'surname1', 'Assigned',
            'position', 'SND-PA',
            'dni', '12345678Z',
            'sort_order', 0
          )
        ),
        'logistics', jsonb_build_object('transport', '[]'::jsonb)
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', jsonb_build_array(
        jsonb_build_object(
          'id', 'db500000-0000-0000-0000-000000000001',
          'hotel_name', 'Hotel test',
          'address', 'Madrid',
          'sort_order', 0,
          'rooms', jsonb_build_array(
            jsonb_build_object(
              'id', 'db600000-0000-0000-0000-000000000001',
              'room_type', 'single',
              'room_number', '101',
              'staff_member1_hoja_staff_id', 'db400000-0000-0000-0000-000000000001',
              'sort_order', 0
            )
          )
        )
      ),
      'images', '[]'::jsonb
    )
  ),
  (
    'job_two',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Evento dos',
        'contacts', jsonb_build_array(
          jsonb_build_object(
            'id', 'db300000-0000-0000-0000-000000000003',
            'name', 'Contacto ajeno',
            'role', 'Promotor',
            'sort_order', 0
          )
        ),
        'staff', '[]'::jsonb,
        'logistics', jsonb_build_object('transport', '[]'::jsonb)
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', '[]'::jsonb,
      'images', '[]'::jsonb
    )
  ),
  (
    'foreign_contact',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Evento uno intento ajeno',
        'contacts', jsonb_build_array(
          jsonb_build_object(
            'id', 'db300000-0000-0000-0000-000000000003',
            'name', 'Contacto ajeno',
            'role', 'Promotor',
            'sort_order', 0
          )
        ),
        'staff', '[]'::jsonb,
        'logistics', jsonb_build_object('transport', '[]'::jsonb)
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', '[]'::jsonb,
      'images', '[]'::jsonb
    )
  );

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'db100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       0,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_initial')
     ) $$,
  'management can create a Hoja through the aggregate save RPC'
);

SELECT is(
  (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'db200000-0000-0000-0000-000000000001'::uuid),
  1,
  'the first aggregate save creates document version 1'
);

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       1,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update')
     ) $$,
  'management can update a Hoja with the current version'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.hoja_de_ruta_contacts contact
    JOIN public.hoja_de_ruta hoja ON hoja.id = contact.hoja_de_ruta_id
    WHERE hoja.job_id = 'db200000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'aggregate save removes child rows omitted from the payload'
);

SELECT is(
  (SELECT name FROM public.hoja_de_ruta_contacts WHERE id = 'db300000-0000-0000-0000-000000000002'::uuid),
  'Contacto actualizado',
  'aggregate save updates the retained child row'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       1,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update')
     ) $$,
  '40001',
  NULL,
  'a stale expected version is rejected'
);

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000002'::uuid,
       0,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_two')
     ) $$,
  'management can create a second independent Hoja'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       2,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'foreign_contact')
     ) $$,
  '22023',
  'Un contacto pertenece a otra Hoja de Ruta',
  'a save cannot move a child row from another Hoja'
);

SELECT is(
  (
    SELECT hoja.job_id
    FROM public.hoja_de_ruta_contacts contact
    JOIN public.hoja_de_ruta hoja ON hoja.id = contact.hoja_de_ruta_id
    WHERE contact.id = 'db300000-0000-0000-0000-000000000003'::uuid
  ),
  'db200000-0000-0000-0000-000000000002'::uuid,
  'a rejected foreign child remains with its original Hoja'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'db100000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       2,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update')
     ) $$,
  '42501',
  'permission denied',
  'a technician cannot save a Hoja'
);

SELECT is(
  public.get_hoja_de_ruta('db200000-0000-0000-0000-000000000001'::uuid)->'staff',
  '[]'::jsonb,
  'the technician aggregate projection hides Hoja staff rows and DNI'
);

SELECT is(
  public.get_hoja_de_ruta('db200000-0000-0000-0000-000000000001'::uuid)
    #>> '{accommodations,0,rooms,0,staff_member1_name}',
  'Tech Assigned',
  'the technician projection keeps a safe room occupant name'
);

SELECT ok(
  NOT (
    public.get_hoja_de_ruta('db200000-0000-0000-0000-000000000001'::uuid)
      #> '{accommodations,0,rooms,0}'
  ) ? 'dni',
  'the technician room projection does not expose DNI'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'db100000-0000-0000-0000-000000000003', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.get_hoja_de_ruta('db200000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  'permission denied',
  'an unassigned technician cannot read the Hoja aggregate'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.hoja_de_ruta_staff
WHERE id = 'db400000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (
    SELECT staff_member1_hoja_staff_id
    FROM public.hoja_de_ruta_room_assignments
    WHERE id = 'db600000-0000-0000-0000-000000000001'::uuid
  ),
  NULL::uuid,
  'deleting Hoja staff clears room UUID references through ON DELETE SET NULL'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'db100000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'approved'
     ) $$,
  '22023',
  NULL,
  'status transitions cannot skip review'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'review'
     ) $$,
  'a draft Hoja can move to review'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'approved'
     ) $$,
  'a reviewed Hoja can be approved'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'final'
     ) $$,
  'an approved Hoja can be finalized'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       5,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update')
     ) $$,
  '22023',
  'La Hoja de Ruta está finalizada y no admite edición',
  'a final Hoja cannot be edited'
);

SELECT throws_ok(
  $$ SELECT public.replace_hoja_de_ruta_all(
       (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'db200000-0000-0000-0000-000000000001'::uuid),
       '[]'::jsonb,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$,
  '22023',
  'La Hoja de Ruta está finalizada y no admite edición',
  'the compatibility replacement RPC cannot edit a final Hoja'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.hoja_de_ruta
WHERE job_id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.job_assignments
WHERE job_id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.jobs
WHERE id IN (
  'db200000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000002'::uuid
);
DELETE FROM public.profiles
WHERE id IN (
  'db100000-0000-0000-0000-000000000001'::uuid,
  'db100000-0000-0000-0000-000000000002'::uuid,
  'db100000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM auth.users
WHERE id IN (
  'db100000-0000-0000-0000-000000000001'::uuid,
  'db100000-0000-0000-0000-000000000002'::uuid,
  'db100000-0000-0000-0000-000000000003'::uuid
);

SELECT * FROM finish();
