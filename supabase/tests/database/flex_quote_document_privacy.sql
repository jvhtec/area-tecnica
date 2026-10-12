-- Exercise metadata RLS and the Storage SELECT boundary used by downloads.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
BEGIN;
SELECT plan(31);

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled)
VALUES
  ('job.created', 'Job created', 'management', 'info', false),
  ('assignment.created', 'Assignment created', 'management', 'info', false),
  ('document.uploaded', 'Document uploaded', 'management', 'info', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, email, 'test',
  now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, 'authenticated', 'authenticated'
FROM (VALUES
  ('fa100000-0000-0000-0000-000000000001'::uuid, 'flex-privacy-manager@test.local'),
  ('fa100000-0000-0000-0000-000000000002'::uuid, 'flex-privacy-tech@test.local'),
  ('fa100000-0000-0000-0000-000000000003'::uuid, 'flex-privacy-outsider@test.local')
) AS fixture(id, email);

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES
  ('fa100000-0000-0000-0000-000000000001', 'flex-privacy-manager@test.local', 'Flex', 'Manager', 'management', 'sound'),
  ('fa100000-0000-0000-0000-000000000002', 'flex-privacy-tech@test.local', 'Flex', 'Tech', 'technician', 'sound'),
  ('fa100000-0000-0000-0000-000000000003', 'flex-privacy-outsider@test.local', 'Flex', 'Outsider', 'technician', 'sound')
ON CONFLICT (id) DO UPDATE SET role = excluded.role, department = excluded.department;

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES ('fa200000-0000-0000-0000-000000000001', 'Flex privacy fixture',
  '2032-03-01 09:00:00+01', '2032-03-01 23:00:00+01', 'single');
INSERT INTO public.job_assignments (job_id, technician_id, status, sound_role)
VALUES ('fa200000-0000-0000-0000-000000000001',
  'fa100000-0000-0000-0000-000000000002', 'confirmed', 'SND-PA');

-- Reconstruct pre-migration rows. Only this trigger is disabled, in a rollback
-- transaction; the authorization policies and other triggers stay in force.
ALTER TABLE public.job_documents DISABLE TRIGGER enforce_flex_quote_document_privacy;
INSERT INTO public.job_documents (id, job_id, file_name, file_path, uploaded_by, visible_to_tech)
SELECT id, 'fa200000-0000-0000-0000-000000000001'::uuid, label,
  prefix || '/fa200000-0000-0000-0000-000000000001/' || label,
  'fa100000-0000-0000-0000-000000000001'::uuid, visible
FROM (VALUES
  ('fa800000-0000-0000-0000-000000000001'::uuid, 'legacy-visible.pdf', 'flex-reports/presupuestos', true),
  ('fa800000-0000-0000-0000-000000000002'::uuid, 'legacy-hidden.pdf', 'flex-reports/presupuestos', false),
  ('fa800000-0000-0000-0000-000000000003'::uuid, 'manifest.pdf', 'flex-reports/sound-manifests', true),
  ('fa800000-0000-0000-0000-000000000004'::uuid, 'private.pdf', 'private', false),
  ('fa800000-0000-0000-0000-000000000005'::uuid, 'similar-prefix.pdf', 'flex-reports/presupuestos-extra', true)
) AS fixture(id, label, prefix, visible);
ALTER TABLE public.job_documents ENABLE TRIGGER enforce_flex_quote_document_privacy;

INSERT INTO storage.objects (bucket_id, name)
SELECT 'job-documents', file_path FROM public.job_documents
WHERE job_id = 'fa200000-0000-0000-0000-000000000001';

CREATE TEMP TABLE flex_privacy_before AS
SELECT id, to_jsonb(jd) - 'visible_to_tech' AS unchanged_columns
FROM public.job_documents jd WHERE job_id = 'fa200000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"fa100000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000001'),
  1::bigint, 'negative control: assigned technician can select a legacy visible quote before backfill');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name = 'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/legacy-visible.pdf'),
  1::bigint, 'negative control: the legacy visible quote passes the download Storage policy');
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Replay the data UPDATE from 20261009180000. This tests backfill semantics on
-- legacy rows, not migration execution/order (covered by migration_apply CI).
UPDATE public.job_documents
SET visible_to_tech = false
WHERE file_path LIKE 'flex-reports/presupuestos/%'
  AND visible_to_tech IS DISTINCT FROM false;

