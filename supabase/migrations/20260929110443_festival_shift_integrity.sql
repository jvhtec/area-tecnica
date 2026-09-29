-- FEST-DATA-01 / FEST-DATA-02 (festival roadmap phase 1.2).
--
-- Internal festival-shift crew must also belong to the same job through any
-- job_assignments row, regardless of status or assignment source. Production
-- was audited before this migration: the only drift was 16 missing
-- job/technician memberships. Keep the scheduled crew and create those
-- memberships instead of deleting shifts.

-- These rows repair historical membership rather than representing new work.
-- Suppress only the user-facing "assignment.created" activity event; all
-- other job-assignment triggers remain active during the backfill.
ALTER TABLE public.job_assignments
  DISABLE TRIGGER t_ai_job_assignments_activity;

INSERT INTO public.job_assignments (
  job_id,
  technician_id,
  status,
  assignment_source,
  use_tour_multipliers
)
SELECT DISTINCT
  shift.job_id,
  assignment.technician_id,
  'confirmed'::public.assignment_status,
  'direct',
  false
FROM public.festival_shift_assignments AS assignment
JOIN public.festival_shifts AS shift
  ON shift.id = assignment.shift_id
WHERE assignment.technician_id IS NOT NULL
  AND shift.job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.job_assignments AS job_assignment
    WHERE job_assignment.job_id = shift.job_id
      AND job_assignment.technician_id = assignment.technician_id
  )
ON CONFLICT (job_id, technician_id) DO NOTHING;

ALTER TABLE public.job_assignments
  ENABLE TRIGGER t_ai_job_assignments_activity;

-- Stop instead of silently discarding or rewriting any anomaly that the
-- production audit did not observe.
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.festival_shift_assignments
  WHERE shift_id IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'festival_shift_integrity_null_shift_rows:%', v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.festival_shift_assignments AS assignment
  LEFT JOIN public.profiles AS profile
    ON profile.id = assignment.technician_id
  WHERE assignment.technician_id IS NOT NULL
    AND profile.id IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'festival_shift_integrity_missing_profiles:%', v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM (
    SELECT assignment.shift_id, assignment.technician_id
    FROM public.festival_shift_assignments AS assignment
    WHERE assignment.technician_id IS NOT NULL
    GROUP BY assignment.shift_id, assignment.technician_id
    HAVING count(*) > 1
  ) AS duplicate_assignment;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'festival_shift_integrity_duplicate_internal_crew:%', v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.festival_shift_assignments AS assignment
  JOIN public.festival_shifts AS shift
    ON shift.id = assignment.shift_id
  WHERE assignment.technician_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_assignments AS job_assignment
      WHERE job_assignment.job_id = shift.job_id
        AND job_assignment.technician_id = assignment.technician_id
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'festival_shift_integrity_invalid_job_membership:%', v_count;
  END IF;
END;
$$;

ALTER TABLE public.festival_shift_assignments
  ALTER COLUMN shift_id SET NOT NULL;

ALTER TABLE public.festival_shift_assignments
  DROP CONSTRAINT IF EXISTS festival_shift_assignments_technician_id_fkey;

ALTER TABLE public.festival_shift_assignments
  ADD CONSTRAINT festival_shift_assignments_technician_id_fkey
  FOREIGN KEY (technician_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX festival_shift_assignments_shift_technician_unique
  ON public.festival_shift_assignments (shift_id, technician_id)
  WHERE technician_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_festival_shift_assignment_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF NEW.technician_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT shift.job_id
  INTO v_job_id
  FROM public.festival_shifts AS shift
  WHERE shift.id = NEW.shift_id;

  IF NOT FOUND OR v_job_id IS NULL THEN
    RAISE EXCEPTION 'festival_shift_assignment_requires_job'
      USING ERRCODE = '23514';
  END IF;

  -- Pair with the reverse job-assignment cleanup. Without a shared lock, a
  -- concurrent shift insert and job-assignment delete could both validate
  -- against the other's pre-commit state and leave an orphan.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_job_id::text || ':' || NEW.technician_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_assignments AS job_assignment
    WHERE job_assignment.job_id = v_job_id
      AND job_assignment.technician_id = NEW.technician_id
  ) THEN
    RAISE EXCEPTION 'festival_shift_technician_not_on_job'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_festival_shift_assignment_membership()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_festival_shift_assignment_membership
  ON public.festival_shift_assignments;
CREATE TRIGGER trg_validate_festival_shift_assignment_membership
  BEFORE INSERT OR UPDATE OF shift_id, technician_id
  ON public.festival_shift_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_festival_shift_assignment_membership();

CREATE OR REPLACE FUNCTION public.validate_festival_shift_job_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  IF NEW.job_id IS NOT DISTINCT FROM OLD.job_id THEN
    RETURN NEW;
  END IF;

  -- Lock every affected job/technician pair in an explicit stable order before
  -- checking membership so concurrent assignment lifecycle changes serialize.
  IF NEW.job_id IS NOT NULL THEN
    FOR v_lock_key IN
      SELECT DISTINCT pg_catalog.hashtextextended(
        NEW.job_id::text || ':' || assignment.technician_id::text,
        0
      )
      FROM public.festival_shift_assignments AS assignment
      WHERE assignment.shift_id = OLD.id
        AND assignment.technician_id IS NOT NULL
      ORDER BY 1
    LOOP
      PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_shift_assignments AS assignment
    WHERE assignment.shift_id = OLD.id
      AND assignment.technician_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_assignments AS job_assignment
        WHERE job_assignment.job_id = NEW.job_id
          AND job_assignment.technician_id = assignment.technician_id
      )
  ) THEN
    RAISE EXCEPTION 'festival_shift_technician_not_on_new_job'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_festival_shift_job_change()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_festival_shift_job_change
  ON public.festival_shifts;
