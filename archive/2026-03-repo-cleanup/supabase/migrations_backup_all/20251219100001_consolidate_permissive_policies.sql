-- =============================================================================
-- Advisor Performance Fixes (Part 2)
-- =============================================================================
-- Consolidate duplicated PERMISSIVE RLS policies (Supabase Advisor lint 0006).
--
-- Strategy:
-- - Identify (table, role) pairs in `public` where an action (SELECT/INSERT/UPDATE/DELETE)
--   has more than one permissive policy once `FOR ALL` is expanded.
-- - For each impacted (table, role):
--   - Compute the effective OR'ed expressions per action from existing permissive policies.
--   - Drop all permissive single-role policies for that (table, role).
--   - Recreate at most 4 permissive policies (one per action present) that preserve behavior.
--
-- Notes:
-- - We only touch policies with exactly one role in `pg_policy.polroles`.
-- - For INSERT/UPDATE, when `WITH CHECK` is NULL we fall back to `USING` (matching Postgres
--   defaults for policies that don't specify an explicit `WITH CHECK`).
-- =============================================================================

DO $$
DECLARE
  rec record;

  role_name text;
  role_clause text;

  select_has boolean;
  select_using text;
  insert_has boolean;
  insert_check text;
  update_has boolean;
  update_using text;
  update_check text;
  delete_has boolean;
  delete_using text;

  pol record;
  new_policy_name text;
  name_base text;
  name_hash text;
BEGIN
  FOR rec IN
    WITH expanded AS (
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        p.polname AS policy_name,
        p.polcmd AS polcmd,
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
    ),
    duplicate_actions AS (
      SELECT schema_name, table_name, role_oid
      FROM expanded
      GROUP BY schema_name, table_name, role_oid, action
      HAVING count(*) > 1
    )
    SELECT DISTINCT schema_name, table_name, role_oid
    FROM duplicate_actions
    ORDER BY schema_name, table_name, role_oid
  LOOP
    role_name := CASE
      WHEN rec.role_oid = 0 THEN 'public'
      ELSE (SELECT rolname FROM pg_roles WHERE oid = rec.role_oid)
    END;

    role_clause := CASE
      WHEN role_name = 'public' THEN 'public'
      ELSE quote_ident(role_name)
    END;

    -- Compute combined expressions BEFORE dropping policies.
    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO select_has, select_using
    FROM (
      SELECT coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = rec.schema_name
        AND c.relname = rec.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = rec.role_oid
        AND p.polcmd IN ('r', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO delete_has, delete_using
    FROM (
      SELECT coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = rec.schema_name
        AND c.relname = rec.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = rec.role_oid
        AND p.polcmd IN ('d', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', expr), ' OR '), 'true')
    INTO insert_has, insert_check
    FROM (
      SELECT coalesce(
        pg_get_expr(p.polwithcheck, p.polrelid),
        pg_get_expr(p.polqual, p.polrelid),
        'true'
      ) AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = rec.schema_name
        AND c.relname = rec.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = rec.role_oid
        AND p.polcmd IN ('a', '*')
    ) s;

    SELECT
      (count(*) > 0),
      coalesce(string_agg(format('(%s)', using_expr), ' OR '), 'true'),
      coalesce(string_agg(format('(%s)', check_expr), ' OR '), 'true')
    INTO update_has, update_using, update_check
    FROM (
      SELECT
        coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') AS using_expr,
        coalesce(
          pg_get_expr(p.polwithcheck, p.polrelid),
          pg_get_expr(p.polqual, p.polrelid),
          'true'
        ) AS check_expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = rec.schema_name
        AND c.relname = rec.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = rec.role_oid
        AND p.polcmd IN ('w', '*')
    ) s;

    -- Drop existing permissive single-role policies for this (table, role).
    FOR pol IN
      SELECT p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = rec.schema_name
        AND c.relname = rec.table_name
        AND p.polpermissive
        AND array_length(p.polroles, 1) = 1
        AND p.polroles[1] = rec.role_oid
    LOOP
      EXECUTE format('drop policy if exists %I on %I.%I;', pol.polname, rec.schema_name, rec.table_name);
    END LOOP;

    -- Recreate consolidated policies (one per action present).
    IF select_has THEN
      name_hash := substring(md5(rec.schema_name || '.' || rec.table_name || '.' || role_name || '.select'), 1, 6);
      name_base := format('p_%s_%s_select', rec.table_name, role_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;

      EXECUTE format(
        'create policy %I on %I.%I as permissive for select to %s using (%s);',
        new_policy_name, rec.schema_name, rec.table_name, role_clause, select_using
      );
    END IF;

    IF insert_has THEN
      name_hash := substring(md5(rec.schema_name || '.' || rec.table_name || '.' || role_name || '.insert'), 1, 6);
      name_base := format('p_%s_%s_insert', rec.table_name, role_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;

      EXECUTE format(
        'create policy %I on %I.%I as permissive for insert to %s with check (%s);',
        new_policy_name, rec.schema_name, rec.table_name, role_clause, insert_check
      );
    END IF;

    IF update_has THEN
      name_hash := substring(md5(rec.schema_name || '.' || rec.table_name || '.' || role_name || '.update'), 1, 6);
      name_base := format('p_%s_%s_update', rec.table_name, role_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;

      EXECUTE format(
        'create policy %I on %I.%I as permissive for update to %s using (%s) with check (%s);',
        new_policy_name, rec.schema_name, rec.table_name, role_clause, update_using, update_check
      );
    END IF;

    IF delete_has THEN
      name_hash := substring(md5(rec.schema_name || '.' || rec.table_name || '.' || role_name || '.delete'), 1, 6);
      name_base := format('p_%s_%s_delete', rec.table_name, role_name);
      IF length(name_base) > 63 - 1 - 6 THEN
        name_base := left(name_base, 63 - 1 - 6);
      END IF;
      new_policy_name := name_base || '_' || name_hash;

      EXECUTE format(
        'create policy %I on %I.%I as permissive for delete to %s using (%s);',
        new_policy_name, rec.schema_name, rec.table_name, role_clause, delete_using
      );
    END IF;
  END LOOP;
END $$;