SELECT results_eq(
  $$SELECT visible_to_tech FROM public.job_documents
    WHERE job_id = 'fa200000-0000-0000-0000-000000000001' ORDER BY id$$,
  $$VALUES (false), (false), (true), (false), (true)$$,
  'backfill hides visible and already-hidden quotes while preserving unrelated visibility');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.job_documents jd JOIN flex_privacy_before b USING (id)
  WHERE to_jsonb(jd) - 'visible_to_tech' IS DISTINCT FROM b.unchanged_columns
), 'backfill preserves document identity, paths, uploader and all other metadata');
SELECT is((SELECT count(*) FROM public.job_documents
  WHERE file_path LIKE 'flex-reports/presupuestos/%' AND visible_to_tech),
  0::bigint, 'no existing quote remains visible after migration/backfill');
SELECT is((SELECT public FROM storage.buckets WHERE id = 'job-documents'),
  false, 'quote downloads use a private bucket and cannot bypass Storage RLS through public URLs');

-- Service publication must also be subject to the trigger, including explicit
-- true, an omitted visibility field and an explicit NULL before NOT NULL checks.
SET LOCAL ROLE service_role;
INSERT INTO public.job_documents (id, job_id, file_name, file_path, visible_to_tech)
VALUES
  ('fa800000-0000-0000-0000-000000000006', 'fa200000-0000-0000-0000-000000000001', 'new.pdf',
    'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/new.pdf', true),
  ('fa800000-0000-0000-0000-000000000007', 'fa200000-0000-0000-0000-000000000001', 'null.pdf',
    'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/null.pdf', null);
INSERT INTO public.job_documents (id, job_id, file_name, file_path)
VALUES ('fa800000-0000-0000-0000-000000000008', 'fa200000-0000-0000-0000-000000000001', 'default.pdf',
  'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/default.pdf');
SELECT results_eq(
  $$SELECT visible_to_tech FROM public.job_documents WHERE id IN (
    'fa800000-0000-0000-0000-000000000006', 'fa800000-0000-0000-0000-000000000007',
    'fa800000-0000-0000-0000-000000000008') ORDER BY id$$,
  $$VALUES (false), (false), (false)$$, 'service inserts cannot expose quotes through true, NULL or default visibility');
SELECT throws_ok($$INSERT INTO public.job_documents (job_id, file_name, file_path, visible_to_tech)
  VALUES ('fa200000-0000-0000-0000-000000000001', 'Duplicate manifest.pdf',
    'flex-reports/sound-manifests/fa200000-0000-0000-0000-000000000001/manifest.pdf', true)$$,
  '23505', NULL, 'service publication cannot insert duplicate manifest metadata after lease expiry');
SELECT is((SELECT count(*) FROM public.job_documents
  WHERE job_id = 'fa200000-0000-0000-0000-000000000001'
    AND file_path = 'flex-reports/sound-manifests/fa200000-0000-0000-0000-000000000001/manifest.pdf'),
  1::bigint, 'a rejected duplicate leaves the original manifest row intact');
SELECT lives_ok($$INSERT INTO public.job_documents (job_id, file_name, file_path, visible_to_tech)
  VALUES ('fa200000-0000-0000-0000-000000000001', 'New manifest version.pdf',
    'flex-reports/sound-manifests/fa200000-0000-0000-0000-000000000001/another-hash.pdf', true)$$,
  'the manifest unique index allows a new immutable version path');
