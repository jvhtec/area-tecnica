-- Hoja de Ruta integrity invariants (20260927150000_hoja_de_ruta_integrity.sql):
-- every writer respects the final lock and moves document_version, workflow
-- columns change only through the workflow RPCs, approval needs a second
-- person after every edit, reopen is management-only and logged, crew only
-- reads currently approved content, and retired compatibility RPCs are gone.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(103);

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

SELECT ok(
  pg_get_functiondef('public._hoja_guard_child_hoja(uuid)'::regprocedure)
    ~* 'where h\.id = p_hoja_id\s+for update',
  'child writes lock the parent row before checking whether it is final'
);

SELECT ok(
  pg_get_functiondef('public._hoja_lock_external_edits(uuid[],jsonb)'::regprocedure)
    ~* 'order by h\.id\s+for update',
  'multi-Hoja external edits lock parent rows in deterministic UUID order'
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

INSERT INTO public.tours (id, name, created_by)
VALUES (
  'dc900000-0000-0000-0000-000000000001'::uuid,
  'Gira integridad Hoja',
  'dc100000-0000-0000-0000-000000000001'::uuid
);

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

-- The API service_role DB role cannot delete auth.users. Execute the FK action
-- as the test session owner while keeping the service-role JWT claim so nested
-- Hoja guards still see a trusted caller.
RESET ROLE;

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
  $$ INSERT INTO public.hoja_de_ruta_contacts (hoja_de_ruta_id, name, role, sort_order)
     SELECT id, 'Editado durante review', 'Promotor', 0
     FROM public.hoja_de_ruta
     WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid $$,
  'a second manager can edit content while the Hoja is already in review'
);

SELECT has_function(
  'public', 'save_tour_ops_hoja_program',
  ARRAY['uuid', 'integer', 'jsonb'],
  'Tour Ops Programa uses a version-aware Hoja RPC'
);

SELECT has_function(
  'public', 'save_tour_ops_travel',
  ARRAY['uuid', 'text', 'uuid', 'uuid', 'uuid', 'text', 'jsonb', 'timestamp with time zone', 'jsonb', 'jsonb'],
  'Tour Ops travel has one transactional bridge RPC'
);

SELECT has_function(
  'public', 'save_tour_ops_accommodation',
  ARRAY['uuid', 'text', 'uuid', 'uuid', 'uuid', 'jsonb', 'timestamp with time zone', 'jsonb', 'jsonb', 'jsonb'],
  'Tour Ops accommodation and rooming have one transactional bridge RPC'
);

SELECT has_function(
  'public', 'save_tour_contacts_and_sync_hojas',
  ARRAY['uuid', 'timestamp with time zone', 'jsonb', 'jsonb'],
  'tour contacts sync through one optimistic transaction'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public._hoja_assert_tour_membership(uuid, uuid)',
    'EXECUTE'
  ),
  'the Tour Ops tour-membership guard is not a PostgREST entry point'
);

SELECT throws_ok(
  $$ SELECT public.save_tour_ops_travel(
       'dc900000-0000-0000-0000-000000000099'::uuid,
       'normalized',
       NULL::uuid,
       (SELECT id FROM public.hoja_de_ruta
        WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       NULL::uuid,
       'hoja_de_ruta_travel_arrangements',
       '{}'::jsonb,
       NULL::timestamptz,
       '{"transportation_type":"bus"}'::jsonb,
       '{"transportation_type":"van"}'::jsonb
     ) $$,
  '22023',
  'La Hoja de Ruta no pertenece a esta gira',
  'Tour Ops cannot attach a Hoja from another tour'
);

SELECT set_eq(
  $$ SELECT table_name || '.' || column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (table_name, column_name) IN (
         ('hoja_de_ruta_travel_arrangements', 'source_tour_travel_segment_id'),
         ('tour_travel_segments', 'source_hoja_travel_arrangement_id'),
         ('hoja_de_ruta_accommodations', 'source_tour_accommodation_id'),
         ('tour_accommodations', 'source_hoja_accommodation_id'),
         ('hoja_de_ruta_contacts', 'source_tour_contact_id')
       ) $$,
  ARRAY[
    'hoja_de_ruta_travel_arrangements.source_tour_travel_segment_id',
    'tour_travel_segments.source_hoja_travel_arrangement_id',
    'hoja_de_ruta_accommodations.source_tour_accommodation_id',
    'tour_accommodations.source_hoja_accommodation_id',
    'hoja_de_ruta_contacts.source_tour_contact_id'
  ],
  'Tour Ops and Hoja rows have stable cross-system identities'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname IN (
       'Authenticated users can view job documents',
       'Users can view job documents',
       'Users can upload job documents',
       'Users can update job documents',
       'Users can delete job documents'
     )),
  0,
  'broad authenticated job-documents storage policies are removed'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE 'p_storage_job_documents_authorized_%'),
  4,
  'job-documents storage has one scoped policy per CRUD class'
);

