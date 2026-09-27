-- Hoja de Ruta integrity invariants (20260927150000_hoja_de_ruta_integrity.sql):
-- every writer respects the final lock and moves document_version, workflow
-- columns change only through the workflow RPCs, approval needs a second
-- person after every edit, reopen is management-only and logged, crew only
-- reads currently approved content, and retired compatibility RPCs are gone.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(63);

-- ---------------------------------------------------------------------------
-- Surface
-- ---------------------------------------------------------------------------

SELECT hasnt_function('public', 'replace_hoja_de_ruta_all', 'the unversioned replacement RPC is gone');
SELECT hasnt_function('public', 'replace_hoja_de_ruta_transport', 'the ID-regenerating transport helper is gone');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.save_hoja_de_ruta(uuid, integer, jsonb)', 'EXECUTE'),
  'clients can no longer call the three-argument save core directly'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.purge_expired_hoja_dni(interval)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.purge_expired_hoja_dni(interval)', 'EXECUTE'),
  'only the service role can run the DNI retention purge'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public._hoja_touch(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.hoja_de_ruta_child_guard()', 'EXECUTE'),
  'integrity helpers are not PostgREST entry points'
);

SELECT set_eq(
  $$ SELECT tablename::text FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename IN ('hoja_de_ruta', 'power_requirement_tables') $$,
  ARRAY['hoja_de_ruta', 'power_requirement_tables'],
  'the editor realtime listeners have tables to listen to'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);

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
  ('dc100000-0000-0000-0000-000000000001'::uuid, 'hoja-int-manager@test.local'),
  ('dc100000-0000-0000-0000-000000000002'::uuid, 'hoja-int-reviewer@test.local'),
  ('dc100000-0000-0000-0000-000000000003'::uuid, 'hoja-int-tech@test.local'),
  ('dc100000-0000-0000-0000-000000000004'::uuid, 'hoja-int-namesake@test.local'),
  ('dc100000-0000-0000-0000-000000000005'::uuid, 'hoja-int-logistics@test.local'),
  ('dc100000-0000-0000-0000-000000000006'::uuid, 'hoja-int-disposable@test.local')
) AS fixture(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('dc100000-0000-0000-0000-000000000001'::uuid, 'hoja-int-manager@test.local', 'Int', 'Manager', 'management', 'production'),
  ('dc100000-0000-0000-0000-000000000002'::uuid, 'hoja-int-reviewer@test.local', 'Int', 'Reviewer', 'management', 'production'),
  ('dc100000-0000-0000-0000-000000000003'::uuid, 'hoja-int-tech@test.local', 'Ana', 'Lopez', 'technician', 'sound'),
  ('dc100000-0000-0000-0000-000000000004'::uuid, 'hoja-int-namesake@test.local', 'Ana', 'Lopez', 'technician', 'lights'),
  ('dc100000-0000-0000-0000-000000000005'::uuid, 'hoja-int-logistics@test.local', 'Int', 'Logistics', 'logistics', 'logistics')
ON CONFLICT (id) DO UPDATE
SET role = excluded.role,
    department = excluded.department,
    first_name = excluded.first_name,
    last_name = excluded.last_name;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES
  ('dc200000-0000-0000-0000-000000000001'::uuid, 'Integridad uno', '2032-03-01 09:00:00+01', '2032-03-01 23:00:00+01', 'single'),
  ('dc200000-0000-0000-0000-000000000002'::uuid, 'Integridad dry-hire', '2032-03-02 09:00:00+01', '2032-03-02 23:00:00+01', 'dryhire'),
  ('dc200000-0000-0000-0000-000000000003'::uuid, 'Integridad pasado', '2020-03-01 09:00:00+01', '2020-03-01 23:00:00+01', 'single');

INSERT INTO public.job_assignments (job_id, technician_id, status, sound_role)
VALUES (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'dc100000-0000-0000-0000-000000000003'::uuid,
  'confirmed',
  'SND-PA'
);

CREATE TEMP TABLE hoja_integrity_payloads (
  name text PRIMARY KEY,
  payload jsonb NOT NULL
);

GRANT SELECT ON hoja_integrity_payloads TO authenticated;

INSERT INTO hoja_integrity_payloads (name, payload)
VALUES
  (
    'base',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Integridad',
        'contacts', '[]'::jsonb,
        'staff', jsonb_build_array(
          jsonb_build_object(
            'id', 'dc400000-0000-0000-0000-000000000001',
            'technician_id', 'dc100000-0000-0000-0000-000000000003',
            'name', 'Ana',
            'surname1', 'Lopez',
            'dni', '12345678Z',
            'department', 'sound',
            'sort_order', 0
          ),
          jsonb_build_object(
            'id', 'dc400000-0000-0000-0000-000000000002',
            'name', 'Ana',
            'surname1', 'Lopez',
            'department', 'lights',
            'sort_order', 1
          )
        ),
        'logistics', jsonb_build_object('transport', '[]'::jsonb)
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', '[]'::jsonb,
      'images', '[]'::jsonb
    )
  ),
  (
    'minimal',
    jsonb_build_object(
      'eventData', jsonb_build_object(
        'eventName', 'Integridad',
        'contacts', '[]'::jsonb,
        'staff', jsonb_build_array(
          jsonb_build_object(
            'id', 'dc400000-0000-0000-0000-000000000003',
            'name', 'Past',
            'surname1', 'Crew',
            'dni', '87654321X',
            'sort_order', 0
          )
        ),
        'logistics', jsonb_build_object('transport', '[]'::jsonb)
      ),
      'travelArrangements', '[]'::jsonb,
      'accommodations', '[]'::jsonb,
      'images', '[]'::jsonb
    )
  );

