-- =============================================================================
-- Performance Follow-up (Safe)
-- =============================================================================
-- Second pass: normalize nested auth.* initplan wrappers in RLS policies.
-- Uses dot-safe regex (auth[.]uid) to avoid backslash-escaping pitfalls.
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
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]uid[(][)][[:space:]]+AS[[:space:]]+uid[[:space:]]*[)][[:space:]]+AS[[:space:]]+uid[[:space:]]*[)]',
          '(select auth.uid())',
          'g'
        );
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]role[(][)][[:space:]]+AS[[:space:]]+role[[:space:]]*[)][[:space:]]+AS[[:space:]]+role[[:space:]]*[)]',
          '(select auth.role())',
          'g'
        );
        new_qual := regexp_replace(
          new_qual,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]jwt[(][)][[:space:]]+AS[[:space:]]+jwt[[:space:]]*[)][[:space:]]+AS[[:space:]]+jwt[[:space:]]*[)]',
          '(select auth.jwt())',
          'g'
        );
      END LOOP;
    END IF;

    IF new_check IS NOT NULL THEN
      prev := NULL;
      WHILE prev IS DISTINCT FROM new_check LOOP
        prev := new_check;
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]uid[(][)][[:space:]]+AS[[:space:]]+uid[[:space:]]*[)][[:space:]]+AS[[:space:]]+uid[[:space:]]*[)]',
          '(select auth.uid())',
          'g'
        );
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]role[(][)][[:space:]]+AS[[:space:]]+role[[:space:]]*[)][[:space:]]+AS[[:space:]]+role[[:space:]]*[)]',
          '(select auth.role())',
          'g'
        );
        new_check := regexp_replace(
          new_check,
          '[(][[:space:]]*SELECT[[:space:]]+[(][[:space:]]*SELECT[[:space:]]+auth[.]jwt[(][)][[:space:]]+AS[[:space:]]+jwt[[:space:]]*[)][[:space:]]+AS[[:space:]]+jwt[[:space:]]*[)]',
          '(select auth.jwt())',
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

