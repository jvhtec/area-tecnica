CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
BEGIN;
SELECT plan(41);

-- Test effective ACLs, including inherited PUBLIC grants, for every RPC.
SELECT ok(NOT has_function_privilege(role_name, signature, 'EXECUTE'),
  role_name || ' cannot execute ' || signature)
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
CROSS JOIN (VALUES
  ('public.invoke_sound_manifest_sync()'),
  ('public.claim_sound_manifest_slot(uuid,uuid,uuid)'),
  ('public.release_sound_manifest_slot(uuid,uuid,uuid)')
) AS functions(signature);
SELECT ok(has_function_privilege('service_role', signature, 'EXECUTE'),
  'service_role can execute ' || signature)
FROM (VALUES
  ('public.invoke_sound_manifest_sync()'),
  ('public.claim_sound_manifest_slot(uuid,uuid,uuid)'),
  ('public.release_sound_manifest_slot(uuid,uuid,uuid)')
) AS functions(signature);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  WHERE p.oid IN ('public.invoke_sound_manifest_sync()'::regprocedure,
    'public.claim_sound_manifest_slot(uuid,uuid,uuid)'::regprocedure,
    'public.release_sound_manifest_slot(uuid,uuid,uuid)'::regprocedure)
    AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
), 'PUBLIC has no execute grant on any Sound manifest RPC');

SELECT ok((SELECT relrowsecurity FROM pg_class
  WHERE oid = 'public.sound_manifest_publication_leases'::regclass),
  'publication leases have RLS enabled');
SELECT ok(NOT has_table_privilege(role_name, 'public.sound_manifest_publication_leases', privilege),
  role_name || ' has no direct lease ' || privilege || ' grant')
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS privileges(privilege);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS privileges(privilege)
  WHERE NOT has_table_privilege('service_role', 'public.sound_manifest_publication_leases', privilege)
), 'service_role retains every required direct lease table privilege');

-- Evaluate dynamically so environments without pg_cron still verify the safe
-- default; do not invoke the wrapper or queue any external HTTP requests.
CREATE FUNCTION pg_temp.sound_manifest_is_unscheduled() RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE scheduled boolean;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN true; END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = ''sound-manifest-sync''
    OR command ILIKE ''%invoke_sound_manifest_sync%'')' INTO scheduled;
  RETURN NOT scheduled;
END;
$$;
SELECT ok(pg_temp.sound_manifest_is_unscheduled(),
  'a default migration/reset leaves the Sound manifest scheduler unscheduled');

-- JWT role forgery does not confer database privileges on an ordinary caller.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001')$$, '42501', NULL,
  'authenticated cannot claim a slot even with a forged service JWT role');
SELECT throws_ok($$SELECT public.release_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001')$$, '42501', NULL,
  'authenticated cannot release another worker slot');
SELECT throws_ok($$SELECT public.invoke_sound_manifest_sync()$$, '42501', NULL,
  'authenticated cannot invoke the service scheduler wrapper');
SELECT throws_ok($$SELECT * FROM public.sound_manifest_publication_leases$$, '42501', NULL,
  'authenticated cannot read publication lease tokens directly');
RESET ROLE;

-- Real service database role, with no service JWT needed by SECURITY INVOKER.
SELECT set_config('request.jwt.claim.role', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE service_role;
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001'), true,
  'service database role claims a new slot without a JWT');
SELECT is((SELECT expires_at FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  now() + interval '10 minutes', 'new slot has a ten-minute expiry');

SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000002'), false,
  'an active slot rejects contention with false, never SQL NULL');
SELECT is((SELECT token FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  'fb400000-0000-0000-0000-000000000001'::uuid, 'contention preserves the current owner token');
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001'), false,
  'reusing the active owner token cannot silently renew its lease');

SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000002',
  'fb400000-0000-0000-0000-000000000001'), true,
  'another sheet in the same job has an independent slot');
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000002', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001'), true,
  'the same sheet in another job has an independent slot');

SELECT public.release_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  1::bigint, 'a non-owner release cannot delete the live slot');

-- Force expiry instead of sleeping. NOW is fixed for this transaction, so the
-- replacement expiry can be compared exactly and the boundary is deterministic.
UPDATE public.sound_manifest_publication_leases SET expires_at = now() - interval '1 second'
WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
  AND sheet_id = 'fb300000-0000-0000-0000-000000000001';
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000002'), true, 'an expired slot can be reclaimed');
SELECT is((SELECT token FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  'fb400000-0000-0000-0000-000000000002'::uuid, 'takeover installs the new owner token');
SELECT is((SELECT expires_at FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  now() + interval '10 minutes', 'takeover refreshes the expiry');

SELECT public.release_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001');
SELECT is((SELECT token FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  'fb400000-0000-0000-0000-000000000002'::uuid, 'a stale owner cannot release the replacement lease');
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000001'), false,
  'a stale owner cannot reclaim the active replacement lease');

SELECT public.release_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM public.sound_manifest_publication_leases
  WHERE job_id = 'fb200000-0000-0000-0000-000000000001'
    AND sheet_id = 'fb300000-0000-0000-0000-000000000001'),
  0::bigint, 'the replacement owner can release its slot');
SELECT is((SELECT count(*) FROM public.sound_manifest_publication_leases
  WHERE job_id IN ('fb200000-0000-0000-0000-000000000001', 'fb200000-0000-0000-0000-000000000002')),
  2::bigint, 'release is isolated by both job and sheet even when other slots share the stale token');
SELECT is(public.claim_sound_manifest_slot(
  'fb200000-0000-0000-0000-000000000001', 'fb300000-0000-0000-0000-000000000001',
  'fb400000-0000-0000-0000-000000000003'), true,
  'a released slot is available immediately to the next worker');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