CREATE TEMP TABLE hoja_integrity_marks (
  name text PRIMARY KEY,
  value integer NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON hoja_integrity_marks TO authenticated;

-- ---------------------------------------------------------------------------
-- Manager: aggregate save, dry-hire guard
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       0,
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'base'),
       ARRAY[]::uuid[]
     ) $$,
  'management creates the Hoja through the aggregate save'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000002'::uuid,
       0,
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'base'),
       ARRAY[]::uuid[]
     ) $$,
  '22023',
  'Los trabajos de dry-hire no tienen Hoja de Ruta',
  'a dry-hire job cannot get a Hoja'
);

-- ---------------------------------------------------------------------------
-- Direct writes move the version exactly once per transaction
-- ---------------------------------------------------------------------------

INSERT INTO hoja_integrity_marks
SELECT 'v_before_child', document_version
FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

INSERT INTO public.hoja_de_ruta_travel_arrangements (hoja_de_ruta_id, transportation_type, sort_order)
SELECT h.id, kind, n
FROM public.hoja_de_ruta h
CROSS JOIN (VALUES ('van', 0), ('plane', 1), ('train', 2)) AS t(kind, n)
WHERE h.job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  (SELECT value + 1 FROM hoja_integrity_marks WHERE name = 'v_before_child'),
  'a Tour Ops style multi-row child insert bumps the document version once'
);

SELECT throws_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       (SELECT value FROM hoja_integrity_marks WHERE name = 'v_before_child'),
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'base'),
       ARRAY[]::uuid[]
     ) $$,
  '40001',
  NULL,
  'an editor loaded before a direct child write gets a conflict instead of deleting it'
);

