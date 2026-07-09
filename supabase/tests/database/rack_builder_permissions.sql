CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(31);

SELECT has_table('public', 'rack_builder_racks', 'rack builder racks table exists');
SELECT has_table('public', 'rack_builder_devices', 'rack builder devices table exists');
SELECT has_table('public', 'rack_builder_projects', 'rack builder projects table exists');
SELECT has_table('public', 'rack_builder_layout_items', 'rack builder layout items table exists');
SELECT has_column('public', 'rack_builder_projects', 'department', 'rack builder projects track department ownership');

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
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%rack_builder_can_%'
  ) = 10,
  'every rack_builder table policy delegates to shared rack builder access helpers'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.rack_builder_projects'::regclass
      AND conname = 'rack_builder_projects_department_check'
      AND pg_get_constraintdef(oid) ILIKE '%sound%'
      AND pg_get_constraintdef(oid) ILIKE '%lights%'
  ),
  'rack builder project departments are constrained to sound or lights'
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
      AND conname = 'rack_builder_panel_layout_ports_panel_layout_id_fkey'
      AND confrelid = 'public.rack_builder_panel_layouts'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%ON DELETE CASCADE%'
  ),
  'panel layout ports expose a direct panel layout foreign key for PostgREST embeds'
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
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rack_builder_validate_layout_item_semantics'
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=public, pg_temp']
  ),
  'rack layout item validation trigger function runs as a pinned security definer'
);

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '82400000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'rack-builder-placement@test.local',
  'test',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
), (
  '82400000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'rack-builder-lights@test.local',
  'test',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name, role, department)
VALUES (
  '82400000-0000-0000-0000-000000000001'::uuid,
  'rack-builder-placement@test.local',
  'Rack',
  'Builder',
  'house_tech',
  'sound'
), (
  '82400000-0000-0000-0000-000000000002'::uuid,
  'rack-builder-lights@test.local',
  'Rack',
  'Builder Lights',
  'house_tech',
  'lights'
)
ON CONFLICT (id) DO UPDATE
SET email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    department = excluded.department;

INSERT INTO public.rack_builder_device_categories (id, name)
VALUES ('82410000-0000-0000-0000-000000000001'::uuid, 'Placement Test Category')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rack_builder_devices (
  id,
  brand,
  model,
  rack_units,
  depth_mm,
  category_id,
  is_half_rack
) VALUES (
  '82410000-0000-0000-0000-000000000002'::uuid,
  'Placement',
  'Validator',
  2,
  200,
  '82410000-0000-0000-0000-000000000001'::uuid,
  false
)
ON CONFLICT (id) DO UPDATE
SET brand = excluded.brand,
    model = excluded.model,
    rack_units = excluded.rack_units,
    depth_mm = excluded.depth_mm,
    category_id = excluded.category_id,
    is_half_rack = excluded.is_half_rack;

INSERT INTO public.rack_builder_racks (id, name, rack_units, depth_mm, width)
VALUES ('82410000-0000-0000-0000-000000000003'::uuid, 'Placement Test Rack', 8, 600, 'single')
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    rack_units = excluded.rack_units,
    depth_mm = excluded.depth_mm,
    width = excluded.width;

INSERT INTO public.rack_builder_projects (id, name, department)
VALUES
  ('82410000-0000-0000-0000-000000000004'::uuid, 'Placement Test Project', 'sound'),
  ('82410000-0000-0000-0000-000000000006'::uuid, 'Placement Lights Project', 'lights')
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    department = excluded.department;

INSERT INTO public.rack_builder_layouts (id, project_id, rack_id, name)
VALUES (
  '82410000-0000-0000-0000-000000000005'::uuid,
  '82410000-0000-0000-0000-000000000004'::uuid,
  '82410000-0000-0000-0000-000000000003'::uuid,
  'Placement Test Layout'
), (
  '82410000-0000-0000-0000-000000000007'::uuid,
  '82410000-0000-0000-0000-000000000006'::uuid,
  '82410000-0000-0000-0000-000000000003'::uuid,
  'Placement Lights Layout'
)
ON CONFLICT (id) DO UPDATE
SET project_id = excluded.project_id,
    rack_id = excluded.rack_id,
    name = excluded.name;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '82400000-0000-0000-0000-000000000001', false);

SET ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.rack_builder_layout_items (
      layout_id,
      device_id,
      start_u,
      facing
    ) VALUES (
      '82410000-0000-0000-0000-000000000005'::uuid,
      '82410000-0000-0000-0000-000000000002'::uuid,
      1,
      'front'
    )
  $$,
  'authenticated sound users can insert valid equipment placements'
);

SELECT is(
  ARRAY(
    SELECT id
    FROM public.rack_builder_projects
    WHERE id IN (
      '82410000-0000-0000-0000-000000000004'::uuid,
      '82410000-0000-0000-0000-000000000006'::uuid
    )
    ORDER BY id
  ),
  ARRAY['82410000-0000-0000-0000-000000000004'::uuid],
  'sound rack builder users only see sound projects'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '82400000-0000-0000-0000-000000000002', false);

SET ROLE authenticated;

SELECT is(
  ARRAY(
    SELECT id
    FROM public.rack_builder_projects
    WHERE id IN (
      '82410000-0000-0000-0000-000000000004'::uuid,
      '82410000-0000-0000-0000-000000000006'::uuid
    )
    ORDER BY id
  ),
  ARRAY['82410000-0000-0000-0000-000000000006'::uuid],
  'lights rack builder users only see lights projects'
);

SELECT lives_ok(
  $$
    INSERT INTO public.rack_builder_layout_items (
      layout_id,
      device_id,
      start_u,
      facing
    ) VALUES (
      '82410000-0000-0000-0000-000000000007'::uuid,
      '82410000-0000-0000-0000-000000000002'::uuid,
      1,
      'front'
    )
  $$,
  'authenticated lights users can insert valid equipment placements'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DELETE FROM public.rack_builder_layout_items
WHERE layout_id IN (
  '82410000-0000-0000-0000-000000000005'::uuid,
  '82410000-0000-0000-0000-000000000007'::uuid
);

DELETE FROM public.rack_builder_layouts
WHERE id IN (
  '82410000-0000-0000-0000-000000000005'::uuid,
  '82410000-0000-0000-0000-000000000007'::uuid
);

DELETE FROM public.rack_builder_projects
WHERE id IN (
  '82410000-0000-0000-0000-000000000004'::uuid,
  '82410000-0000-0000-0000-000000000006'::uuid
);

DELETE FROM public.rack_builder_racks
WHERE id = '82410000-0000-0000-0000-000000000003'::uuid;

DELETE FROM public.rack_builder_devices
WHERE id = '82410000-0000-0000-0000-000000000002'::uuid;

DELETE FROM public.rack_builder_device_categories
WHERE id = '82410000-0000-0000-0000-000000000001'::uuid;

DELETE FROM public.profiles
WHERE id IN (
  '82400000-0000-0000-0000-000000000001'::uuid,
  '82400000-0000-0000-0000-000000000002'::uuid
);

DELETE FROM auth.users
WHERE id IN (
  '82400000-0000-0000-0000-000000000001'::uuid,
  '82400000-0000-0000-0000-000000000002'::uuid
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
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%rack_builder_can_use_tool%'
  ) = 8,
  'rack builder storage object policies gate both buckets and all mutations to rack builder users'
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