SELECT lives_ok($$INSERT INTO public.job_documents (job_id, file_name, file_path, visible_to_tech)
  VALUES ('fa200000-0000-0000-0000-000000000001', 'Ordinary duplicate.pdf',
    'private/fa200000-0000-0000-0000-000000000001/private.pdf', false)$$,
  'the partial manifest index preserves duplicate-path inserts for ordinary documents');
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"fa100000-0000-0000-0000-000000000001"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.job_documents SET visible_to_tech = true WHERE id = 'fa800000-0000-0000-0000-000000000001';
SELECT is((SELECT visible_to_tech FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000001'),
  false, 'management cannot re-expose a quote through a visibility update');
UPDATE public.job_documents SET file_path = 'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/renamed.pdf',
  visible_to_tech = true WHERE id = 'fa800000-0000-0000-0000-000000000005';
SELECT is((SELECT visible_to_tech FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000005'),
  false, 'moving a visible non-quote into the quote namespace hides it');
UPDATE public.job_documents SET file_path = 'private/fa200000-0000-0000-0000-000000000001/moved.pdf'
WHERE id = 'fa800000-0000-0000-0000-000000000005';
SELECT is((SELECT visible_to_tech FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000005'),
  false, 'moving a quote out does not implicitly grant technician visibility');
UPDATE public.job_documents SET file_name = 'Manifest renamed.pdf' WHERE id = 'fa800000-0000-0000-0000-000000000003';
SELECT is((SELECT visible_to_tech FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000003'),
  true, 'updating Sound manifest metadata preserves technician visibility');

SELECT is((SELECT count(*) FROM public.job_documents
  WHERE job_id = 'fa200000-0000-0000-0000-000000000001' AND file_path LIKE 'flex-reports/presupuestos/%'),
  5::bigint, 'management retains SELECT access to backfilled and newly inserted quotes');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name LIKE 'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/%'),
  2::bigint, 'management retains quote download access through Storage RLS');
SELECT ok(public.can_read_job_document_storage(
  'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/legacy-visible.pdf'),
  'the download authorization helper allows management to read hidden quotes');
SELECT is((SELECT count(*) FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000003'),
  1::bigint, 'management retains Sound manifest metadata access');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"fa100000-0000-0000-0000-000000000002"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.job_documents
  WHERE job_id = 'fa200000-0000-0000-0000-000000000001' AND file_path LIKE 'flex-reports/presupuestos/%'),
  0::bigint, 'assigned technician cannot select any backfilled or newly inserted quote');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name LIKE 'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/%'),
  0::bigint, 'assigned technician cannot download quotes through the Storage SELECT boundary');
SELECT ok(NOT public.can_read_job_document_storage(
  'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/legacy-visible.pdf'),
  'knowing a quote path does not grant the technician download authorization');
SELECT is((SELECT count(*) FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000003'),
  1::bigint, 'positive control: assigned technician can still select the visible Sound manifest');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name = 'flex-reports/sound-manifests/fa200000-0000-0000-0000-000000000001/manifest.pdf'),
  1::bigint, 'positive control: assigned technician can still download the Sound manifest');
SELECT ok(public.can_read_job_document_storage(
  'flex-reports/sound-manifests/fa200000-0000-0000-0000-000000000001/manifest.pdf'),
  'the Storage helper permits the assigned technician to read the manifest');

SELECT lives_ok($$INSERT INTO public.job_documents (id, job_id, file_name, file_path, uploaded_by, visible_to_tech)
  VALUES ('fa800000-0000-0000-0000-000000000009', 'fa200000-0000-0000-0000-000000000001', 'spoof.pdf',
    'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/legacy-visible.pdf',
    'fa100000-0000-0000-0000-000000000002', true)$$,
  'the self-attributed metadata INSERT policy is exercised by an actual technician');
SELECT is((SELECT count(*) FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000009'),
  0::bigint, 'a duplicate quote metadata row cannot bypass privacy through self-attribution');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name = 'flex-reports/presupuestos/fa200000-0000-0000-0000-000000000001/legacy-visible.pdf'),
  0::bigint, 'duplicate technician metadata cannot promote a hidden quote object');

RESET ROLE;
SELECT is((SELECT visible_to_tech FROM public.job_documents WHERE id = 'fa800000-0000-0000-0000-000000000009'),
  false, 'the trigger also forces the technician-created duplicate quote private');
SELECT set_config('request.jwt.claim.sub', 'fa100000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"fa100000-0000-0000-0000-000000000003"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.job_documents WHERE job_id = 'fa200000-0000-0000-0000-000000000001'),
  0::bigint, 'an unassigned technician cannot select even the visible manifest');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'job-documents'
  AND name LIKE '%/fa200000-0000-0000-0000-000000000001/%'),
  0::bigint, 'an unassigned technician cannot download fixture documents');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