SELECT is(
  (SELECT count(*)::integer FROM public.hoja_de_ruta_travel_arrangements t
   JOIN public.hoja_de_ruta h ON h.id = t.hoja_de_ruta_id
   WHERE h.job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  3,
  'the direct child rows survive the rejected stale save'
);

UPDATE hoja_integrity_marks
SET value = (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
WHERE name = 'v_before_child';

UPDATE public.hoja_de_ruta
SET program_schedule_json = '[]'::jsonb
WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  (SELECT value + 1 FROM hoja_integrity_marks WHERE name = 'v_before_child'),
  'a direct content update of the Hoja row bumps the version'
);

SELECT throws_ok(
  $$ UPDATE public.hoja_de_ruta SET status = 'final'
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '42501',
  NULL,
  'status cannot be changed outside the workflow RPC'
);

SELECT throws_ok(
  $$ UPDATE public.hoja_de_ruta SET document_version = 999
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '42501',
  NULL,
  'document_version cannot be set directly'
);

SELECT throws_ok(
  $$ UPDATE public.hoja_de_ruta
     SET review_requested_by = 'dc100000-0000-0000-0000-000000000002'::uuid
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '42501',
  NULL,
  'review_requested_by cannot be changed directly'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SET ROLE service_role;

UPDATE public.hoja_de_ruta
SET review_requested_by = 'dc100000-0000-0000-0000-000000000006'::uuid
WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

SELECT lives_ok(
  $$ DELETE FROM auth.users
     WHERE id = 'dc100000-0000-0000-0000-000000000006'::uuid $$,
  'deleting a review requester is not blocked by the Hoja guard'
);

SELECT is(
  (SELECT review_requested_by FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  NULL::uuid,
  'the review requester foreign key clears through ON DELETE SET NULL'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Crew removal: technician_id only, never by name
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  $$ SELECT * FROM public.remove_assignment_with_timesheets(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'dc100000-0000-0000-0000-000000000003'::uuid
     ) $$,
  'management can remove a crew assignment'
);

SELECT is(
  (SELECT array_agg(id::text ORDER BY id) FROM public.hoja_de_ruta_staff s
   WHERE s.hoja_de_ruta_id = (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)),
  ARRAY['dc400000-0000-0000-0000-000000000002'],
  'crew removal deletes the linked staff row and keeps a namesake'
);

INSERT INTO public.job_assignments (job_id, technician_id, status, sound_role)
VALUES (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'dc100000-0000-0000-0000-000000000003'::uuid,
  'confirmed',
  'SND-PA'
);

-- ---------------------------------------------------------------------------
-- Workflow: four-eyes approval, approval invalidated by edits
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'review',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'the manager sends the Hoja to review'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  '42501',
  'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión',
  'the person who requested review cannot approve'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'a second manager approves'
);

INSERT INTO public.hoja_de_ruta_contacts (hoja_de_ruta_id, name, role, sort_order)
SELECT id, 'Contacto directo', 'Promotor', 0
FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT status || ':' || coalesce(approved_by::text, 'null')
   FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'review:null',
  'a direct child edit sends an approved Hoja back to review'
);

SELECT is(
  (SELECT review_requested_by FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'dc100000-0000-0000-0000-000000000002'::uuid,
  'the editor becomes the requester when approved content changes'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  '42501',
  'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión',
  'the editor cannot re-approve their own direct edit'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'a different manager approves the directly edited Hoja'
);

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'base'),
       ARRAY[]::uuid[]
     ) $$,
  'an approved Hoja can still be edited through the aggregate save'
);

SELECT is(
  (SELECT status || ':' || coalesce(approved_by::text, 'null')
   FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'review:null',
  'an aggregate save of approved content sends it back to review'
);

SELECT is(
  (SELECT review_requested_by FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'dc100000-0000-0000-0000-000000000001'::uuid,
  'the aggregate editor becomes the requester after approval is invalidated'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  '42501',
  'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión',
  'the aggregate editor cannot approve their own changes'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'a different manager re-approves the aggregate edit'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.activity_log
    WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid
      AND code = 'hoja.status.review'
      AND payload ->> 'reason' = 'edited_after_approval'
  ),
  'the approval reset is recorded in the activity log'
);

-- ---------------------------------------------------------------------------
-- Crew visibility
-- ---------------------------------------------------------------------------

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000003', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000003"}',
  false
);
SET ROLE authenticated;

