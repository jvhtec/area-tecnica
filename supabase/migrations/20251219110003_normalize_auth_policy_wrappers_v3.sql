-- =============================================================================
-- Performance Follow-up (Safe)
-- =============================================================================
-- Third pass: fully collapse nested auth.* scalar-subquery wrappers produced by
-- repeated string replacements, e.g.:
--   (SELECT (SELECT (SELECT auth.uid() AS uid) AS uid) AS uid) -> (SELECT auth.uid() AS uid)
-- =============================================================================

DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  prev text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    IF new_qual IS NOT NULL THEN
      prev := NULL;
      WHILE prev IS DISTINCT FROM new_qual LOOP
        prev := new_qual;

        -- uid
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]uid[(][)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)]',
          '(SELECT auth.uid() AS uid)',
          'g'
        );
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]uid[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)]',
          '(SELECT auth.uid() AS uid)',
          'g'
        );

        -- role
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]role[(][)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)]',
          '(SELECT auth.role() AS role)',
          'g'
        );
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]role[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)]',
          '(SELECT auth.role() AS role)',
          'g'
        );

        -- jwt
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]jwt[(][)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)]',
          '(SELECT auth.jwt() AS jwt)',
          'g'
        );
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]jwt[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)]',
          '(SELECT auth.jwt() AS jwt)',
          'g'
        );
      END LOOP;
    END IF;

    IF new_check IS NOT NULL THEN
      prev := NULL;
      WHILE prev IS DISTINCT FROM new_check LOOP
        prev := new_check;

        -- uid
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]uid[(][)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)]',
          '(SELECT auth.uid() AS uid)',
          'g'
        );
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]uid[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+uid[[:space:]]*[)]',
          '(SELECT auth.uid() AS uid)',
          'g'
        );

        -- role
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]role[(][)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)]',
          '(SELECT auth.role() AS role)',
          'g'
        );
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]role[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+role[[:space:]]*[)]',
          '(SELECT auth.role() AS role)',
          'g'
        );

        -- jwt
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]jwt[(][)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)]',
          '(SELECT auth.jwt() AS jwt)',
          'g'
        );
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+[(][[:space:]]*[Ss][Ee][Ll][Ee][Cc][Tt][[:space:]]+auth[.]jwt[(][)][[:space:]]*[)][[:space:]]+[Aa][Ss][[:space:]]+jwt[[:space:]]*[)]',
          '(SELECT auth.jwt() AS jwt)',
          'g'
        );
      END LOOP;
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