CREATE TRIGGER trg_validate_festival_shift_job_change
  BEFORE UPDATE OF job_id
  ON public.festival_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_festival_shift_job_change();

CREATE OR REPLACE FUNCTION public.cleanup_festival_shift_membership_on_job_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id
    AND NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id
  THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD.job_id::text || ':' || OLD.technician_id::text, 0)
  );

  -- Removing or moving a person off the job also unschedules that person from
  -- the old job's festival shifts. Status/source-only changes keep membership.
  DELETE FROM public.festival_shift_assignments AS assignment
  USING public.festival_shifts AS shift
  WHERE shift.id = assignment.shift_id
    AND shift.job_id = OLD.job_id
    AND assignment.technician_id = OLD.technician_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_festival_shift_membership_on_job_assignment()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cleanup_festival_shift_membership_delete
  ON public.job_assignments;
CREATE TRIGGER trg_cleanup_festival_shift_membership_delete
  AFTER DELETE
  ON public.job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_festival_shift_membership_on_job_assignment();

DROP TRIGGER IF EXISTS trg_cleanup_festival_shift_membership_update
  ON public.job_assignments;
CREATE TRIGGER trg_cleanup_festival_shift_membership_update
  AFTER UPDATE OF job_id, technician_id
  ON public.job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_festival_shift_membership_on_job_assignment();

ALTER FUNCTION public.festival_department_matches(text, text)
  SET search_path = '';
ALTER FUNCTION public.can_read_festival_job(uuid)
  SET search_path = '';
ALTER FUNCTION public.can_read_festival_shift(uuid)
  SET search_path = '';

CREATE OR REPLACE FUNCTION public.copy_festival_shifts(
  p_job_id uuid,
  p_source_date date,
  p_target_date date
)
RETURNS TABLE (
  copied_shifts integer,
  copied_assignments integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_source_shift public.festival_shifts%ROWTYPE;
  v_new_shift_id uuid;
  v_lock_key bigint;
  v_assignment_count integer;
  v_copied_shifts integer := 0;
  v_copied_assignments integer := 0;
BEGIN
  IF current_user <> 'service_role'
    AND coalesce(public.get_current_user_role(), '') NOT IN ('admin', 'management', 'logistics')
  THEN
    RAISE EXCEPTION 'festival_shift_copy_not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_source_date IS NULL OR p_target_date IS NULL THEN
    RAISE EXCEPTION 'festival_shift_copy_parameters_required'
      USING ERRCODE = '22004';
  END IF;

  IF p_source_date = p_target_date THEN
    RAISE EXCEPTION 'festival_shift_copy_dates_must_differ'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_shift_copy_job_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Serialize copies into the same job/day so concurrent retries cannot both
  -- pass the empty-target guard.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_job_id::text || ':' || p_target_date::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_shifts AS shift
    WHERE shift.job_id = p_job_id
      AND shift.date = p_source_date
  ) THEN
    RAISE EXCEPTION 'festival_shift_copy_source_empty'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_shifts AS shift
    WHERE shift.job_id = p_job_id
      AND shift.date = p_target_date
  ) THEN
    RAISE EXCEPTION 'festival_shift_copy_target_not_empty'
      USING ERRCODE = '23505';
  END IF;

  -- Pair locks are held for the whole transaction and acquired globally in a
  -- stable order, preventing two copies to different target days from taking
  -- the same technician locks in opposite orders.
  FOR v_lock_key IN
    SELECT DISTINCT pg_catalog.hashtextextended(
      p_job_id::text || ':' || assignment.technician_id::text,
      0
    )
    FROM public.festival_shift_assignments AS assignment
    JOIN public.festival_shifts AS shift
      ON shift.id = assignment.shift_id
    WHERE shift.job_id = p_job_id
      AND shift.date = p_source_date
      AND assignment.technician_id IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  FOR v_source_shift IN
    SELECT shift.*
    FROM public.festival_shifts AS shift
    WHERE shift.job_id = p_job_id
      AND shift.date = p_source_date
    ORDER BY shift.start_time, shift.id
    FOR SHARE
  LOOP
    v_new_shift_id := pg_catalog.gen_random_uuid();

    INSERT INTO public.festival_shifts (
      id,
      job_id,
      date,
      start_time,
      end_time,
      name,
      stage,
      department,
      notes
    )
    VALUES (
      v_new_shift_id,
      p_job_id,
      p_target_date,
      v_source_shift.start_time,
      v_source_shift.end_time,
      v_source_shift.name,
      v_source_shift.stage,
      v_source_shift.department,
      v_source_shift.notes
    );

    v_copied_shifts := v_copied_shifts + 1;

    INSERT INTO public.festival_shift_assignments (
      shift_id,
      technician_id,
      external_technician_name,
      role
    )
    SELECT
      v_new_shift_id,
      assignment.technician_id,
      assignment.external_technician_name,
      assignment.role
    FROM public.festival_shift_assignments AS assignment
    WHERE assignment.shift_id = v_source_shift.id
    ORDER BY assignment.technician_id NULLS LAST, assignment.id;

    GET DIAGNOSTICS v_assignment_count = ROW_COUNT;
    v_copied_assignments := v_copied_assignments + v_assignment_count;
  END LOOP;

  RETURN QUERY
  SELECT v_copied_shifts, v_copied_assignments;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_festival_shifts(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_festival_shifts(uuid, date, date)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.copy_festival_shifts(uuid, date, date) IS
  'Atomically copies every festival shift and crew assignment from one job date to an empty target date.';