SELECT is(
  public.get_hoja_de_ruta('dc200000-0000-0000-0000-000000000001'::uuid),
  NULL::jsonb,
  'an assigned technician does not read a Hoja still in review'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'the reviewer approves again'
);

INSERT INTO public.job_documents (
  id, job_id, file_name, file_path, file_type, file_size, uploaded_by,
  original_type, document_kind, visible_to_tech
) VALUES (
  'dc800000-0000-0000-0000-000000000001'::uuid,
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'Hoja integridad.pdf',
  'hojas-de-ruta/dc200000-0000-0000-0000-000000000001/integridad.pdf',
  'application/pdf',
  1,
  'dc100000-0000-0000-0000-000000000002'::uuid,
  'pdf',
  'hoja_de_ruta',
  false
);

SELECT lives_ok(
  $$ SELECT public.publish_hoja_de_ruta_document(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'dc800000-0000-0000-0000-000000000001'::uuid,
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'the approved Hoja is published'
);

SELECT ok(
  (SELECT visible_to_tech FROM public.job_documents WHERE id = 'dc800000-0000-0000-0000-000000000001'::uuid),
  'publication makes the uploaded PDF visible to crew in the same transaction'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000003', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000003"}',
  false
);
SET ROLE authenticated;

SELECT is(
  public.get_hoja_de_ruta('dc200000-0000-0000-0000-000000000001'::uuid) #>> '{main,event_name}',
  'Integridad',
  'the assigned technician reads the approved Hoja'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

UPDATE public.hoja_de_ruta
SET program_schedule_json = '[{"date":"2032-03-01","rows":[]}]'::jsonb
WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

SELECT is(
  (SELECT status FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'review',
  'editing a published approved Hoja sends the live aggregate back to review'
);

SELECT ok(
  (SELECT published_document_id = 'dc800000-0000-0000-0000-000000000001'::uuid
     FROM public.hoja_de_ruta
    WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'the last issued PDF remains the canonical published document during review'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000003', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000003"}',
  false
);
SET ROLE authenticated;

SELECT is(
  public.get_hoja_de_ruta('dc200000-0000-0000-0000-000000000001'::uuid),
  NULL::jsonb,
  'a published pointer never exposes newer in-review aggregate content to crew'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'a different manager re-approves the published Hoja after the edit'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000004', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000004"}',
  false
);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.get_hoja_de_ruta('dc200000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  'permission denied',
  'an unassigned technician is refused before learning whether a Hoja exists'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'final',
       0
     ) $$,
  '42501',
  'permission denied',
  'the status wrapper authorizes before revealing the document version'
);

SELECT throws_ok(
  $$ SELECT public.publish_hoja_de_ruta_document(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'dc800000-0000-0000-0000-000000000001'::uuid,
       0
     ) $$,
  '42501',
  'permission denied',
  'the publication wrapper authorizes before revealing the document version'
);

-- ---------------------------------------------------------------------------
-- Final lock on every writer
-- ---------------------------------------------------------------------------

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'final',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  'the approved Hoja is finalized'
);

SELECT throws_ok(
  $$ INSERT INTO public.hoja_de_ruta_travel_arrangements (hoja_de_ruta_id, transportation_type, sort_order)
     SELECT id, 'van', 9 FROM public.hoja_de_ruta
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '22023',
  'La Hoja de Ruta está finalizada y no admite edición',
  'a direct child insert cannot edit a final Hoja'
);

SELECT throws_ok(
  $$ UPDATE public.hoja_de_ruta SET program_schedule_json = '[]'::jsonb
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '22023',
  'La Hoja de Ruta está finalizada y no admite edición',
  'a direct parent update cannot edit a final Hoja'
);

SELECT throws_ok(
  $$ DELETE FROM public.hoja_de_ruta
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  '22023',
  'La Hoja de Ruta está finalizada y no admite edición',
  'a manager cannot delete a final Hoja directly'
);

SELECT lives_ok(
  $$ SELECT * FROM public.remove_assignment_with_timesheets(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'dc100000-0000-0000-0000-000000000003'::uuid
     ) $$,
  'removing crew from a job with a final Hoja still succeeds'
);

SELECT is(
  (SELECT count(*)::integer FROM public.hoja_de_ruta_staff s
   WHERE s.hoja_de_ruta_id = (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)),
  2,
  'the final Hoja keeps its issued staff list'
);

SELECT lives_ok(
  $$ DELETE FROM public.job_documents WHERE id = 'dc800000-0000-0000-0000-000000000001'::uuid $$,
  'deleting the published PDF of a final Hoja is not blocked by the lock'
);

SELECT is(
  (SELECT published_document_id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  NULL::uuid,
  'the referential action clears the published pointer'
);

-- ---------------------------------------------------------------------------
-- Reopen
-- ---------------------------------------------------------------------------

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000005', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000005"}',
  false
);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.reopen_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       'Cambio de conductor'
     ) $$,
  '42501',
  'permission denied',
  'the logistics role cannot reopen a final Hoja'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000001', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000001"}',
  false
);
SET ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.reopen_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       '   '
     ) $$,
  '22023',
  'Indica el motivo para reabrir la Hoja de Ruta',
  'reopening requires a reason'
);

