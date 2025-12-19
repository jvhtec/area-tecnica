-- =============================================================================
-- Performance Follow-up (Safe)
-- =============================================================================
-- 1) Add an overlap-friendly range column for job windows (tstzrange)
-- 2) Add supporting indexes for common filters
-- 3) Normalize nested auth.* initplan wrappers in RLS policies (no behavior change)
-- =============================================================================

-- 1) Jobs: computed time range for overlap queries (calendar windows)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS time_range tstzrange
  GENERATED ALWAYS AS (tstzrange(least(start_time, end_time), greatest(start_time, end_time), '[]')) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_time_range_gist
  ON public.jobs USING gist (time_range);

-- 2) Common filter helper: department-first index for department-scoped job lookups
CREATE INDEX IF NOT EXISTS idx_job_departments_department_job_id
  ON public.job_departments (department, job_id);

-- 3) RLS policy cleanup: collapse accidental nested initplan wrappers such as
--    (SELECT (SELECT auth.uid() AS uid) AS uid) -> (select auth.uid())
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