SELECT has_trigger(
  'public', 'job_documents', 'trg_protect_published_hoja_document',
  'published Hoja metadata is protected from generic document CRUD'
);

SELECT is(
  (SELECT review_requested_by FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'dc100000-0000-0000-0000-000000000002'::uuid,
  'editing content during review transfers review ownership to that editor'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  '42501',
  'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión',
  'an editor cannot approve content they changed while it was already in review'
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
  'the original manager can approve after the second manager edits the review'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

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
  $$ SELECT * FROM public.save_hoja_de_ruta(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       (SELECT payload FROM hoja_integrity_payloads WHERE name = 'base'),
       ARRAY[]::uuid[]
     ) $$,
  'a different manager can save aggregate edits while the Hoja is already in review'
);

SELECT is(
  (SELECT review_requested_by FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'dc100000-0000-0000-0000-000000000002'::uuid,
  'aggregate edits during review transfer review ownership to the latest editor'
);

SELECT throws_ok(
  $$ SELECT * FROM public.set_hoja_de_ruta_status(
       'dc200000-0000-0000-0000-000000000001'::uuid,
       'approved',
       (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
     ) $$,
  '42501',
  'Otra persona debe aprobar la Hoja de Ruta que enviaste a revisión',
  'the latest aggregate editor cannot approve their own review changes'
);

INSERT INTO public.hoja_de_ruta_accommodations (
  id, hoja_de_ruta_id, hotel_name, address, sort_order
)
SELECT
  'dc700000-0000-0000-0000-000000000001'::uuid,
  id,
  'Hotel Integridad',
  'Calle Integridad 1',
  0
FROM public.hoja_de_ruta
WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid;

INSERT INTO public.hoja_de_ruta_room_assignments (
  id, accommodation_id, room_type, room_number, staff_member1_id, sort_order
) VALUES (
  'dc710000-0000-0000-0000-000000000001'::uuid,
  'dc700000-0000-0000-0000-000000000001'::uuid,
  'single',
  '205',
  'Invitado externo',
  0
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
  'a different manager approves the latest aggregate review edit'
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

SELECT ok(
  (SELECT read_only FROM public.job_documents WHERE id = 'dc800000-0000-0000-0000-000000000001'::uuid),
  'publication marks the canonical Hoja PDF read-only'
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

SELECT ok(
  public.can_read_job_document_storage(
    'hojas-de-ruta/dc200000-0000-0000-0000-000000000001/integridad.pdf'
  ),
  'an assigned technician can read the visible published Hoja object'
);

SELECT ok(
  public.can_write_job_document_storage(
    'incident-reports/dc200000-0000-0000-0000-000000000001/incidente.pdf'
  ),
  'an assigned technician can upload an incident report for their job'
);

SELECT is(
  public.get_hoja_de_ruta('dc200000-0000-0000-0000-000000000001'::uuid)
    #>> '{accommodations,0,rooms,0,staff_member1_name}',
  'Invitado externo',
  'crew projection preserves a current free-text room occupant when no canonical staff row exists'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'dc100000-0000-0000-0000-000000000002', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"dc100000-0000-0000-0000-000000000002"}',
  false
);
SET ROLE authenticated;

SELECT is(
  (public.save_tour_ops_hoja_program(
    (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
    (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
    '[{"date":"2032-03-01","rows":[{"id":"program-test","time":"10:00","item":"Load in","notify":true,"departments":["sound"]}]}]'::jsonb
  ) ->> 'approval_invalidated')::boolean,
  true,
  'Tour Ops Programa invalidates an approved Hoja through the same workflow boundary'
);

SELECT is(
  (SELECT status FROM public.hoja_de_ruta
   WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  'review',
  'editing a published approved Hoja sends the live aggregate back to review'
);

SELECT throws_ok(
  $$ SELECT public.save_tour_ops_hoja_program(
       (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       (SELECT document_version - 1 FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       '[]'::jsonb
     ) $$,
  '40001',
  'La Hoja de Ruta ha cambiado desde la última carga',
  'Tour Ops Programa rejects a stale Hoja version before writing'
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

SELECT ok(
  NOT public.can_read_job_document_storage(
    'hojas-de-ruta/dc200000-0000-0000-0000-000000000001/integridad.pdf'
  ),
  'an unassigned technician cannot read another job published Hoja object'
);

SELECT ok(
  NOT public.can_write_job_document_storage(
    'incident-reports/dc200000-0000-0000-0000-000000000001/incidente.pdf'
  ),
  'an unassigned technician cannot upload an incident report for another job'
);

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

SELECT throws_ok(
  $$ DELETE FROM public.job_documents WHERE id = 'dc800000-0000-0000-0000-000000000001'::uuid $$,
  '42501',
  'La Hoja de Ruta publicada solo se reemplaza desde su flujo de publicación',
  'generic document CRUD cannot delete the canonical published Hoja PDF'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SET ROLE service_role;

SELECT lives_ok(
  $$ DELETE FROM public.job_documents WHERE id = 'dc800000-0000-0000-0000-000000000001'::uuid $$,
  'service-role referential cleanup can still remove the published artifact'
);

SELECT is(
  (SELECT published_document_id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
  NULL::uuid,
  'the referential action clears the published pointer'
);

RESET ROLE;

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
-- Tour Ops <-> Hoja transactional bridge contracts
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  $$ SELECT public.save_tour_ops_travel(
       'dc900000-0000-0000-0000-000000000001'::uuid,
       'normalized',
       null,
       (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       null,
       'hoja_de_ruta_travel_arrangements',
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
       ),
       null,
       '{"transportation_type":"bus","departure_time":"2032-03-01T08:00:00+01","arrival_time":"2032-03-01T09:00:00+01","route_notes":"Contrato"}'::jsonb,
       '{"transportation_type":"van","pickup_address":"Base","departure_time":"2032-03-01T08:00:00+01","arrival_time":"2032-03-01T09:00:00+01","notes":"Contrato"}'::jsonb
     ) $$,
  'Tour Ops creates normalized travel and its Hoja row atomically'
);

SELECT is(
  (
    SELECT count(*)::text || ':' ||
           (SELECT count(*)::text
              FROM public.hoja_de_ruta_travel_arrangements hta
              WHERE hta.source_tour_travel_segment_id = t.id)
    FROM public.tour_travel_segments t
    WHERE t.tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid
    GROUP BY t.id
  ),
  '1:1',
  'the travel bridge creates exactly one normalized row and one linked Hoja row'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.tour_travel_segments t
    JOIN public.hoja_de_ruta_travel_arrangements hta
      ON hta.id = t.source_hoja_travel_arrangement_id
     AND hta.source_tour_travel_segment_id = t.id
    WHERE t.tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid
  ),
  'travel source identity is reciprocal instead of content-based'
);

SELECT lives_ok(
  $$ SELECT public.save_tour_ops_travel(
       'dc900000-0000-0000-0000-000000000001'::uuid,
       'normalized',
       (SELECT id FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1),
       (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       null,
       'hoja_de_ruta_travel_arrangements',
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
       ),
       (SELECT updated_at FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1),
       '{"transportation_type":"bus","departure_time":"2032-03-01T08:30:00+01","arrival_time":"2032-03-01T09:30:00+01","route_notes":"Editado"}'::jsonb,
       '{"transportation_type":"van","pickup_address":"Base 2","departure_time":"2032-03-01T08:30:00+01","arrival_time":"2032-03-01T09:30:00+01","notes":"Editado"}'::jsonb
     ) $$,
  'editing linked travel updates the stable pair'
);

SELECT is(
  (
    SELECT (SELECT count(*) FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid)::text
      || ':' ||
      (SELECT count(*)
         FROM public.hoja_de_ruta_travel_arrangements hta
         JOIN public.tour_travel_segments t ON t.id = hta.source_tour_travel_segment_id
        WHERE t.tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid)::text
  ),
  '1:1',
  'editing travel does not manufacture a second copy'
);

SELECT lives_ok(
  $$ SELECT public.delete_tour_ops_travel(
       (SELECT id FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1),
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
       ),
       (SELECT updated_at FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1)
     ) $$,
  'deleting normalized travel removes the linked Hoja copy in the same transaction'
);

SELECT is(
  (SELECT count(*)::integer FROM public.tour_travel_segments WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid),
  0,
  'no Tour Ops ghost travel row remains after deletion'
);

SELECT lives_ok(
  $$ SELECT public.save_tour_ops_accommodation(
       'dc900000-0000-0000-0000-000000000001'::uuid,
       'normalized',
       null,
       (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
       null,
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
       ),
       null,
       '{"hotel_name":"Hotel contrato","check_in_date":"2032-03-01","check_out_date":"2032-03-02","room_allocation":[],"rooms_booked":1,"status":"planned"}'::jsonb,
       '{"hotel_name":"Hotel contrato","address":"Calle contrato 1","check_in":"2032-03-01T15:00:00+01","check_out":"2032-03-02T10:00:00+01"}'::jsonb,
       '[{"id":"dc720000-0000-0000-0000-000000000001","room_type":"single","room_number":"301","staff_member1_id":"Invitado contractual","sort_order":0}]'::jsonb
     ) $$,
  'Tour Ops saves hotel and rooming as one Hoja-aware transaction'
);

SELECT is(
  (
    SELECT count(*)::text || ':' ||
           coalesce((
             SELECT r.staff_member1_id
             FROM public.hoja_de_ruta_room_assignments r
             JOIN public.hoja_de_ruta_accommodations ha ON ha.id = r.accommodation_id
             WHERE ha.source_tour_accommodation_id = a.id
             LIMIT 1
           ), '')
    FROM public.tour_accommodations a
    WHERE a.tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid
    GROUP BY a.id
  ),
  '1:Invitado contractual',
  'room replacement keeps a current free-text occupant inside the same transaction'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.tour_accommodations a
    JOIN public.hoja_de_ruta_accommodations ha
      ON ha.id = a.source_hoja_accommodation_id
     AND ha.source_tour_accommodation_id = a.id
    WHERE a.tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid
  ),
  'accommodation source identity is reciprocal'
);

SELECT lives_ok(
  $$ SELECT public.delete_tour_ops_accommodation(
       'normalized',
       (SELECT id FROM public.tour_accommodations WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1),
       null,
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid)
       ),
       (SELECT updated_at FROM public.tour_accommodations WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid LIMIT 1)
     ) $$,
  'deleting a normalized hotel removes its Hoja hotel and rooming atomically'
);

SELECT is(
  (SELECT count(*)::integer FROM public.tour_accommodations WHERE tour_id = 'dc900000-0000-0000-0000-000000000001'::uuid),
  0,
  'no normalized accommodation ghost remains after deletion'
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

SELECT throws_ok(
  $$ SELECT public._hoja_lock_external_edits(
       ARRAY[
         (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid)
       ],
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid),
         (SELECT document_version - 1 FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid)
       )
     ) $$,
  '40001',
  'La Hoja de Ruta ha cambiado desde la última carga',
  'a multi-Hoja external mutation rejects the whole operation when either snapshot is stale'
);

SELECT lives_ok(
  $$ SELECT public._hoja_lock_external_edits(
       ARRAY[
         (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT id FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid)
       ],
       jsonb_build_object(
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000001'::uuid),
         (SELECT id::text FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid),
         (SELECT document_version FROM public.hoja_de_ruta WHERE job_id = 'dc200000-0000-0000-0000-000000000003'::uuid)
       )
     ) $$,
  'the same multi-Hoja mutation accepts a complete current version map'
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
DELETE FROM public.tours WHERE id = 'dc900000-0000-0000-0000-000000000001'::uuid;

SELECT * FROM finish();
