CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(23);

SELECT has_table('public', 'rack_builder_racks', 'rack builder racks table exists');
SELECT has_table('public', 'rack_builder_devices', 'rack builder devices table exists');
SELECT has_table('public', 'rack_builder_projects', 'rack builder projects table exists');
SELECT has_table('public', 'rack_builder_layout_items', 'rack builder layout items table exists');

SELECT ok(
  (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'rack_builder_racks',
        'rack_builder_device_categories',
        'rack_builder_devices',
        'rack_builder_projects',
        'rack_builder_layouts',
        'rack_builder_connectors',
        'rack_builder_panel_layouts',
        'rack_builder_panel_layout_rows',
        'rack_builder_panel_layout_ports',
        'rack_builder_layout_items'
      )
  ),
  'RLS is enabled on every rack_builder table'
);

SELECT ok(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'rack_builder_%'
      AND cmd = 'ALL'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%current_user_department%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%sound%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%admin%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%management%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%is_admin_or_management%'
  ) = 10,
  'every rack_builder table policy is gated to sound/admin/management'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.rack_builder_projects', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.rack_builder_devices', 'INSERT, UPDATE, DELETE'),
  'anon has no direct rack_builder table access'
);

SELECT ok(
  (
    SELECT bool_and(has_table_privilege('authenticated', target_table, target_privilege))
    FROM unnest(ARRAY['public.rack_builder_projects', 'public.rack_builder_devices']) AS tables(target_table)
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privileges(target_privilege)
  ),
  'authenticated users have table grants before RLS filtering'
);

SELECT ok(
  (
    SELECT bool_and(has_table_privilege('service_role', target_table, target_privilege))
    FROM unnest(ARRAY['public.rack_builder_projects', 'public.rack_builder_devices']) AS tables(target_table)
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privileges(target_privilege)
  ),
  'service_role retains rack_builder table access for migration/backfill'
);

SELECT ok(
  to_regprocedure(
    'public.rack_builder_rpc_create_panel_layout(uuid,text,rack_builder_drawing_state,integer,rack_builder_device_facing,boolean,text,numeric,integer)'
  ) IS NOT NULL,
  'create panel layout RPC exists'
);

SELECT ok(
  to_regprocedure(
    'public.rack_builder_rpc_save_panel_layout(uuid,text,rack_builder_drawing_state,rack_builder_device_facing,boolean,text,jsonb,jsonb)'
  ) IS NOT NULL,
  'save panel layout RPC exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.rack_builder_rpc_create_panel_layout(uuid,text,rack_builder_drawing_state,integer,rack_builder_device_facing,boolean,text,numeric,integer)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.rack_builder_rpc_create_panel_layout(uuid,text,rack_builder_drawing_state,integer,rack_builder_device_facing,boolean,text,numeric,integer)',
    'EXECUTE'
  ),
  'create panel layout RPC is authenticated-only'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.rack_builder_rpc_save_panel_layout(uuid,text,rack_builder_drawing_state,rack_builder_device_facing,boolean,text,jsonb,jsonb)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.rack_builder_rpc_save_panel_layout(uuid,text,rack_builder_drawing_state,rack_builder_device_facing,boolean,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'save panel layout RPC is authenticated-only'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rack_builder_rpc_duplicate_panel_layout(uuid,uuid,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.rack_builder_rpc_duplicate_panel_layout(uuid,uuid,text)', 'EXECUTE'),
  'duplicate panel layout RPC is authenticated-only'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rack_builder_rpc_replace_panel_layout_rows(uuid,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.rack_builder_rpc_replace_panel_layout_rows(uuid,jsonb)', 'EXECUTE'),
  'replace panel layout rows RPC is authenticated-only'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.rack_builder_rpc_replace_panel_layout_ports(uuid,jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.rack_builder_rpc_replace_panel_layout_ports(uuid,jsonb)', 'EXECUTE'),
  'replace panel layout ports RPC is authenticated-only'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.rack_builder_panel_layout_ports'::regclass
      AND conname = 'rack_builder_panel_layout_ports_no_overlap_excl'
      AND pg_get_constraintdef(oid) ILIKE '%int4range%'
      AND pg_get_constraintdef(oid) ILIKE '%span_h%'
      AND pg_get_constraintdef(oid) ILIKE '%span_w%'
  ),
  'panel port overlap exclusion covers both row and hole spans'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.rack_builder_panel_layout_ports'::regclass
      AND tgname = 'rack_builder_trg_validate_panel_layout_port_geometry'
      AND NOT tgisinternal
  ),
  'panel port geometry validation trigger is installed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.rack_builder_layout_items'::regclass
      AND tgname = 'rack_builder_trg_validate_layout_item_semantics'
      AND NOT tgisinternal
  ),
  'rack layout item geometry validation trigger is installed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'rack-builder-device-images'
      AND public = true
  ),
  'rack builder device image bucket exists and is public'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'rack-builder-connector-images'
      AND public = true
  ),
  'rack builder connector image bucket exists and is public'
);

SELECT ok(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'rack_builder_%_images_%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%current_user_department%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%sound%'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%is_admin_or_management%'
  ) = 8,
  'rack builder storage object policies gate both buckets and all mutations'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'rack_builder_device_categories'
      AND indexname = 'rack_builder_device_categories_name_lower_idx'
      AND indexdef ILIKE '%lower(name)%'
  ),
  'device categories are unique by case-insensitive name for safe migration remapping'
);

SELECT * FROM finish();
