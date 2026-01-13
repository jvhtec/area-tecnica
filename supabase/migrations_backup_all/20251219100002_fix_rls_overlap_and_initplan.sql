-- =============================================================================
-- Advisor Performance Fixes (Part 3)
-- =============================================================================
-- 1) Remove remaining "multiple_permissive_policies" caused by overlap between
--    `TO public` and `TO authenticated` policies (PUBLIC applies to all roles).
-- 2) Reduce "auth_rls_initplan" warnings by wrapping auth.* calls as initplans:
--      auth.uid()  -> (select auth.uid())
--      auth.role() -> (select auth.role())
--      auth.jwt()  -> (select auth.jwt())
-- =============================================================================

-- =============================================================================
-- 1) Merge overlapping (public + authenticated) permissive policies into a single
--    `TO public` policy per action for affected tables.
-- =============================================================================

DO $$
DECLARE
  auth_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'authenticated');
  tbl record;

  auth_guard text := '((select auth.uid()) is not null)';

  public_has boolean;
  public_using text;
  public_check text;

  auth_has boolean;
  auth_using text;
  auth_check text;

  final_select text;
  final_insert_check text;
  final_update_using text;
  final_update_check text;
  final_delete_using text;

  pol record;
  new_policy_name text;
  name_base text;
  name_hash text;

  -- Helper to wrap auth.* calls as initplans
  -- (implemented inline via nested replace() calls)
