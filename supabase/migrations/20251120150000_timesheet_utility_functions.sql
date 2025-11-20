-- Utility functions for timesheet operations that can be called from Edge Functions
-- Replaces the TypeScript utilities in supabase/functions/_shared/

-- Group timesheet rows into contiguous date blocks per job
-- Replaces groupTimesheetAssignments from timesheetCalendarUtils.ts
CREATE OR REPLACE FUNCTION public.group_timesheet_assignments(
    p_technician_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blocks jsonb := '[]'::jsonb;
    v_current_block jsonb;
    v_prev_date date;
    v_job_id uuid;
    v_date date;
    v_dates jsonb;
    rec record;
BEGIN
    -- Build a temporary structure of job_id -> sorted dates
    FOR rec IN
        SELECT
            job_id,
            array_agg(date ORDER BY date) as dates
        FROM timesheets
        WHERE technician_id = p_technician_id
            AND (p_start_date IS NULL OR date >= p_start_date)
            AND (p_end_date IS NULL OR date <= p_end_date)
        GROUP BY job_id
    LOOP
        v_job_id := rec.job_id;
        v_dates := '[]'::jsonb;
        v_prev_date := NULL;

        -- Process each date for this job
        FOREACH v_date IN ARRAY rec.dates
        LOOP
            -- Start new block if this is the first date or not consecutive
            IF v_prev_date IS NULL OR v_date <> v_prev_date + INTERVAL '1 day' THEN
                -- Save previous block if it exists
                IF v_dates <> '[]'::jsonb THEN
                    v_blocks := v_blocks || jsonb_build_object(
                        'job_id', v_job_id,
                        'dates', v_dates,
                        'start_date', v_dates->0,
                        'end_date', v_dates->-1
                    );
                    v_dates := '[]'::jsonb;
                END IF;
            END IF;

            -- Add current date to block
            v_dates := v_dates || to_jsonb(v_date::text);
            v_prev_date := v_date;
        END LOOP;

        -- Save the last block for this job
        IF v_dates <> '[]'::jsonb THEN
            v_blocks := v_blocks || jsonb_build_object(
                'job_id', v_job_id,
                'dates', v_dates,
                'start_date', v_dates->0,
                'end_date', v_dates->-1
            );
        END IF;
    END LOOP;

    RETURN v_blocks;
END;
$$;

COMMENT ON FUNCTION public.group_timesheet_assignments(uuid, date, date)
IS 'Groups consecutive timesheet dates into blocks per job for calendar display. Returns array of {job_id, dates[], start_date, end_date}';

GRANT EXECUTE ON FUNCTION public.group_timesheet_assignments(uuid, date, date)
  TO authenticated, service_role;

-- Select timesheet crew filtered by department role
-- Replaces selectTimesheetCrew from timesheetWhatsappUtils.ts
CREATE OR REPLACE FUNCTION public.select_timesheet_crew_by_dept(
    p_job_id uuid,
    p_department text -- 'sound', 'lights', or 'video'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dept_column text;
    v_crew jsonb := '[]'::jsonb;
BEGIN
    -- Validate department
    IF p_department NOT IN ('sound', 'lights', 'video') THEN
        RAISE EXCEPTION 'Invalid department. Must be sound, lights, or video';
    END IF;

    -- Map department to role column
    v_dept_column := p_department || '_role';

    -- Query timesheets with role filter
    -- Using dynamic SQL to filter by the correct role column
    EXECUTE format('
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
            ''technician_id'', t.technician_id,
            ''date'', t.date::text,
            ''role'', ja.%I,
            ''first_name'', p.first_name,
            ''last_name'', p.last_name,
            ''phone'', p.phone
        ))
        FROM timesheets t
        INNER JOIN job_assignments ja ON ja.job_id = t.job_id AND ja.technician_id = t.technician_id
        INNER JOIN profiles p ON p.id = t.technician_id
        WHERE t.job_id = $1
          AND t.is_schedule_only = false
          AND ja.%I IS NOT NULL
          AND ja.%I <> ''''
    ', v_dept_column, v_dept_column, v_dept_column)
    INTO v_crew
    USING p_job_id;

    RETURN COALESCE(v_crew, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.select_timesheet_crew_by_dept(uuid, text)
IS 'Returns technicians with timesheets for a job filtered by department (sound/lights/video). Includes profile data (name, phone).';

GRANT EXECUTE ON FUNCTION public.select_timesheet_crew_by_dept(uuid, text)
  TO authenticated, service_role;

-- Format crew member name from profile
-- Helper function for consistent name formatting
CREATE OR REPLACE FUNCTION public.format_crew_name(
    p_first_name text,
    p_last_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        NULLIF(TRIM(CONCAT(p_first_name, ' ', p_last_name)), ''),
        'Técnico'
    );
$$;

COMMENT ON FUNCTION public.format_crew_name(text, text)
IS 'Formats technician name from first and last name, returns "Técnico" if both are null/empty';

GRANT EXECUTE ON FUNCTION public.format_crew_name(text, text)
  TO authenticated, service_role, anon;

-- Get formatted crew phone with country code
-- Helper function for phone number formatting
CREATE OR REPLACE FUNCTION public.get_crew_phone(
    p_phone text,
    p_default_country_code text DEFAULT '+34'
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_phone IS NULL OR TRIM(p_phone) = '' THEN ''
        WHEN p_phone LIKE '+%' THEN TRIM(p_phone)
        ELSE p_default_country_code || LTRIM(TRIM(p_phone), '0')
    END;
$$;

COMMENT ON FUNCTION public.get_crew_phone(text, text)
IS 'Formats phone number with country code if not already present';

GRANT EXECUTE ON FUNCTION public.get_crew_phone(text, text)
  TO authenticated, service_role, anon;