SELECT throws_ok(
  $$ SELECT * FROM public.reopen_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       0,
       'Cambio de conductor'
     ) $$,
  '40001',
  NULL,
  'reopening a stale version is rejected'
);

SELECT is(
  (SELECT status FROM public.reopen_hoja_de_ruta(
     'dc200000-0000-0000-0000-000000000001'::uuid,
     (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
     'Cambio de conductor'
   )),
  'draft',
  'management reopens a final Hoja to draft'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.activity_log
    WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid
      AND code = 'hoja.status.reopened'
      AND payload ->> 'reason' = 'Cambio de conductor'
      AND payload ->> 'from' = 'final'
  ),
  'the reopen and its reason are logged'
);

SELECT lives_ok(
  $$ INSERT INTO public.hoja_de_ruta_travel_arrangements (hoja_de_ruta_id, transportation_type, sort_order)
     SELECT id, 'van', 9 FROM public.hoja_de_ruta
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  'a reopened Hoja is editable again'
);

-- ---------------------------------------------------------------------------
-- DNI retention
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000003'::uuid,
       0,
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'minimal'),
       ARRAY[]::uuid[]
     ) $$,
  'a Hoja for a past job can be saved'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SET ROLE service_role;

SELECT ok(
  public.purge_expired_hoja_dni() >= 1,
  'the retention purge clears expired DNI copies'
);

RESET ROLE;

SELECT is(
  (SELECT dni FROM public.hoja_de_ruta_staff WHERE id = 'dc400000-0000-0000-0000-000000000003'::uuid),
  NULL,
  'the past job DNI copy is gone'
);

SELECT is(
  (SELECT coalesce(dni, '') FROM public.hoja_de_ruta_staff WHERE id = 'dc400000-0000-0000-0000-000000000002'::uuid),
  '',
  'rows without a DNI stay empty'
);

SELECT ok(
  (SELECT dni FROM public.hoja_de_ruta_staff WHERE id = 'dc400000-0000-0000-0000-000000000001'::uuid) = '12345678Z',
  'an upcoming job keeps its DNI for accreditation'
);

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------

DELETE FROM public.hoja_de_ruta
WHERE job_id IN (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'dc200000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.job_assignments
WHERE job_id IN (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'dc200000-0000-0000-0000-000000000002'::uuid,
  'dc200000-0000-0000-0000-000000000003'::uuid
);
DELETE FROM public.jobs
WHERE id IN (
  'dc200000-0000-0000-0000-000000000001'::uuid,
  'dc200000-0000-0000-0000-000000000002'::uuid,
  'dc200000-0000-0000-0000-000000000003'::uuid
);

SELECT * FROM finish();