BEGIN
  FOR tbl IN
    WITH relevant AS (
      SELECT
        c.relname AS table_name,
        p.polname,
        p.polcmd,
        p.polroles[1] AS role_oid,
        unnest(
          CASE p.polcmd
            WHEN 'r' THEN ARRAY['SELECT']
            WHEN 'a' THEN ARRAY['INSERT']
            WHEN 'w' THEN ARRAY['UPDATE']
            WHEN 'd' THEN ARRAY['DELETE']
            WHEN '*' THEN ARRAY['SELECT','INSERT','UPDATE','DELETE']
            ELSE ARRAY[]::text[]
          END
        ) AS action
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] IN (0, auth_oid)
    ),
    dup_actions AS (
      SELECT table_name
      FROM relevant
      GROUP BY table_name, action
      HAVING count(*) > 1
    )
    SELECT DISTINCT table_name FROM dup_actions ORDER BY table_name
  LOOP
    -- SELECT (USING)
    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO public_has, public_using
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = 0
        AND p.polcmd IN ('r', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO auth_has, auth_using
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = auth_oid
        AND p.polcmd IN ('r', '*')
    ) s;

    final_select := NULL;
    IF public_has AND auth_has THEN
      final_select := format('(%s) OR (%s AND (%s))', public_using, auth_guard, auth_using);
    ELSIF public_has THEN
      final_select := public_using;
    ELSIF auth_has THEN
      final_select := format('%s AND (%s)', auth_guard, auth_using);
    END IF;

    -- INSERT (WITH CHECK)
    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO public_has, public_check
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = 0
        AND p.polcmd IN ('a', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO auth_has, auth_check
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = auth_oid
        AND p.polcmd IN ('a', '*')
    ) s;

    final_insert_check := NULL;
    IF public_has AND auth_has THEN
      final_insert_check := format('(%s) OR (%s AND (%s))', public_check, auth_guard, auth_check);
    ELSIF public_has THEN
      final_insert_check := public_check;
    ELSIF auth_has THEN
      final_insert_check := format('%s AND (%s)', auth_guard, auth_check);
    END IF;

    -- UPDATE (USING + WITH CHECK)
    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', using_expr), ' OR '), 'true'),
      coalesce(string_agg(format('(%s)', check_expr), ' OR '), 'true')
    INTO public_has, public_using, public_check
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS using_expr,
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS check_expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = 0
        AND p.polcmd IN ('w', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', using_expr), ' OR '), 'true'),
      coalesce(string_agg(format('(%s)', check_expr), ' OR '), 'true')
    INTO auth_has, auth_using, auth_check
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS using_expr,
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS check_expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = auth_oid
        AND p.polcmd IN ('w', '*')
    ) s;

    final_update_using := NULL;
    final_update_check := NULL;
    IF public_has AND auth_has THEN
      final_update_using := format('(%s) OR (%s AND (%s))', public_using, auth_guard, auth_using);
      final_update_check := format('(%s) OR (%s AND (%s))', public_check, auth_guard, auth_check);
    ELSIF public_has THEN
      final_update_using := public_using;
      final_update_check := public_check;
    ELSIF auth_has THEN
      final_update_using := format('%s AND (%s)', auth_guard, auth_using);
      final_update_check := format('%s AND (%s)', auth_guard, auth_check);
    END IF;

    -- DELETE (USING)
    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO public_has, public_using
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = 0
        AND p.polcmd IN ('d', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO auth_has, auth_using
    FROM (
      SELECT
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'true'), '(select auth.uid())', '__WRAP_AUTH_UID__'),
                        'auth.uid()',
                        '(select auth.uid())'
                      ),
                      '__WRAP_AUTH_UID__',
                      '(select auth.uid())'
                    ),
                    '(select auth.role())',
                    '__WRAP_AUTH_ROLE__'
                  ),
                  'auth.role()',
                  '(select auth.role())'
                ),
                '__WRAP_AUTH_ROLE__',
                '(select auth.role())'
              ),
              '(select auth.jwt())',
              '__WRAP_AUTH_JWT__'
            ),
            'auth.jwt()',
            '(select auth.jwt())'
          ),
          '__WRAP_AUTH_JWT__',
          '(select auth.jwt())'
        ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = auth_oid
        AND p.polcmd IN ('d', '*')
    ) s;

    final_delete_using := NULL;
    IF public_has AND auth_has THEN
      final_delete_using := format('(%s) OR (%s AND (%s))', public_using, auth_guard, auth_using);
    ELSIF public_has THEN
      final_delete_using := public_using;
    ELSIF auth_has THEN
      final_delete_using := format('%s AND (%s)', auth_guard, auth_using);
    END IF;

    -- Drop all permissive single-role policies for roles {public, authenticated}
    FOR pol IN
      SELECT p.polname, p.polroles[1] AS role_oid
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] IN (0, auth_oid)
    LOOP
      EXECUTE format('drop policy if exists %I on public.%I;', pol.polname, tbl.table_name);
    END LOOP;

    -- Recreate merged policies as `TO public` (one per action where needed)
    IF final_select IS NOT NULL THEN
      name_hash := substring(md5(tbl.table_name || ':public:select:merged'), 1, 6);
      name_base := format('p_%s_public_select', tbl.table_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;
      EXECUTE format('create policy %I on public.%I as permissive for select to public using (%s);', new_policy_name, tbl.table_name, final_select);
    END IF;

    IF final_insert_check IS NOT NULL THEN
      name_hash := substring(md5(tbl.table_name || ':public:insert:merged'), 1, 6);
      name_base := format('p_%s_public_insert', tbl.table_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;
      EXECUTE format('create policy %I on public.%I as permissive for insert to public with check (%s);', new_policy_name, tbl.table_name, final_insert_check);
    END IF;

    IF final_update_using IS NOT NULL THEN
      name_hash := substring(md5(tbl.table_name || ':public:update:merged'), 1, 6);
      name_base := format('p_%s_public_update', tbl.table_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;
      EXECUTE format('create policy %I on public.%I as permissive for update to public using (%s) with check (%s);', new_policy_name, tbl.table_name, final_update_using, final_update_check);
    END IF;

    IF final_delete_using IS NOT NULL THEN
      name_hash := substring(md5(tbl.table_name || ':public:delete:merged'), 1, 6);
      name_base := format('p_%s_public_delete', tbl.table_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;
      EXECUTE format('create policy %I on public.%I as permissive for delete to public using (%s);', new_policy_name, tbl.table_name, final_delete_using);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 2) Wrap remaining auth.* calls in all public-schema policies (initplan friendly)
-- =============================================================================

DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '(select auth.uid())', '__WRAP_AUTH_UID__');
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, '__WRAP_AUTH_UID__', '(select auth.uid())');

      new_qual := replace(new_qual, '(select auth.role())', '__WRAP_AUTH_ROLE__');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
      new_qual := replace(new_qual, '__WRAP_AUTH_ROLE__', '(select auth.role())');

      new_qual := replace(new_qual, '(select auth.jwt())', '__WRAP_AUTH_JWT__');
      new_qual := replace(new_qual, 'auth.jwt()', '(select auth.jwt())');
      new_qual := replace(new_qual, '__WRAP_AUTH_JWT__', '(select auth.jwt())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '(select auth.uid())', '__WRAP_AUTH_UID__');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, '__WRAP_AUTH_UID__', '(select auth.uid())');

      new_check := replace(new_check, '(select auth.role())', '__WRAP_AUTH_ROLE__');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
      new_check := replace(new_check, '__WRAP_AUTH_ROLE__', '(select auth.role())');

      new_check := replace(new_check, '(select auth.jwt())', '__WRAP_AUTH_JWT__');
      new_check := replace(new_check, 'auth.jwt()', '(select auth.jwt())');
      new_check := replace(new_check, '__WRAP_AUTH_JWT__', '(select auth.jwt())');
    END IF;

    IF p.cmd IN ('SELECT', 'DELETE') THEN
      IF new_qual IS DISTINCT FROM p.qual THEN
        EXECUTE format('alter policy %I on %I.%I using (%s);', p.policyname, p.schemaname, p.tablename, new_qual);
      END IF;
    ELSIF p.cmd = 'INSERT' THEN
      IF new_check IS DISTINCT FROM p.with_check THEN
        EXECUTE format('alter policy %I on %I.%I with check (%s);', p.policyname, p.schemaname, p.tablename, new_check);
      END IF;
    ELSIF p.cmd = 'UPDATE' THEN
      IF new_qual IS DISTINCT FROM p.qual THEN
        EXECUTE format('alter policy %I on %I.%I using (%s);', p.policyname, p.schemaname, p.tablename, new_qual);
      END IF;
      IF new_check IS DISTINCT FROM p.with_check THEN
        EXECUTE format('alter policy %I on %I.%I with check (%s);', p.policyname, p.schemaname, p.tablename, new_check);
      END IF;
    ELSIF p.cmd = 'ALL' THEN
      IF new_qual IS DISTINCT FROM p.qual THEN
        EXECUTE format('alter policy %I on %I.%I using (%s);', p.policyname, p.schemaname, p.tablename, new_qual);
      END IF;
      IF new_check IS DISTINCT FROM p.with_check THEN
        EXECUTE format('alter policy %I on %I.%I with check (%s);', p.policyname, p.schemaname, p.tablename, new_check);
      END IF;
    END IF;
  END LOOP;
END $$;
