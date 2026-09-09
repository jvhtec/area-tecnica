CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(21);

SELECT has_table('public', 'flex_provisioning_operations', 'Provisioning operations are durable');
SELECT has_table('public', 'flex_provisioning_nodes', 'Provisioning nodes are durable');
SELECT has_column('public', 'flex_provisioning_operations', 'lease_expires_at', 'Operations have expiring leases');
SELECT has_column('public', 'flex_provisioning_operations', 'sequence_number', 'Operations persist allocated sequence numbers');
SELECT has_column('public', 'flex_provisioning_nodes', 'semantic_key', 'Nodes have stable semantic keys');
SELECT has_column('public', 'flex_provisioning_nodes', 'element_id', 'Known remote IDs survive tracking failures');
SELECT has_function('public', 'acquire_flex_provisioning_lease', ARRAY['text', 'text', 'text', 'integer', 'boolean', 'uuid'], 'Lease acquisition is exposed through one RPC');
SELECT has_function('public', 'allocate_flex_provisioning_sequence', ARRAY['uuid', 'text', 'integer'], 'Sequence allocation is exposed through one RPC');
SELECT has_function('public', 'finish_flex_provisioning_lease', ARRAY['uuid', 'uuid', 'text', 'jsonb'], 'Lease completion is exposed through one RPC');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'flex_provisioning_operations'
      AND indexdef ILIKE '%UNIQUE%scope_key%'
  ),
  'Only one operation owns a scope key'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.allocate_flex_provisioning_sequence(uuid,text,integer)', 'EXECUTE'),
  'Only the service boundary can allocate provisioning sequences'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.flex_provisioning_nodes'::regclass
      AND contype = 'u' AND pg_get_constraintdef(oid) ILIKE '%operation_id%semantic_key%'
  ),
  'A semantic node can only be recorded once per operation'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'flex_folders'
      AND indexdef ILIKE '%UNIQUE%element_id%'
  ),
  'A remote Flex element can only have one local tracking row'
);

INSERT INTO public.flex_folders (element_id, folder_type)
VALUES ('f1000000-0000-4000-8000-000000000001', 'pgtap_unique_element');
SELECT throws_ok(
  $$
    INSERT INTO public.flex_folders (element_id, folder_type)
    VALUES ('f1000000-0000-4000-8000-000000000001', 'pgtap_duplicate_element')
  $$,
  '23505',
  NULL,
  'Duplicate remote Flex element IDs are rejected'
);
DELETE FROM public.flex_folders
WHERE element_id = 'f1000000-0000-4000-8000-000000000001';

SELECT ok(
  NOT has_function_privilege('anon', 'public.acquire_flex_provisioning_lease(text,text,text,integer,boolean,uuid)', 'EXECUTE'),
  'Anonymous callers cannot acquire provisioning leases'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.acquire_flex_provisioning_lease(text,text,text,integer,boolean,uuid)', 'EXECUTE'),
  'Authenticated callers cannot bypass the Edge authorization boundary'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.finish_flex_provisioning_lease(uuid,uuid,text,jsonb)', 'EXECUTE'),
  'Authenticated callers cannot forge provisioning completion'
);

SET ROLE service_role;
SELECT is(
  (SELECT acquired FROM public.acquire_flex_provisioning_lease(
    'pgtap:flex:service-key', 'job', 'service-key', 30, false, null
  )),
  true,
  'The service database role can acquire a lease without a legacy JWT claim'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO public.flex_provisioning_operations (scope_key, operation_type, scope_id, status, completed_at)
VALUES ('pgtap:flex:complete-expansion', 'job', 'complete-expansion', 'complete', now());
SELECT is(
  (SELECT acquired FROM public.acquire_flex_provisioning_lease(
    'pgtap:flex:complete-expansion', 'job', 'complete-expansion', 30, false, null
  )),
  true,
  'A completed scope can reopen to process newly added semantic nodes'
);

INSERT INTO public.flex_provisioning_operations (scope_key, operation_type, scope_id, status)
VALUES ('pgtap:flex:failed-retry', 'festival-artist-extras', 'failed-retry', 'failed');
SELECT is(
  (SELECT acquired FROM public.acquire_flex_provisioning_lease(
    'pgtap:flex:failed-retry', 'festival-artist-extras', 'failed-retry', 30, false, null
  )),
  true,
  'A pre-write artist extras failure can retry without reconciliation'
);

INSERT INTO public.flex_provisioning_operations (
  scope_key, operation_type, scope_id, status, lease_token, lease_expires_at
) VALUES (
  'pgtap:flex:expired-reconcile', 'job', 'expired-reconcile', 'running', gen_random_uuid(), now() - interval '1 minute'
);
SELECT is(
  (SELECT acquired FROM public.acquire_flex_provisioning_lease(
    'pgtap:flex:expired-reconcile', 'job', 'expired-reconcile', 30, true, null
  )),
  true,
  'An expired lease is reacquired immediately when reconciliation is requested'
);

DELETE FROM public.flex_provisioning_operations
WHERE scope_key IN ('pgtap:flex:service-key', 'pgtap:flex:complete-expansion', 'pgtap:flex:failed-retry', 'pgtap:flex:expired-reconcile');

SELECT * FROM finish();
