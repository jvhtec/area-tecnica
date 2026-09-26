CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(42);

SELECT has_column(
  'public',
  'hoja_de_ruta_staff',
  'department',
  'Hoja staff has durable department storage'
);

SELECT function_privs_are(
  'public',
  'save_hoja_de_ruta',
  ARRAY['uuid', 'integer', 'jsonb'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the guarded aggregate save RPC'
);

SELECT function_privs_are(
  'public',
  'save_hoja_de_ruta',
  ARRAY['uuid', 'integer', 'jsonb', 'uuid[]'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the explicit-image-deletion save RPC'
);

SELECT function_privs_are(
  'public',
  'set_hoja_de_ruta_status',
  ARRAY['uuid', 'text', 'integer'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the version-aware status RPC'
);

SELECT function_privs_are(
  'public',
  'publish_hoja_de_ruta_document',
  ARRAY['uuid', 'uuid', 'integer'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the version-aware publication RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.set_hoja_de_ruta_status(uuid, text)',
    'EXECUTE'
  )
    AND NOT has_function_privilege(
      'authenticated',
      'public.publish_hoja_de_ruta_document(uuid, uuid)',
      'EXECUTE'
    ),
  'authenticated clients cannot bypass version checks through legacy mutation signatures'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.save_hoja_de_ruta(uuid, integer, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_hoja_de_ruta(uuid)', 'EXECUTE'),
  'anonymous users cannot call Hoja aggregate RPCs'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.hoja_de_ruta', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.hoja_de_ruta_staff', 'SELECT'),
  'anonymous users have no direct Hoja table privileges'
);

SELECT function_privs_are(
  'public',
  'migrate_hoja_legacy_image_path',
  ARRAY['uuid', 'text', 'text'],
  'service_role',
  ARRAY['EXECUTE'],
  'only the service migration path can replace legacy image paths'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.migrate_hoja_legacy_image_path(uuid, text, text)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the legacy image migration RPC'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('assignment.removed', 'Assignment removed', 'management', 'info', false),
  ('document.deleted', 'Document deleted', 'management', 'info', false)
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
  ('document.uploaded', 'Document uploaded', 'management', 'info', false),
  ('document.deleted', 'Document deleted', 'management', 'info', false),
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
            'department', 'sound',
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
            'department', 'sound',
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

SELECT ok(
  public.can_manage_hoja('db200000-0000-0000-0000-000000000001'::uuid),
  'management role satisfies the centralized Hoja authorization helper'
);

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

INSERT INTO public.hoja_de_ruta_images (
  id,
  hoja_de_ruta_id,
  image_path,
  image_type,
  sort_order
)
SELECT
  'db700000-0000-0000-0000-000000000001'::uuid,
  id,
  'blob:legacy-unrecoverable',
  'venue',
  0
FROM public.hoja_de_ruta
WHERE job_id = 'db200000-0000-0000-0000-000000000001'::uuid;

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       1,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update'),
       ARRAY[NULL]::uuid[]
     ) $$,
  'management can update a Hoja with the current version'
);

SELECT is(
  (
    SELECT department
    FROM public.hoja_de_ruta_staff
    WHERE id = 'db400000-0000-0000-0000-000000000001'::uuid
  ),
  'sound',
  'the save overload persists staff department'
);

SELECT is(
  (
    SELECT image_path
    FROM public.hoja_de_ruta_images
    WHERE id = 'db700000-0000-0000-0000-000000000001'::uuid
  ),
  'blob:legacy-unrecoverable',
  'an omitted legacy transient image survives an unrelated save even with a null removal entry'
);

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       2,
       (SELECT payload FROM hoja_hardening_payloads WHERE name = 'job_one_update')
     ) $$,
  'a cached client can still save through the three-argument RPC'
);

SELECT is(
  (
    SELECT image_path
    FROM public.hoja_de_ruta_images
    WHERE id = 'db700000-0000-0000-0000-000000000001'::uuid
  ),
  'blob:legacy-unrecoverable',
  'the cached-client save signature cannot delete an omitted legacy image'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);

SELECT ok(
  public.migrate_hoja_legacy_image_path(
    'db700000-0000-0000-0000-000000000001'::uuid,
    'blob:legacy-unrecoverable',
    'hojas-de-ruta/db200000-0000-0000-0000-000000000001/legacy/db700000-0000-0000-0000-000000000001.jpg'
  ),
  'the service migration can replace a blob path when its original file is recovered'
);

SELECT is(
  (
    SELECT image_path
    FROM public.hoja_de_ruta_images
    WHERE id = 'db700000-0000-0000-0000-000000000001'::uuid
  ),
  'hojas-de-ruta/db200000-0000-0000-0000-000000000001/legacy/db700000-0000-0000-0000-000000000001.jpg',
  'the recovered blob row now points at durable storage'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'db100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"db100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

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
       3,
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

SELECT ok(
  NOT public.can_manage_hoja('db200000-0000-0000-0000-000000000001'::uuid),
  'technician role fails the centralized Hoja authorization helper'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.hoja_de_ruta
    WHERE job_id = 'db200000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'technicians cannot bypass the aggregate projection through direct table reads'
);

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
       'approved',
       3
     ) $$,
  '22023',
  NULL,
  'status transitions cannot skip review'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'review',
       2
     ) $$,
  '40001',
  'La Hoja de Ruta ha cambiado desde la última carga',
  'a stale editor cannot transition Hoja status'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'review',
       3
     ) $$,
  'a draft Hoja can move to review'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       4
     ) $$,
  'a reviewed Hoja can be approved'
);

INSERT INTO public.job_documents (
  id,
  job_id,
  file_name,
  file_path,
  file_type,
  file_size,
  uploaded_by,
  original_type,
  document_kind,
  visible_to_tech
) VALUES (
  'db800000-0000-0000-0000-000000000001'::uuid,
  'db200000-0000-0000-0000-000000000001'::uuid,
  'Hoja stale.pdf',
  'hojas-de-ruta/db200000-0000-0000-0000-000000000001/stale.pdf',
  'application/pdf',
  1,
  'db100000-0000-0000-0000-000000000001'::uuid,
  'pdf',
  'hoja_de_ruta',
  true
);

SELECT throws_ok(
  $$ SELECT public.publish_hoja_de_ruta_document(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'db800000-0000-0000-0000-000000000001'::uuid,
       4
     ) $$,
  '40001',
  'La Hoja de Ruta ha cambiado desde la última carga',
  'a stale editor cannot publish a canonical PDF'
);

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'db200000-0000-0000-0000-000000000001'::uuid,
       'final',
       5
     ) $$,
  'an approved Hoja can be finalized'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'db200000-0000-0000-0000-000000000001'::uuid,
       6,
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
