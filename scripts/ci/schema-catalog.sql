-- Read-only, stable-identity catalog for DB-06. Run with psql -XqAt.
-- No application rows, credentials, or function source leave the database.
-- Extension-owned objects are managed by the platform, not app migrations.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
WITH app_relations AS (
  SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
), app_functions AS (
  SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
), entries AS (
  SELECT 'policy' AS kind, format('%I.%I.%I', schemaname, tablename, policyname) AS identity,
    jsonb_build_object('command', cmd, 'permissive', permissive,
      'roles', (SELECT jsonb_agg(r ORDER BY r) FROM unnest(roles) r),
      'using', qual, 'check', with_check) AS value
  FROM pg_policies WHERE schemaname = 'public'
  UNION ALL
  SELECT 'relation', c.oid::regclass::text,
    jsonb_build_object('kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
      'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
      'options', (SELECT jsonb_agg(o ORDER BY o) FROM unnest(c.reloptions) o),
      'view_hash', CASE WHEN c.relkind IN ('v', 'm') THEN md5(pg_get_viewdef(c.oid, false)) END)
  FROM app_relations c
  UNION ALL
  SELECT 'function', p.oid::regprocedure::text,
    jsonb_build_object('owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
      'definition_hash', md5(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')))
  FROM app_functions p
  UNION ALL
  SELECT 'relation_grant', c.oid::regclass::text,
    coalesce((SELECT jsonb_agg(jsonb_build_object('role', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilege', a.privilege_type, 'grantable', a.is_grantable) ORDER BY a.grantee::regrole::text, a.privilege_type, a.is_grantable)
      FROM aclexplode(coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 's' ELSE 'r' END::"char", c.relowner))) a), '[]'::jsonb)
  FROM app_relations c
  UNION ALL
  SELECT 'function_grant', p.oid::regprocedure::text,
    coalesce((SELECT jsonb_agg(jsonb_build_object('role', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilege', a.privilege_type, 'grantable', a.is_grantable) ORDER BY a.grantee::regrole::text, a.privilege_type, a.is_grantable)
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a), '[]'::jsonb)
  FROM app_functions p
  UNION ALL
  SELECT 'column_grant', format('%s.%I', c.oid::regclass::text, att.attname),
    jsonb_agg(jsonb_build_object('role', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilege', a.privilege_type, 'grantable', a.is_grantable) ORDER BY a.grantee::regrole::text, a.privilege_type, a.is_grantable)
  FROM app_relations c JOIN pg_attribute att ON att.attrelid = c.oid
  CROSS JOIN LATERAL aclexplode(att.attacl) a
  WHERE att.attnum > 0 AND NOT att.attisdropped GROUP BY c.oid, att.attname
)
SELECT jsonb_build_object('format_version', 1, 'postgres_major', current_setting('server_version_num')::int / 10000,
  'objects', jsonb_agg(jsonb_build_object('kind', kind, 'identity', identity, 'value', value) ORDER BY kind, identity)) AS catalog
FROM entries;
COMMIT;
