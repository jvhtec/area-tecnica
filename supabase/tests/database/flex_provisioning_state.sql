CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(15);

SELECT has_table('public', 'flex_provisioning_operations', 'Provisioning operations are durable');
SELECT has_table('public', 'flex_provisioning_nodes', 'Provisioning nodes are durable');
SELECT has_column('public', 'flex_provisioning_operations', 'lease_expires_at', 'Operations have expiring leases');
SELECT has_column('public', 'flex_provisioning_operations', 'sequence_number', 'Operations persist allocated sequence numbers');
SELECT has_column('public', 'flex_provisioning_nodes', 'semantic_key', 'Nodes have stable semantic keys');
SELECT has_column('public', 'flex_provisioning_nodes', 'element_id', 'Known remote IDs survive tracking failures');
SELECT has_function('public', 'acquire_flex_provisioning_lease', ARRAY['text', 'text', 'text', 'integer', 'boolean'], 'Lease acquisition is exposed through one RPC');
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
  NOT has_function_privilege('anon', 'public.acquire_flex_provisioning_lease(text,text,text,integer,boolean)', 'EXECUTE'),
  'Anonymous callers cannot acquire provisioning leases'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.acquire_flex_provisioning_lease(text,text,text,integer,boolean)', 'EXECUTE'),
  'Authenticated callers cannot bypass the Edge authorization boundary'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.finish_flex_provisioning_lease(uuid,uuid,text,jsonb)', 'EXECUTE'),
  'Authenticated callers cannot forge provisioning completion'
);

SELECT * FROM finish();
