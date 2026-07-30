-- Seasonal house tech payroll and availability.
--
-- The profile checkbox controls payroll on every job. The inclusive date range
-- controls scheduling availability; it does not silently change the pay rule.

ALTER TABLE public.profiles
  ADD COLUMN seasonal_house_tech boolean NOT NULL DEFAULT false,
  ADD COLUMN seasonal_house_tech_start_date date,
  ADD COLUMN seasonal_house_tech_end_date date;

COMMENT ON COLUMN public.profiles.seasonal_house_tech IS
  'Admin-controlled house-tech profile mode: no base/plus; only overtime above 12 rounded hours.';
COMMENT ON COLUMN public.profiles.seasonal_house_tech_start_date IS
  'Inclusive first date on which a seasonal house tech is available for staffing.';
COMMENT ON COLUMN public.profiles.seasonal_house_tech_end_date IS
  'Inclusive last date on which a seasonal house tech is available for staffing.';

ALTER TABLE public.profiles
  DISABLE TRIGGER enforce_profile_privilege_changes;

UPDATE public.profiles
SET autonomo = true
WHERE role = 'house_tech'
  AND autonomo IS DISTINCT FROM true;

ALTER TABLE public.profiles
  ENABLE TRIGGER enforce_profile_privilege_changes;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_seasonal_house_tech_range_check
  CHECK (
    (
      seasonal_house_tech = false
      AND seasonal_house_tech_start_date IS NULL
      AND seasonal_house_tech_end_date IS NULL
    )
    OR (
      seasonal_house_tech = true
      AND role = 'house_tech'
      AND seasonal_house_tech_start_date IS NOT NULL
      AND seasonal_house_tech_end_date IS NOT NULL
      AND seasonal_house_tech_start_date <= seasonal_house_tech_end_date
    )
  ) NOT VALID,
  ADD CONSTRAINT profiles_house_tech_autonomo_ignored_check
  CHECK (role <> 'house_tech' OR autonomo IS DISTINCT FROM false) NOT VALID;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_seasonal_house_tech_range_check;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_house_tech_autonomo_ignored_check;

CREATE OR REPLACE FUNCTION public.normalize_house_tech_finance_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role = 'house_tech' THEN
    NEW.autonomo := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_house_tech_finance_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS normalize_house_tech_finance_profile ON public.profiles;
CREATE TRIGGER normalize_house_tech_finance_profile
BEFORE INSERT OR UPDATE OF role, autonomo ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_house_tech_finance_profile();

CREATE OR REPLACE FUNCTION public.enforce_seasonal_house_tech_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_id uuid := NEW.id;
  v_old_seasonal_house_tech boolean := false;
  v_old_start_date date;
  v_old_end_date date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.seasonal_house_tech IS NOT DISTINCT FROM NEW.seasonal_house_tech
       AND OLD.seasonal_house_tech_start_date IS NOT DISTINCT FROM NEW.seasonal_house_tech_start_date
       AND OLD.seasonal_house_tech_end_date IS NOT DISTINCT FROM NEW.seasonal_house_tech_end_date THEN
      RETURN NEW;
    END IF;

    v_old_seasonal_house_tech := OLD.seasonal_house_tech;
    v_old_start_date := OLD.seasonal_house_tech_start_date;
    v_old_end_date := OLD.seasonal_house_tech_end_date;
  ELSIF NEW.seasonal_house_tech = false
        AND NEW.seasonal_house_tech_start_date IS NULL
        AND NEW.seasonal_house_tech_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role::text INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = v_actor;

  IF v_actor = v_target_id THEN
    RAISE EXCEPTION 'Seasonal house tech settings cannot be set or changed on your own account'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators may change seasonal house tech settings'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource,
    severity,
    metadata
  ) VALUES (
    v_actor,
    'profile_privilege_change',
    'profile:' || v_target_id::text,
    'high',
    jsonb_build_object(
      'changed_fields', jsonb_build_array(
        'seasonal_house_tech',
        'seasonal_house_tech_start_date',
        'seasonal_house_tech_end_date'
      ),
      'actor_role', v_actor_role,
      'old_seasonal_house_tech', v_old_seasonal_house_tech,
      'new_seasonal_house_tech', NEW.seasonal_house_tech,
      'old_start_date', v_old_start_date,
      'new_start_date', NEW.seasonal_house_tech_start_date,
      'old_end_date', v_old_end_date,
      'new_end_date', NEW.seasonal_house_tech_end_date
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_seasonal_house_tech_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_seasonal_house_tech_change()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_seasonal_house_tech_change ON public.profiles;
CREATE TRIGGER enforce_seasonal_house_tech_change
BEFORE UPDATE OF seasonal_house_tech, seasonal_house_tech_start_date, seasonal_house_tech_end_date
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_seasonal_house_tech_change();

DROP TRIGGER IF EXISTS enforce_seasonal_house_tech_insert ON public.profiles;
CREATE TRIGGER enforce_seasonal_house_tech_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_seasonal_house_tech_change();

DROP FUNCTION public.get_profiles_with_skills();

CREATE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE(
  id text,
  first_name text,
  last_name text,
  nickname text,
  email text,
  phone text,
  dni text,
  department text,
  role text,
  bg_color text,
  assignable_as_tech boolean,
  skills json,
  profile_picture_url text,
  seasonal_house_tech boolean,
  seasonal_house_tech_start_date date,
  seasonal_house_tech_end_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::text,
    p.first_name::text,
    p.last_name::text,
    p.nickname::text,
    p.email::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.dni, '')::text,
    COALESCE(p.department, '')::text,
    p.role::text,
    p.bg_color::text,
    p.assignable_as_tech,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'category', s.category,
            'proficiency', ps.proficiency,
            'is_primary', ps.is_primary,
            'notes', ps.notes
          )
          ORDER BY ps.is_primary DESC, ps.proficiency DESC NULLS LAST, s.name
        )
        FROM public.profile_skills ps
        INNER JOIN public.skills s ON s.id = ps.skill_id
        WHERE ps.profile_id = p.id
          AND s.active = true
      ),
      '[]'::json
    ),
    p.profile_picture_url::text,
    p.seasonal_house_tech,
    p.seasonal_house_tech_start_date,
    p.seasonal_house_tech_end_date
  FROM public.profiles p
  ORDER BY p.department, p.last_name, p.first_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profiles_with_skills() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_skills() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(
  _job_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  technician_id uuid,
  date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    override_row.job_id,
    override_row.technician_id,
    override_row.date
  FROM public.job_technician_rate_mode_dates AS override_row
  WHERE override_row.rate_mode = 'hourly'
    AND (_job_ids IS NULL OR override_row.job_id = ANY(_job_ids))
    AND (
      public.is_admin_or_management()
      OR override_row.technician_id = (SELECT auth.uid())
    )
  UNION
  SELECT
    timesheet.job_id,
    timesheet.technician_id,
    timesheet.date
  FROM public.timesheets AS timesheet
  JOIN public.jobs AS job ON job.id = timesheet.job_id
  JOIN public.profiles AS profile ON profile.id = timesheet.technician_id
  WHERE job.job_type = 'tourdate'
    AND timesheet.is_active = true
    AND profile.role = 'house_tech'
    AND profile.seasonal_house_tech = true
    AND (_job_ids IS NULL OR timesheet.job_id = ANY(_job_ids))
    AND (
      public.is_admin_or_management()
      OR timesheet.technician_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hourly_rate_mode_dates_for_timesheets(uuid[])
  TO authenticated, service_role;


-- Canonical standard-job/timesheet pricing with seasonal overtime-only mode.
CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(
  _timesheet_id uuid,
  _persist boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_timesheet RECORD;
  v_job_type TEXT;
  v_category TEXT;
  v_rate_card RECORD;
  v_worked_hours NUMERIC;
  v_raw_worked_hours NUMERIC;
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
  v_is_rehearsal BOOLEAN := FALSE;
  v_is_extended_shift BOOLEAN := FALSE;
  v_rehearsal_flat_rate NUMERIC := NULL;
  v_is_autonomo BOOLEAN := TRUE;
  v_is_house_tech BOOLEAN := FALSE;
  v_is_seasonal_house_tech BOOLEAN := FALSE;
  v_is_reduced_rehearsal BOOLEAN := FALSE;
  v_autonomo_discount NUMERIC := 0;
  v_forced_rehearsal BOOLEAN := FALSE;
  v_technician_rate_mode_override BOOLEAN := NULL;
  v_has_technician_rate_mode_override BOOLEAN := FALSE;
  v_rate_mode_source TEXT := 'standard';
  v_rate_mode TEXT := NULL;
  v_fixed_amount NUMERIC := NULL;
BEGIN
  -- Fetch timesheet with job info, category, autonomo status, and role-based flags
  SELECT
    t.*,
    j.job_type,
    CASE WHEN p.role = 'technician' THEN COALESCE(p.autonomo, true) ELSE true END as is_autonomo,
    COALESCE(p.role = 'house_tech', false) as is_house_tech,
    COALESCE(p.role = 'house_tech' AND p.seasonal_house_tech, false) as is_seasonal_house_tech,
    COALESCE(p.role IN ('house_tech', 'admin', 'management'), false) as is_reduced_rehearsal,
    COALESCE(
      t.category,
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END,
      'tecnico'
    ) as category
  INTO v_timesheet
  FROM public.timesheets t
  LEFT JOIN public.jobs j ON t.job_id = j.id
  LEFT JOIN public.job_assignments a ON t.job_id = a.job_id AND t.technician_id = a.technician_id
  LEFT JOIN public.profiles p ON t.technician_id = p.id
  WHERE t.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet not found: %', _timesheet_id;
  END IF;

  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin_or_management()
    OR auth.uid() = v_timesheet.technician_id
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  v_job_type := v_timesheet.job_type;
  v_category := v_timesheet.category;

  -- Rehearsal/fixed pricing uses technician/date overrides first, then the
  -- job-wide rehearsal toggle table.
  IF v_timesheet.date IS NOT NULL AND v_timesheet.job_id IS NOT NULL THEN
    SELECT trmd.use_rehearsal_rate, trmd.rate_mode, trmd.fixed_amount_eur
    INTO v_technician_rate_mode_override, v_rate_mode, v_fixed_amount
    FROM public.job_technician_rate_mode_dates trmd
    WHERE trmd.job_id = v_timesheet.job_id
      AND trmd.technician_id = v_timesheet.technician_id
      AND trmd.date = v_timesheet.date;

    IF FOUND THEN
      v_has_technician_rate_mode_override := TRUE;
      v_rate_mode := COALESCE(
        v_rate_mode,
        CASE WHEN COALESCE(v_technician_rate_mode_override, FALSE) THEN 'rehearsal' ELSE 'standard' END
      );
      v_forced_rehearsal := v_rate_mode = 'rehearsal';
      v_rate_mode_source := 'technician_override';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.job_rehearsal_dates
        WHERE job_id = v_timesheet.job_id AND date = v_timesheet.date
      ) INTO v_forced_rehearsal;

      v_rate_mode_source := CASE
        WHEN v_forced_rehearsal THEN 'job_rehearsal_date'
        ELSE 'standard'
      END;
    END IF;
  END IF;

  v_is_rehearsal := v_forced_rehearsal;

  -- Get autonomo / house_tech / reduced rehearsal status from the main query
  v_is_autonomo := v_timesheet.is_autonomo;
  v_is_house_tech := v_timesheet.is_house_tech;
  v_is_seasonal_house_tech := v_timesheet.is_seasonal_house_tech;

  -- Seasonal house techs always use overtime-only hourly pricing. This profile
  -- rule intentionally takes precedence over per-date fixed/rehearsal modes.
  IF v_is_seasonal_house_tech THEN
    v_is_rehearsal := FALSE;
    v_forced_rehearsal := FALSE;
    v_rate_mode := 'hourly';
    v_fixed_amount := NULL;
    v_rate_mode_source := 'seasonal_house_tech_profile';
  END IF;
  v_is_reduced_rehearsal := v_timesheet.is_reduced_rehearsal;

  -- Calculate worked hours once for both rehearsal and standard paths
  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;
  -- Preserve raw fractional hours for audit trail, then round to nearest whole hour
  -- IMPORTANT: Do NOT change this to half-hour rounding (ROUND(x*2)/2). See PR #467.
  v_raw_worked_hours := v_worked_hours;
  v_worked_hours := ROUND(v_worked_hours);

  -- Fixed-amount override short-circuits both rehearsal and standard pricing.
  IF v_rate_mode = 'fixed' AND NOT v_is_seasonal_house_tech THEN
    IF v_fixed_amount IS NULL OR v_fixed_amount < 0 THEN
      RAISE EXCEPTION 'Invalid fixed amount for timesheet %', _timesheet_id;
    END IF;

    v_total_amount := v_fixed_amount;
    v_billable_hours := v_worked_hours;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_raw_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_billable_hours,
      'is_fixed_amount', true,
      'fixed_amount_eur', v_total_amount,
      'base_amount_eur', v_total_amount,
      'base_day_eur', v_total_amount,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', v_total_amount,
      'category', v_category,
      'forced_rehearsal_rate', false,
      'rate_mode_source', 'technician_override',
      'has_technician_rate_mode_override', true,
      'technician_rate_mode', 'fixed'
    );

    v_result := jsonb_build_object(
      'timesheet_id', _timesheet_id,
      'amount_eur', v_total_amount,
      'amount_breakdown', v_breakdown
    );

    IF _persist THEN
      UPDATE public.timesheets
      SET
        amount_eur = v_total_amount,
        amount_breakdown = v_breakdown,
        category = v_category,
        updated_at = NOW()
      WHERE id = _timesheet_id;
    END IF;

    RETURN v_result;
  END IF;

  -- Handle rehearsal flat rate
  IF v_is_rehearsal AND NOT v_is_seasonal_house_tech THEN
    -- Check for custom rehearsal rate first
    SELECT rehearsal_day_eur INTO v_rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = v_timesheet.technician_id;

    -- If no custom rate, use role-based defaults:
    -- house_tech / admin / management -> EUR 60, regular technicians -> EUR 180
    IF v_rehearsal_flat_rate IS NULL THEN
      IF v_is_reduced_rehearsal THEN
        v_rehearsal_flat_rate := 60.00;
      ELSE
        v_rehearsal_flat_rate := 180.00;
      END IF;
    END IF;

    -- Apply discount for non-autonomo regular technicians only.
    -- House techs, admin, and management are exempt from the autonomo discount.
    IF NOT v_is_autonomo AND NOT v_is_reduced_rehearsal THEN
      v_autonomo_discount := 30.00;
      v_rehearsal_flat_rate := v_rehearsal_flat_rate - v_autonomo_discount;
    END IF;

    v_total_amount := v_rehearsal_flat_rate;
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rehearsal_flat_rate;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_raw_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_billable_hours,
      'is_rehearsal', true,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', v_rehearsal_flat_rate,
      'autonomo_discount_eur', v_autonomo_discount,
      'base_day_before_discount_eur', CASE WHEN v_autonomo_discount > 0 THEN v_rehearsal_flat_rate + v_autonomo_discount ELSE v_rehearsal_flat_rate END,
      'base_amount_eur', v_rehearsal_flat_rate,
      'base_day_eur', v_rehearsal_flat_rate,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', v_total_amount,
      'category', 'rehearsal',
      'forced_rehearsal_rate', v_forced_rehearsal,
      'rate_mode_source', v_rate_mode_source,
      'has_technician_rate_mode_override', v_has_technician_rate_mode_override,
      'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override,
      'technician_rate_mode', CASE WHEN v_is_seasonal_house_tech THEN 'hourly' ELSE v_rate_mode END
    );

    v_result := jsonb_build_object(
      'timesheet_id', _timesheet_id,
      'amount_eur', v_total_amount,
      'amount_breakdown', v_breakdown
    );

    IF _persist THEN
      UPDATE public.timesheets
      SET
        amount_eur = v_total_amount,
        amount_breakdown = v_breakdown,
        category = v_category,
        updated_at = NOW()
      WHERE id = _timesheet_id;
    END IF;

    RETURN v_result;
  END IF;

  -- Standard rate card lookup (non-rehearsal).
  -- House-tech OT is category-aware; non-house roles preserve legacy behavior.
  SELECT
    COALESCE(
      CASE
        WHEN v_category = 'responsable' THEN COALESCE(ctr.base_day_responsable_eur, ctr.base_day_especialista_eur, ctr.base_day_eur)
        WHEN v_category = 'especialista' THEN COALESCE(ctr.base_day_especialista_eur, ctr.base_day_eur)
        ELSE ctr.base_day_eur
      END,
      (SELECT rc.base_day_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)
    ) AS base_day_eur,
    COALESCE(ctr.plus_10_12_eur, (SELECT rc.plus_10_12_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)) as plus_10_12_eur,
    COALESCE(
      CASE
        WHEN v_is_house_tech AND v_category = 'tecnico' THEN ctr.overtime_hour_eur
        WHEN v_is_house_tech AND v_category = 'especialista' THEN COALESCE(ctr.overtime_hour_especialista_eur, ctr.overtime_hour_eur)
        WHEN v_is_house_tech AND v_category = 'responsable' THEN COALESCE(
          ctr.overtime_hour_responsable_eur,
          CASE WHEN ctr.overtime_hour_eur = 15.00 THEN 20.00 END,
          ctr.overtime_hour_eur
        )
        ELSE ctr.overtime_hour_eur
      END,
      (SELECT rc.overtime_hour_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)
    ) as overtime_hour_eur
  INTO v_rate_card
  FROM public.custom_tech_rates ctr
  WHERE ctr.profile_id = v_timesheet.technician_id;

  IF NOT FOUND THEN
    SELECT * INTO v_rate_card
    FROM public.rate_cards_2025
    WHERE category = v_category;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate card not found for category: %', v_category;
    END IF;
  END IF;

  -- Seasonal house techs earn only category-aware overtime above 12 rounded hours.
  IF v_is_seasonal_house_tech THEN
    v_billable_hours := v_worked_hours;
    v_base_day_amount := 0;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := 0;
    v_overtime_hours := GREATEST(v_worked_hours - 12, 0);
    v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
    v_total_amount := v_overtime_amount;
  -- Handle evento jobs (fixed 12-hour rate)
  ELSIF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  -- Handle extended shifts (21+ hours / over 20.5 hrs): double base rate only
  ELSIF v_worked_hours > 20.5 THEN
    v_is_extended_shift := TRUE;
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur * 2;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := 0;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount;
  ELSE
    -- Standard rate calculation tiers
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur;

    IF v_worked_hours <= 10.5 THEN
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12.5 THEN
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount;
    ELSE
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur;

      v_overtime_hours := v_worked_hours - 12;

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  v_breakdown := jsonb_build_object(
    'worked_hours', v_raw_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_billable_hours,
    'is_evento', (v_job_type = 'evento' AND NOT v_is_seasonal_house_tech),
    'is_seasonal_house_tech', v_is_seasonal_house_tech,
    'seasonal_overtime_only', v_is_seasonal_house_tech,
    'is_extended_shift', v_is_extended_shift,
    'is_double_base_rate', v_is_extended_shift,
    'base_amount_eur', COALESCE(v_base_day_amount, 0),
    'base_day_eur', COALESCE(v_base_day_amount, 0),
    'single_base_day_eur', CASE WHEN v_is_extended_shift THEN v_rate_card.base_day_eur ELSE v_base_day_amount END,
    'plus_10_12_hours', COALESCE(v_plus_10_12_hours, 0),
    'plus_10_12_eur', v_rate_card.plus_10_12_eur,
    'plus_10_12_amount_eur', COALESCE(v_plus_10_12_amount, 0),
    'overtime_hours', COALESCE(v_overtime_hours, 0),
    'overtime_hour_eur', v_rate_card.overtime_hour_eur,
    'overtime_amount_eur', COALESCE(v_overtime_amount, 0),
    'total_eur', v_total_amount,
    'category', v_category,
    'forced_rehearsal_rate', false,
    'rate_mode_source', v_rate_mode_source,
    'has_technician_rate_mode_override', v_has_technician_rate_mode_override,
    'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override,
    'technician_rate_mode', CASE WHEN v_is_seasonal_house_tech THEN 'hourly' ELSE v_rate_mode END
  );

  v_result := jsonb_build_object(
    'timesheet_id', _timesheet_id,
    'amount_eur', v_total_amount,
    'amount_breakdown', v_breakdown
  );

  IF _persist THEN
    UPDATE public.timesheets
    SET
      amount_eur = v_total_amount,
      amount_breakdown = v_breakdown,
      category = v_category,
      updated_at = NOW()
    WHERE id = _timesheet_id;
  END IF;

  RETURN v_result;
END;
$function$;

-- Prep days normally use the dedicated EUR 15/hour rule. Seasonal house techs
-- are the exception: their profile-level overtime-only rule applies to every
-- timesheet, including dates labelled as prep days.
CREATE OR REPLACE FUNCTION public.trg_apply_prep_day_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_prep_day boolean := false;
  v_is_seasonal_house_tech boolean := false;
  v_worked_hours numeric := 0;
  v_raw_worked_hours numeric := 0;
  v_rate numeric := 15.00;
  v_category text;
  v_overtime_hours numeric := 0;
BEGIN
  IF NEW.job_id IS NULL OR NEW.date IS NULL OR NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = NEW.job_id
      AND jdt.date = NEW.date
      AND jdt.type = 'prep_day'
  ) INTO v_is_prep_day;

  IF NOT v_is_prep_day THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(p.role = 'house_tech' AND p.seasonal_house_tech, false),
    CASE
      WHEN p.default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
        THEN p.default_timesheet_category
      ELSE NULL
    END
  INTO v_is_seasonal_house_tech, v_category
  FROM public.profiles p
  WHERE p.id = NEW.technician_id;

  IF NEW.end_time < NEW.start_time OR COALESCE(NEW.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      NEW.end_time - NEW.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(NEW.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      NEW.end_time - NEW.start_time
    )) / 3600.0 - (COALESCE(NEW.break_minutes, 0) / 60.0);
  END IF;

  v_worked_hours := GREATEST(v_worked_hours, 0);
  v_raw_worked_hours := v_worked_hours;
  v_worked_hours := ROUND(v_worked_hours);

  IF v_is_seasonal_house_tech THEN
    v_category := CASE
      WHEN NEW.category IN ('tecnico', 'especialista', 'responsable') THEN NEW.category
      ELSE NULL
    END;

    IF v_category IS NULL THEN
      SELECT CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
      INTO v_category
      FROM public.job_assignments a
      WHERE a.job_id = NEW.job_id
        AND a.technician_id = NEW.technician_id
      ORDER BY a.assigned_at DESC
      LIMIT 1;
    END IF;

    IF v_category IS NULL THEN
      SELECT CASE
        WHEN p.default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
          THEN p.default_timesheet_category
        ELSE 'tecnico'
      END
      INTO v_category
      FROM public.profiles p
      WHERE p.id = NEW.technician_id;
    END IF;

    v_category := COALESCE(v_category, 'tecnico');

    SELECT COALESCE(
      CASE
        WHEN v_category = 'responsable' THEN COALESCE(
          ctr.overtime_hour_responsable_eur,
          CASE WHEN ctr.overtime_hour_eur = 15.00 THEN 20.00 END,
          ctr.overtime_hour_eur
        )
        WHEN v_category = 'especialista' THEN COALESCE(
          ctr.overtime_hour_especialista_eur,
          ctr.overtime_hour_eur
        )
        ELSE ctr.overtime_hour_eur
      END,
      (
        SELECT rc.overtime_hour_eur
        FROM public.rate_cards_2025 rc
        WHERE rc.category = v_category
      )
    )
    INTO v_rate
    FROM public.custom_tech_rates ctr
    WHERE ctr.profile_id = NEW.technician_id;

    IF NOT FOUND OR v_rate IS NULL THEN
      SELECT rc.overtime_hour_eur
      INTO v_rate
      FROM public.rate_cards_2025 rc
      WHERE rc.category = v_category;
    END IF;

    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'Overtime rate card not found for seasonal prep-day category: %', v_category;
    END IF;

    v_overtime_hours := GREATEST(v_worked_hours - 12, 0);
    NEW.amount_eur := v_overtime_hours * v_rate;
    NEW.amount_breakdown := jsonb_build_object(
      'worked_hours', v_raw_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_worked_hours,
      'is_prep_day', true,
      'is_seasonal_house_tech', true,
      'seasonal_overtime_only', true,
      'rate_mode_source', 'seasonal_house_tech_profile',
      'technician_rate_mode', 'hourly',
      'base_amount_eur', 0,
      'base_day_eur', 0,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', v_overtime_hours,
      'overtime_hour_eur', v_rate,
      'overtime_amount_eur', NEW.amount_eur,
      'total_eur', NEW.amount_eur,
      'category', v_category
    );
    NEW.category := v_category;
    RETURN NEW;
  END IF;

  NEW.amount_eur := v_worked_hours * v_rate;
  NEW.amount_breakdown := jsonb_build_object(
    'worked_hours', v_raw_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_worked_hours,
    'is_prep_day', true,
    'prep_day_hourly_rate_eur', v_rate,
    'base_amount_eur', NEW.amount_eur,
    'base_day_eur', NEW.amount_eur,
    'plus_10_12_hours', 0,
    'plus_10_12_eur', 0,
    'plus_10_12_amount_eur', 0,
    'overtime_hours', 0,
    'overtime_hour_eur', 0,
    'overtime_amount_eur', 0,
    'total_eur', NEW.amount_eur,
    'category', 'prep_day'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_apply_prep_day_rate() FROM PUBLIC;

-- Profile finance-mode changes must refresh open timesheets that can still affect
-- payroll. Manager-approved payouts are treated as immutable historical records.
CREATE OR REPLACE FUNCTION public.recompute_timesheets_after_profile_finance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_timesheet RECORD;
BEGIN
  FOR v_timesheet IN
    SELECT t.id
    FROM public.timesheets t
    WHERE t.technician_id = NEW.id
      AND t.is_active = true
      AND t.approved_by_manager IS DISTINCT FROM true
      AND t.start_time IS NOT NULL
      AND t.end_time IS NOT NULL
  LOOP
    PERFORM public.compute_timesheet_amount_2025(v_timesheet.id, true);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_timesheets_after_profile_finance_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recompute_timesheets_after_profile_finance_change ON public.profiles;
CREATE TRIGGER recompute_timesheets_after_profile_finance_change
AFTER UPDATE OF role, autonomo, seasonal_house_tech,
  seasonal_house_tech_start_date, seasonal_house_tech_end_date
ON public.profiles
FOR EACH ROW
WHEN (
  OLD.role IS DISTINCT FROM NEW.role
  OR OLD.autonomo IS DISTINCT FROM NEW.autonomo
  OR OLD.seasonal_house_tech IS DISTINCT FROM NEW.seasonal_house_tech
  OR OLD.seasonal_house_tech_start_date IS DISTINCT FROM NEW.seasonal_house_tech_start_date
  OR OLD.seasonal_house_tech_end_date IS DISTINCT FROM NEW.seasonal_house_tech_end_date
)
EXECUTE FUNCTION public.recompute_timesheets_after_profile_finance_change();



-- Canonical tour quote pricing: every seasonal date is hourly.
CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  et timestamptz;
  job_start_date date;
  job_end_date date;
  tour_group uuid;
  tour_date_ref uuid;
  schedule_start date;
  schedule_end date;
  scheduled_days int := 1;
  rehearsal_days int := 0;
  standard_days int := 0;
  technician_override_days int := 0;
  hourly_days int := 0;
  fixed_days int := 0;
  hourly_total numeric(10,2) := 0;
  fixed_total numeric(10,2) := 0;
  forced_multiplier_days int := 0;
  no_multiplier_days int := 0;
  cat text;
  house boolean := false;
  seasonal boolean := false;
  is_autonomo boolean := true;
  is_reduced_rehearsal boolean := false;
  standard_discount_per_day numeric(10,2) := 0;
  rehearsal_discount_per_day numeric(10,2) := 0;
  total_autonomo_discount numeric(10,2) := 0;
  standard_base_before_discount numeric(10,2) := 0;
  standard_after_discount numeric(10,2) := 0;
  standard_multiplier_bonus numeric(10,2) := 0;
  multiplied_standard_days int := 0;
  rehearsal_base_before_discount numeric(10,2) := 0;
  team_member boolean := false;
  has_override boolean := false;
  standard_base numeric(10,2);
  standard_day_rate numeric(10,2) := 0;
  rehearsal_day_rate numeric(10,2) := 0;
  standard_total numeric(10,2) := 0;
  rehearsal_total numeric(10,2) := 0;
  total_base numeric(10,2) := 0;
  base_calculation_total numeric(10,2) := 0;
  after_discount_total numeric(10,2) := 0;
  mult numeric(6,3) := 1.0;
  per_job_multiplier numeric(6,3) := 1.0;
  display_multiplier numeric(6,3) := 1.0;
  display_per_job_multiplier numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
  has_custom_standard_rate boolean := FALSE;
  has_custom_rehearsal_rate boolean := FALSE;
  has_custom_rate boolean := FALSE;
  display_category text := 'rehearsal';
  job_date_type_start date;
  job_date_type_end date;
  tour_date_start date;
  tour_date_end date;
  tour_date_legacy_date date;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT job_type, start_time, end_time, tour_id, tour_date_id
  INTO jtype, st, et, tour_group, tour_date_ref
  FROM public.jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;

  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  SELECT COALESCE(p.role = 'house_tech' AND p.seasonal_house_tech, FALSE)
  INTO seasonal
  FROM public.profiles p
  WHERE p.id = _tech_id;

  job_start_date := (st AT TIME ZONE 'Europe/Madrid')::date;
  job_end_date := COALESCE((et AT TIME ZONE 'Europe/Madrid')::date, job_start_date);

  SELECT MIN(jdt.date), MAX(jdt.date)
  INTO job_date_type_start, job_date_type_end
  FROM public.job_date_types jdt
  WHERE jdt.job_id = _job_id
    AND jdt.type <> 'prep_day';

  SELECT td.start_date, td.end_date, td.date
  INTO tour_date_start, tour_date_end, tour_date_legacy_date
  FROM public.tour_dates td
  WHERE td.id = tour_date_ref;

  schedule_start := COALESCE(
    job_date_type_start,
    tour_date_start,
    job_start_date,
    tour_date_legacy_date
  );
  schedule_end := COALESCE(
    job_date_type_end,
    tour_date_end,
    job_end_date,
    tour_date_start,
    tour_date_legacy_date,
    job_start_date
  );

  schedule_start := COALESCE(schedule_start, job_start_date);
  schedule_end := COALESCE(schedule_end, schedule_start, job_end_date, job_start_date);
  IF schedule_end < schedule_start THEN
    schedule_end := schedule_start;
  END IF;

  WITH raw_scheduled_job_date_type_dates AS (
    SELECT DISTINCT jdt.date AS payable_date, jdt.type
    FROM public.job_date_types jdt
    WHERE jdt.job_id = _job_id
      AND jdt.type <> 'prep_day'
  ),
  scheduled_job_date_type_dates AS (
    SELECT raw.payable_date
    FROM raw_scheduled_job_date_type_dates raw
    WHERE raw.type <> 'rigging'
       OR EXISTS (
          SELECT 1
          FROM public.job_assignments rja
          WHERE rja.job_id = _job_id
            AND rja.technician_id = _tech_id
            AND COALESCE(rja.single_day, FALSE)
            AND rja.assignment_date = raw.payable_date
        )
       OR EXISTS (
          SELECT 1
          FROM public.timesheets rt
          WHERE rt.job_id = _job_id
            AND rt.technician_id = _tech_id
            AND rt.date = raw.payable_date
            AND COALESCE(rt.is_active, TRUE)
        )
  ),
  active_timesheet_dates AS (
    SELECT DISTINCT t.date AS payable_date
    FROM public.timesheets t
    WHERE t.job_id = _job_id
      AND t.technician_id = _tech_id
      AND COALESCE(t.is_active, TRUE)
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = t.job_id
          AND prep_jdt.date = t.date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  single_day_assignment_dates AS (
    SELECT DISTINCT ja.assignment_date AS payable_date
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id
      AND ja.technician_id = _tech_id
      AND COALESCE(ja.single_day, FALSE)
      AND ja.assignment_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = ja.job_id
          AND prep_jdt.date = ja.assignment_date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  fallback_schedule_dates AS (
    SELECT generated_series.date_value::date AS payable_date
    FROM generate_series(schedule_start, schedule_end, INTERVAL '1 day') AS generated_series(date_value)
    WHERE NOT EXISTS (SELECT 1 FROM raw_scheduled_job_date_type_dates)
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = _job_id
          AND prep_jdt.date = generated_series.date_value::date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  payable_dates AS (
    SELECT payable_date
    FROM active_timesheet_dates
    UNION
    SELECT payable_date
    FROM single_day_assignment_dates
    UNION
    SELECT payable_date
    FROM scheduled_job_date_type_dates
    WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
    UNION
    SELECT payable_date
    FROM fallback_schedule_dates
    WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
  ),
  classified_payable_dates AS (
    SELECT
      pd.payable_date,
      (trmd.job_id IS NOT NULL) AS has_override,
      CASE
        WHEN seasonal THEN 'hourly'
        ELSE COALESCE(
          trmd.rate_mode,
          CASE
            WHEN COALESCE(trmd.use_rehearsal_rate, FALSE) THEN 'rehearsal'
            WHEN jrd.job_id IS NOT NULL THEN 'rehearsal'
            ELSE 'standard'
          END
        )
      END AS eff_mode,
      trmd.fixed_amount_eur,
      (
        SELECT COALESCE(SUM(COALESCE(t.amount_eur, 0)), 0)
        FROM public.timesheets t
        WHERE t.job_id = _job_id
          AND t.technician_id = _tech_id
          AND t.date = pd.payable_date
          AND COALESCE(t.is_active, TRUE)
      ) AS ts_amount
    FROM payable_dates pd
    LEFT JOIN public.job_technician_rate_mode_dates trmd
      ON trmd.job_id = _job_id
     AND trmd.technician_id = _tech_id
     AND trmd.date = pd.payable_date
    LEFT JOIN public.job_rehearsal_dates jrd
      ON jrd.job_id = _job_id
     AND jrd.date = pd.payable_date
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'rehearsal')::int,
    COUNT(*) FILTER (WHERE cpd.has_override)::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'hourly')::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'fixed')::int,
    ROUND(COALESCE(SUM(cpd.ts_amount) FILTER (WHERE cpd.eff_mode = 'hourly'), 0), 2),
    ROUND(COALESCE(SUM(cpd.fixed_amount_eur) FILTER (WHERE cpd.eff_mode = 'fixed'), 0), 2)
  INTO scheduled_days, rehearsal_days, technician_override_days, hourly_days, fixed_days, hourly_total, fixed_total
  FROM classified_payable_dates cpd;

  scheduled_days := COALESCE(scheduled_days, 0);
  rehearsal_days := LEAST(COALESCE(rehearsal_days, 0), scheduled_days);
  hourly_days := COALESCE(hourly_days, 0);
  fixed_days := COALESCE(fixed_days, 0);
  standard_days := GREATEST(0, scheduled_days - rehearsal_days - hourly_days - fixed_days);

  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END,
    COALESCE(role IN ('house_tech', 'admin', 'management'), false)
  INTO house, is_autonomo, is_reduced_rehearsal
  FROM public.profiles
  WHERE id = _tech_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','profile_not_found','technician_id',_tech_id);
  END IF;

  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(bool_or(ja.use_tour_multipliers), FALSE)
    INTO has_override
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id AND ja.technician_id = _tech_id;

    has_override := COALESCE(has_override, FALSE);
  END IF;

  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(
      EXISTS (
        SELECT 1
        FROM public.tour_assignments ta
        WHERE ta.tour_id = tour_group
          AND ta.technician_id = _tech_id
      ) OR has_override,
      FALSE
    )
    INTO team_member;

    team_member := COALESCE(team_member, FALSE);
  END IF;

  SELECT iso_year, iso_week INTO y, w
  FROM public.iso_year_week_madrid(st);

  IF standard_days > 0 THEN
    SELECT
      CASE
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
    INTO cat
    FROM public.job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id
    ORDER BY assigned_at DESC
    LIMIT 1;

    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM public.profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;

    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;

    IF cat = 'responsable' THEN
      SELECT COALESCE(
        tour_base_responsable_eur,
        base_day_responsable_eur,
        base_day_especialista_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    ELSIF cat = 'especialista' THEN
      SELECT COALESCE(
        tour_base_especialista_eur,
        tour_base_other_eur,
        base_day_especialista_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    ELSE
      SELECT COALESCE(
        tour_base_other_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    END IF;

    IF standard_base IS NOT NULL THEN
      has_custom_standard_rate := TRUE;
      has_custom_rate := TRUE;
    ELSE
      SELECT base_day_eur INTO standard_base
      FROM public.rate_cards_tour_2025
      WHERE category = cat;

      IF standard_base IS NULL THEN
        RETURN jsonb_build_object('error','tour_base_missing','category',cat);
      END IF;
    END IF;

    standard_base_before_discount := standard_base;

    IF NOT house AND NOT is_autonomo THEN
      standard_discount_per_day := 30.00;
      standard_base := standard_base - standard_discount_per_day;
    END IF;

    standard_after_discount := standard_base;
    standard_day_rate := ROUND(standard_base * per_job_multiplier, 2);
    standard_total := ROUND(standard_day_rate * standard_days, 2);

    -- This deliberately duplicates the canonical payable-date CTEs above
    -- because PL/pgSQL CTEs cannot be reused across separate statements. Keep
    -- raw_scheduled_job_date_type_dates, scheduled_job_date_type_dates,
    -- active_timesheet_dates, single_day_assignment_dates, and
    -- fallback_schedule_dates in sync with the first copy, or refactor them
    -- into a shared SQL function.
    WITH raw_scheduled_job_date_type_dates AS (
      SELECT DISTINCT jdt.date AS payable_date, jdt.type
      FROM public.job_date_types jdt
      WHERE jdt.job_id = _job_id
        AND jdt.type <> 'prep_day'
    ),
    scheduled_job_date_type_dates AS (
      SELECT raw.payable_date
      FROM raw_scheduled_job_date_type_dates raw
      WHERE raw.type <> 'rigging'
         OR EXISTS (
            SELECT 1
            FROM public.job_assignments rja
            WHERE rja.job_id = _job_id
              AND rja.technician_id = _tech_id
              AND COALESCE(rja.single_day, FALSE)
              AND rja.assignment_date = raw.payable_date
          )
         OR EXISTS (
            SELECT 1
            FROM public.timesheets rt
            WHERE rt.job_id = _job_id
              AND rt.technician_id = _tech_id
              AND rt.date = raw.payable_date
              AND COALESCE(rt.is_active, TRUE)
          )
    ),
    active_timesheet_dates AS (
      SELECT DISTINCT t.date AS payable_date
      FROM public.timesheets t
      WHERE t.job_id = _job_id
        AND t.technician_id = _tech_id
        AND COALESCE(t.is_active, TRUE)
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = t.job_id
            AND prep_jdt.date = t.date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    single_day_assignment_dates AS (
      SELECT DISTINCT ja.assignment_date AS payable_date
      FROM public.job_assignments ja
      WHERE ja.job_id = _job_id
        AND ja.technician_id = _tech_id
        AND COALESCE(ja.single_day, FALSE)
        AND ja.assignment_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = ja.job_id
            AND prep_jdt.date = ja.assignment_date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    fallback_schedule_dates AS (
      SELECT generated_series.date_value::date AS payable_date
      FROM generate_series(schedule_start, schedule_end, INTERVAL '1 day') AS generated_series(date_value)
      WHERE NOT EXISTS (SELECT 1 FROM raw_scheduled_job_date_type_dates)
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = _job_id
            AND prep_jdt.date = generated_series.date_value::date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    payable_dates AS (
      SELECT payable_date
      FROM active_timesheet_dates
      UNION
      SELECT payable_date
      FROM single_day_assignment_dates
      UNION
      SELECT payable_date
      FROM scheduled_job_date_type_dates
      WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
      UNION
      SELECT payable_date
      FROM fallback_schedule_dates
      WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
    ),
    standard_payable_dates AS (
      SELECT
        pd.payable_date,
        COALESCE(
          trmd.rate_mode,
          CASE
            WHEN COALESCE(trmd.use_rehearsal_rate, FALSE) THEN 'rehearsal'
            WHEN jrd.job_id IS NOT NULL THEN 'rehearsal'
            ELSE 'standard'
          END
        ) AS eff_mode
      FROM payable_dates pd
      LEFT JOIN public.job_technician_rate_mode_dates trmd
        ON trmd.job_id = _job_id
       AND trmd.technician_id = _tech_id
       AND trmd.date = pd.payable_date
      LEFT JOIN public.job_rehearsal_dates jrd
        ON jrd.job_id = _job_id
       AND jrd.date = pd.payable_date
      WHERE COALESCE(
              trmd.rate_mode,
              CASE
                WHEN COALESCE(trmd.use_rehearsal_rate, FALSE) THEN 'rehearsal'
                WHEN jrd.job_id IS NOT NULL THEN 'rehearsal'
                ELSE 'standard'
              END
            ) IN ('standard','tour_multipliers','no_multipliers')
    ),
    date_multipliers AS (
      SELECT
        spd.payable_date,
        spd.eff_mode,
        CASE
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1
          ELSE GREATEST(COALESCE(weekly_counts.cnt, 0), 1)
        END AS week_count,
        CASE
          WHEN spd.eff_mode = 'no_multipliers' THEN 1.0::numeric
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1.0::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 1 THEN 1.5::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric
          ELSE 1.0::numeric
        END AS week_multiplier,
        CASE
          WHEN spd.eff_mode = 'no_multipliers' THEN 1.0::numeric
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1.0::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 1 THEN 1.5::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric
          ELSE 1.0::numeric
        END AS date_multiplier
      FROM standard_payable_dates spd
      CROSS JOIN LATERAL public.iso_year_week_madrid(spd.payable_date::timestamptz) iw
      LEFT JOIN LATERAL (
        WITH tour_jobs AS (
          SELECT
            j.id AS job_id,
            j.start_time,
            j.end_time,
            j.tour_date_id
          FROM public.jobs j
          WHERE j.job_type = 'tourdate'
            AND j.tour_id = tour_group
            AND j.status != 'Cancelado'
        ),
        technician_job_assignments AS (
          SELECT DISTINCT ja.job_id
          FROM public.job_assignments ja
          JOIN tour_jobs tj
            ON tj.job_id = ja.job_id
          WHERE ja.technician_id = _tech_id
        ),
        raw_scheduled_job_date_type_dates AS (
          SELECT DISTINCT
            tj.job_id,
            jdt.date AS payable_date,
            jdt.type
          FROM tour_jobs tj
          JOIN public.job_date_types jdt
            ON jdt.job_id = tj.job_id
           AND jdt.type <> 'prep_day'
        ),
        scheduled_job_date_type_dates AS (
          SELECT raw.job_id, raw.payable_date
          FROM raw_scheduled_job_date_type_dates raw
          JOIN technician_job_assignments tja
            ON tja.job_id = raw.job_id
          WHERE raw.type <> 'rigging'
             OR EXISTS (
                SELECT 1
                FROM public.job_assignments rja
                WHERE rja.job_id = raw.job_id
                  AND rja.technician_id = _tech_id
                  AND COALESCE(rja.single_day, FALSE)
                  AND rja.assignment_date = raw.payable_date
              )
             OR EXISTS (
                SELECT 1
                FROM public.timesheets rt
                WHERE rt.job_id = raw.job_id
                  AND rt.technician_id = _tech_id
                  AND rt.date = raw.payable_date
                  AND COALESCE(rt.is_active, TRUE)
              )
        ),
        active_timesheet_dates AS (
          SELECT DISTINCT
            tj.job_id,
            t.date AS payable_date
          FROM tour_jobs tj
          JOIN public.timesheets t
            ON t.job_id = tj.job_id
           AND t.technician_id = _tech_id
           AND COALESCE(t.is_active, TRUE)
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.job_date_types prep_jdt
            WHERE prep_jdt.job_id = t.job_id
              AND prep_jdt.date = t.date
              AND prep_jdt.type = 'prep_day'
          )
        ),
        single_day_assignment_dates AS (
          SELECT DISTINCT
            tj.job_id,
            ja.assignment_date AS payable_date
          FROM tour_jobs tj
          JOIN public.job_assignments ja
            ON ja.job_id = tj.job_id
           AND ja.technician_id = _tech_id
           AND COALESCE(ja.single_day, FALSE)
           AND ja.assignment_date IS NOT NULL
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.job_date_types prep_jdt
            WHERE prep_jdt.job_id = ja.job_id
              AND prep_jdt.date = ja.assignment_date
              AND prep_jdt.type = 'prep_day'
          )
        ),
        jobs_with_single_day_assignments AS (
          SELECT DISTINCT job_id
          FROM single_day_assignment_dates
        ),
        job_ranges AS (
          SELECT
            tj.job_id,
            COALESCE(
              MIN(raw.payable_date),
              td.start_date,
              (tj.start_time AT TIME ZONE 'Europe/Madrid')::date,
              td.date
            ) AS schedule_start,
            COALESCE(
              MAX(raw.payable_date),
              td.end_date,
              (tj.end_time AT TIME ZONE 'Europe/Madrid')::date,
              td.start_date,
              td.date,
              (tj.start_time AT TIME ZONE 'Europe/Madrid')::date
            ) AS schedule_end
          FROM tour_jobs tj
          LEFT JOIN public.tour_dates td
            ON td.id = tj.tour_date_id
          LEFT JOIN raw_scheduled_job_date_type_dates raw
            ON raw.job_id = tj.job_id
          GROUP BY
            tj.job_id,
            tj.start_time,
            tj.end_time,
            td.start_date,
            td.end_date,
            td.date
        ),
        fallback_schedule_dates AS (
          SELECT
            jr.job_id,
            generated_series.date_value::date AS payable_date
          FROM job_ranges jr
          JOIN technician_job_assignments tja
            ON tja.job_id = jr.job_id
          CROSS JOIN LATERAL generate_series(
            jr.schedule_start,
            GREATEST(jr.schedule_start, jr.schedule_end),
            INTERVAL '1 day'
          ) AS generated_series(date_value)
          WHERE NOT EXISTS (
              SELECT 1
              FROM raw_scheduled_job_date_type_dates raw
              WHERE raw.job_id = jr.job_id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.job_date_types prep_jdt
              WHERE prep_jdt.job_id = jr.job_id
                AND prep_jdt.date = generated_series.date_value::date
                AND prep_jdt.type = 'prep_day'
            )
        ),
        counted_payable_dates AS (
          SELECT job_id, payable_date
          FROM active_timesheet_dates
          UNION
          SELECT job_id, payable_date
          FROM single_day_assignment_dates
          UNION
          SELECT job_id, payable_date
          FROM scheduled_job_date_type_dates scheduled
          WHERE NOT EXISTS (
            SELECT 1
            FROM jobs_with_single_day_assignments single_day_jobs
            WHERE single_day_jobs.job_id = scheduled.job_id
          )
          UNION
          SELECT job_id, payable_date
          FROM fallback_schedule_dates fallback
          WHERE NOT EXISTS (
            SELECT 1
            FROM jobs_with_single_day_assignments single_day_jobs
            WHERE single_day_jobs.job_id = fallback.job_id
          )
        )
        SELECT COUNT(DISTINCT cpd.payable_date)::int AS cnt
        FROM counted_payable_dates cpd
        CROSS JOIN LATERAL public.iso_year_week_madrid(cpd.payable_date::timestamptz) other_iw
        WHERE other_iw.iso_year = iw.iso_year
          AND other_iw.iso_week = iw.iso_week
      ) weekly_counts ON TRUE
    )
    SELECT
      ROUND(COALESCE(SUM(standard_after_discount * dm.date_multiplier), 0), 2),
      ROUND(COALESCE(SUM((standard_after_discount * dm.date_multiplier) - standard_after_discount), 0), 2),
      COUNT(*) FILTER (WHERE dm.date_multiplier > 1.0)::int,
      COUNT(*) FILTER (WHERE dm.eff_mode = 'tour_multipliers')::int,
      COUNT(*) FILTER (WHERE dm.eff_mode = 'no_multipliers')::int,
      GREATEST(COALESCE(MAX(dm.week_count), 1), 1)::int,
      COALESCE(ROUND(SUM(dm.week_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0),
      COALESCE(ROUND(SUM(dm.date_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0)
    INTO standard_total, standard_multiplier_bonus, multiplied_standard_days, forced_multiplier_days, no_multiplier_days, cnt, display_multiplier, display_per_job_multiplier
    FROM date_multipliers dm;

    per_job_multiplier := display_per_job_multiplier;
    mult := display_multiplier;
    standard_day_rate := ROUND(standard_total / GREATEST(standard_days, 1), 2);
    display_category := cat;
  ELSE
    cnt := 1;
    mult := 1.0;
    per_job_multiplier := 1.0;
    display_multiplier := 1.0;
    display_per_job_multiplier := 1.0;
  END IF;

  IF rehearsal_days > 0 THEN
    SELECT rehearsal_day_eur INTO rehearsal_day_rate
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;

    IF rehearsal_day_rate IS NOT NULL THEN
      has_custom_rehearsal_rate := TRUE;
      has_custom_rate := TRUE;
      rehearsal_base_before_discount := rehearsal_day_rate;
    ELSE
      IF is_reduced_rehearsal THEN
        rehearsal_day_rate := 60.00;
        rehearsal_base_before_discount := 60.00;
      ELSE
        rehearsal_day_rate := 180.00;
        rehearsal_base_before_discount := 180.00;
      END IF;
    END IF;

    IF NOT is_autonomo AND NOT is_reduced_rehearsal THEN
      rehearsal_discount_per_day := 30.00;
      rehearsal_day_rate := rehearsal_day_rate - rehearsal_discount_per_day;
    END IF;

    rehearsal_total := ROUND(rehearsal_day_rate * rehearsal_days, 2);

    IF standard_days = 0 THEN
      display_category := 'rehearsal';
    END IF;
  END IF;

  IF standard_days = 0 AND rehearsal_days = 0 THEN
    display_category := CASE
      WHEN hourly_days > 0 AND fixed_days > 0 THEN 'mixed'
      WHEN hourly_days > 0 THEN 'hourly'
      WHEN fixed_days > 0 THEN 'fixed'
      ELSE display_category
    END;
  END IF;

  total_base := ROUND(standard_total + rehearsal_total + hourly_total + fixed_total, 2);
  total_autonomo_discount := ROUND(
    (standard_discount_per_day * standard_days) + (rehearsal_discount_per_day * rehearsal_days),
    2
  );
  base_calculation_total := ROUND(
    (standard_base_before_discount * standard_days) + (rehearsal_base_before_discount * rehearsal_days)
      + hourly_total + fixed_total,
    2
  );

  IF standard_days > 0 THEN
    after_discount_total := ROUND(
      (standard_after_discount * standard_days) + (rehearsal_day_rate * rehearsal_days)
        + hourly_total + fixed_total,
      2
    );
  ELSE
    after_discount_total := ROUND(
      (rehearsal_day_rate * rehearsal_days) + hourly_total + fixed_total,
      2
    );
  END IF;

  extras := public.extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(total_base + extras_total, 2);

  disclaimer := public.needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_seasonal_house_tech', seasonal,
    'is_tour_team_member', team_member,
    'use_tour_multipliers', has_override,
    'category', display_category,
    'base_day_eur', total_base,
    'has_custom_rate', has_custom_rate,
    'autonomo_discount_eur', total_autonomo_discount,
    'base_day_before_discount_eur', base_calculation_total,
    'week_count', cnt,
    'multiplier', ROUND(display_multiplier, 3),
    'per_job_multiplier', ROUND(display_per_job_multiplier, 3),
    'iso_year', y,
    'iso_week', w,
    'total_eur', total_base,
    'extras', extras,
    'extras_total_eur', ROUND(extras_total, 2),
    'total_with_extras_eur', final_total,
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
    'breakdown', jsonb_build_object(
      'base_calculation', base_calculation_total,
      'autonomo_discount', total_autonomo_discount,
      'after_discount', after_discount_total,
      'multiplier', ROUND(display_multiplier, 3),
      'per_job_multiplier', ROUND(display_per_job_multiplier, 3),
      'final_base', total_base,
      'has_custom_rate', has_custom_rate,
      'has_custom_standard_rate', has_custom_standard_rate,
      'has_custom_rehearsal_rate', has_custom_rehearsal_rate,
      'scheduled_days', scheduled_days,
      'rehearsal_days', rehearsal_days,
      'standard_days', standard_days,
      'technician_override_days', technician_override_days,
      'multiplied_standard_days', multiplied_standard_days,
      'standard_multiplier_bonus_eur', standard_multiplier_bonus,
      'hourly_days', hourly_days,
      'seasonal_overtime_only', seasonal,
      'hourly_total_eur', hourly_total,
      'fixed_days', fixed_days,
      'fixed_total_eur', fixed_total,
      'forced_multiplier_days', forced_multiplier_days,
      'no_multiplier_days', no_multiplier_days,
      'rehearsal_rate_eur', CASE WHEN rehearsal_days > 0 THEN rehearsal_day_rate ELSE NULL END,
      'standard_day_rate_eur', CASE WHEN standard_days > 0 THEN standard_day_rate ELSE NULL END,
      'forced_rehearsal_rate', (rehearsal_days > 0),
      'prep_days_excluded_from_multiplier', true,
      'rigging_dates_scoped_to_assigned_techs', true,
      'weekly_multiplier_rule', '1_date_1_5x__2_dates_1_125x__3_plus_1x',
      'per_payable_date_weekly_multipliers', true,
      'weekly_multiplier_count_uses_timesheets', true
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) FROM PUBLIC;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes. Seasonal house tech profiles force every payable date into hourly mode. Each payable date resolves an effective rate_mode from job_technician_rate_mode_dates (rehearsal, standard, tour_multipliers, no_multipliers, hourly, fixed) then job_rehearsal_dates. Standard-family dates use the per-payable-date weekly multipliers (1 date 1.5x, 2 dates 1.125x each, 3+ dates 1x); tour_multipliers forces those multipliers even off-team, no_multipliers forces 1x. Hourly dates add the technician timesheet amount; fixed dates add fixed_amount_eur. Prep days are excluded.';


-- Include the seasonal range in assignment conflict checks.
CREATE OR REPLACE FUNCTION public.check_technician_conflicts(
  _technician_id uuid,
  _target_job_id uuid,
  _target_date date DEFAULT NULL::date,
  _single_day boolean DEFAULT false,
  _include_pending boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_target_job RECORD;
  v_start_date DATE;
  v_end_date DATE;
  v_hard_conflicts JSONB := '[]'::JSONB;
  v_soft_conflicts JSONB := '[]'::JSONB;
  v_unavailability JSONB := '[]'::JSONB;
  v_seasonal_unavailability JSONB := '[]'::JSONB;
BEGIN
  -- Get target job details
  SELECT start_time::DATE, end_time::DATE
  INTO v_target_job
  FROM jobs
  WHERE id = _target_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasHardConflict', false,
      'hasSoftConflict', false,
      'hardConflicts', '[]'::JSONB,
      'softConflicts', '[]'::JSONB,
      'unavailabilityConflicts', '[]'::JSONB
    );
  END IF;

  -- Determine date range to check
  IF _target_date IS NOT NULL THEN
    v_start_date := _target_date;
    v_end_date := _target_date;
  ELSE
    v_start_date := v_target_job.start_time;
    v_end_date := v_target_job.end_time;
  END IF;

  -- Check for hard conflicts (confirmed assignments via ACTIVE timesheets)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'start_time', j.start_time,
      'end_time', j.end_time,
      'status', 'confirmed'
    )
  ), '[]'::JSONB)
  INTO v_hard_conflicts
  FROM timesheets ts
  JOIN jobs j ON j.id = ts.job_id
  WHERE ts.technician_id = _technician_id
    AND ts.is_active = true
    AND ts.job_id != _target_job_id
    AND ts.date >= v_start_date
    AND ts.date <= v_end_date;

  -- Check for soft conflicts (pending invitations) if requested
  IF _include_pending THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'start_time', j.start_time,
        'end_time', j.end_time,
        'status', 'pending'
      )
    ), '[]'::JSONB)
    INTO v_soft_conflicts
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.technician_id = _technician_id
      AND ja.job_id != _target_job_id
      AND ja.status = 'invited'
      AND (
        (_target_date IS NOT NULL AND EXISTS (
          SELECT 1 FROM timesheets ts
          WHERE ts.job_id = ja.job_id
            AND ts.technician_id = _technician_id
            AND ts.is_active = true
            AND ts.date = _target_date
        ))
        OR (_target_date IS NULL AND (
          j.start_time::DATE <= v_end_date AND
          j.end_time::DATE >= v_start_date
        ))
      );
  END IF;

  -- Check for unavailability conflicts.
  -- technician_availability.technician_id is legacy varchar, so compare as text.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ta.date,
      'reason', CASE
        WHEN ta.status = 'day_off' THEN 'Day Off'
        WHEN ta.status = 'travel' THEN 'Travel'
        WHEN ta.status = 'sick' THEN 'Sick'
        WHEN ta.status = 'vacation' THEN 'Vacation'
        ELSE 'Unavailable'
      END,
      'source', 'technician_availability'
    )
  ), '[]'::JSONB)
  INTO v_unavailability
  FROM technician_availability ta
  WHERE ta.technician_id = _technician_id::text
    AND ta.date >= v_start_date
    AND ta.date <= v_end_date;

  -- A seasonal house tech is unavailable outside the inclusive profile range.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', generated_date::date,
      'reason', 'Fuera de temporada',
      'source', 'seasonal_house_tech_profile',
      'notes', 'Fuera del rango de disponibilidad de temporada'
    ) ORDER BY generated_date
  ), '[]'::jsonb)
  INTO v_seasonal_unavailability
  FROM public.profiles p
  CROSS JOIN LATERAL generate_series(v_start_date, v_end_date, interval '1 day') generated_date
  WHERE p.id = _technician_id
    AND p.role = 'house_tech'
    AND p.seasonal_house_tech = true
    AND (generated_date::date < p.seasonal_house_tech_start_date
      OR generated_date::date > p.seasonal_house_tech_end_date);

  v_unavailability := v_unavailability || v_seasonal_unavailability;

  v_result := jsonb_build_object(
    'hasHardConflict', jsonb_array_length(v_hard_conflicts) > 0,
    'hasSoftConflict', jsonb_array_length(v_soft_conflicts) > 0,
    'hardConflicts', v_hard_conflicts,
    'softConflicts', v_soft_conflicts,
    'unavailabilityConflicts', v_unavailability
  );

  RETURN v_result;
END;
$function$;


-- Exclude out-of-season profiles from staffing recommendations.
CREATE OR REPLACE FUNCTION public.rank_staffing_candidates(
  p_job_id uuid,
  p_department text,
  p_role_code text,
  p_mode text,
  p_policy jsonb
) RETURNS TABLE (
  profile_id uuid,
  full_name text,
  department text,
  skills_score int,
  distance_to_madrid_km double precision,
  proximity_score int,
  experience_score int,
  reliability_score int,
  fairness_score int,
  soft_conflict boolean,
  hard_conflict boolean,
  final_score int,
  reasons jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_skills numeric := COALESCE((p_policy->'weights'->>'skills')::numeric, 0.5);
  w_proximity numeric := COALESCE((p_policy->'weights'->>'proximity')::numeric, 0.1);
  w_reliability numeric := COALESCE((p_policy->'weights'->>'reliability')::numeric, 0.2);
  w_fairness numeric := COALESCE((p_policy->'weights'->>'fairness')::numeric, 0.1);
  w_experience numeric := COALESCE((p_policy->'weights'->>'experience')::numeric, 0.1);
  w_sum numeric;
  v_soft_conflict_policy text := COALESCE(p_policy->>'soft_conflict_policy', 'warn');
  v_exclude_fridge boolean := COALESCE((p_policy->>'exclude_fridge')::boolean, true);
  v_job_start timestamptz;
  v_job_end timestamptz;
  v_normalized_role_code text := NULLIF(BTRIM(p_role_code), '');
  v_role_prefix text;
  v_base_lat double precision := 40.4168;
  v_base_lng double precision := -3.7038;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = p_department
          OR (p_department = 'production' AND p.department = 'logistics')
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to rank candidates';
    END IF;
  END IF;

  SELECT j.start_time, j.end_time
  INTO v_job_start, v_job_end
  FROM jobs j
  WHERE j.id = p_job_id;

  IF v_job_start IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  v_role_prefix := public.staffing_role_prefix(v_normalized_role_code);

  w_sum := w_skills + w_proximity + w_reliability + w_fairness + w_experience;
  IF w_sum <= 0 THEN
    w_skills := 0.5;
    w_proximity := 0.1;
    w_reliability := 0.2;
    w_fairness := 0.1;
    w_experience := 0.1;
    w_sum := 1;
  END IF;

  w_skills := w_skills / w_sum;
  w_proximity := w_proximity / w_sum;
  w_reliability := w_reliability / w_sum;
  w_fairness := w_fairness / w_sum;
  w_experience := w_experience / w_sum;

  RETURN QUERY
  WITH target_dates AS (
    SELECT generate_series(v_job_start::date, v_job_end::date, interval '1 day')::date AS target_date
  ),
  base AS (
    SELECT
      p.id AS profile_id,
      NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), '') AS full_name,
      COALESCE(p.department, '') AS department,
      p.role AS user_role,
      p.home_latitude,
      p.home_longitude,
      COALESCE(tf.in_fridge, false) AS in_fridge,
      (
        SELECT MAX(ts.date)::date
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
      ) AS last_work_date,
      (
        SELECT COUNT(DISTINCT ts.job_id)
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
      ) AS jobs_worked,
      (
        SELECT COUNT(*)
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
          AND ts.date >= date_trunc('month', now())::date
          AND ts.date < (date_trunc('month', now()) + interval '1 month')::date
      ) AS current_month_days,
      EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja2.status, 'invited') <> 'declined'
          AND EXISTS (
            SELECT 1
            FROM target_dates td
            WHERE td.target_date BETWEEN j2.start_time::date AND j2.end_time::date
          )
          AND NOT (j2.time_range && tstzrange(v_job_start, v_job_end, '[]'))
      ) AS has_same_day_job
    FROM profiles p
    LEFT JOIN technician_fridge tf ON tf.technician_id = p.id
    WHERE
      (
        p.role IN ('technician', 'house_tech')
        OR (p.role NOT IN ('technician', 'house_tech') AND p.assignable_as_tech = true)
      )
      AND (
        (p_department <> 'production' AND p.department = p_department)
        OR (p_department = 'production' AND p.department IN ('production', 'logistics'))
      )
      AND (NOT v_exclude_fridge OR COALESCE(tf.in_fridge, false) = false)
      AND (
        p.role <> 'house_tech'
        OR p.seasonal_house_tech = false
        OR NOT EXISTS (
          SELECT 1
          FROM target_dates seasonal_target
          WHERE seasonal_target.target_date < p.seasonal_house_tech_start_date
             OR seasonal_target.target_date > p.seasonal_house_tech_end_date
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja
        WHERE ja.job_id = p_job_id
          AND ja.technician_id = p.id
          AND COALESCE(ja.status, 'invited') <> 'declined'
      )
      AND (
        v_normalized_role_code IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM staffing_requests sr
          WHERE sr.job_id = p_job_id
            AND sr.profile_id = p.id
            AND NULLIF(BTRIM(sr.role_code), '') = v_normalized_role_code
            AND sr.phase IN ('availability', 'offer')
            AND sr.status IN ('pending', 'confirmed', 'declined')
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM staffing_requests sr
        WHERE sr.job_id = p_job_id
          AND sr.profile_id = p.id
          AND NULLIF(BTRIM(sr.role_code), '') IS NULL
          AND sr.phase IN ('availability', 'offer')
          AND sr.status = 'declined'
          AND (
            sr.single_day = false
            OR sr.target_date IS NULL
            OR sr.target_date BETWEEN v_job_start::date AND v_job_end::date
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
        JOIN target_dates td ON td.target_date = ta.date
        WHERE ta.technician_id = p.id::text
      )
      AND NOT EXISTS (
        SELECT 1
        FROM timesheets ts
        JOIN target_dates td ON td.target_date = ts.date
        WHERE ts.technician_id = p.id
          AND ts.job_id IS DISTINCT FROM p_job_id
          AND ts.is_active = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja2.status, 'invited') <> 'declined'
          AND j2.time_range && tstzrange(v_job_start, v_job_end, '[]')
      )
  ),
  skill_scores AS (
    SELECT
      b.profile_id,
      COALESCE(
        (
          SELECT MAX(
            LEAST(100,
              (CASE WHEN ps.is_primary THEN 60 ELSE 40 END) +
              (COALESCE(ps.proficiency, 0) * 8)
            ) * rsm.weight
          )::int
          FROM profile_skills ps
          JOIN skills s ON s.id = ps.skill_id AND s.active = true
          JOIN role_skill_mapping rsm ON LOWER(rsm.skill_name) = LOWER(s.name)
          WHERE ps.profile_id = b.profile_id
            AND rsm.role_prefix = v_role_prefix
            AND COALESCE(ps.proficiency, 0) > 0
        ),
        0
      ) AS manual_skill_score,
      (
        SELECT jsonb_build_object(
          'name', s.name,
          'proficiency', ps.proficiency,
          'is_primary', ps.is_primary,
          'weight', rsm.weight
        )
        FROM profile_skills ps
        JOIN skills s ON s.id = ps.skill_id AND s.active = true
        JOIN role_skill_mapping rsm ON LOWER(rsm.skill_name) = LOWER(s.name)
        WHERE ps.profile_id = b.profile_id
          AND rsm.role_prefix = v_role_prefix
          AND COALESCE(ps.proficiency, 0) > 0
        ORDER BY
          LEAST(100, (CASE WHEN ps.is_primary THEN 60 ELSE 40 END) + (COALESCE(ps.proficiency, 0) * 8)) * rsm.weight DESC
        LIMIT 1
      ) AS best_skill
    FROM base b
  ),
  role_experience AS (
    SELECT
      b.profile_id,
      COUNT(DISTINCT ja.job_id)::int AS role_completed_jobs
    FROM base b
    JOIN job_assignments ja ON ja.technician_id = b.profile_id
      AND ja.status = 'confirmed'
    JOIN jobs j ON j.id = ja.job_id
      AND j.status = 'Completado'
    WHERE public.staffing_role_prefix(
      CASE p_department
        WHEN 'sound' THEN ja.sound_role
        WHEN 'lights' THEN ja.lights_role
        WHEN 'video' THEN ja.video_role
        WHEN 'production' THEN ja.production_role
        ELSE COALESCE(ja.sound_role, ja.lights_role, ja.video_role, ja.production_role)
      END
    ) = v_role_prefix
    GROUP BY b.profile_id
  ),
  reliability_stats AS (
    SELECT
      sr.profile_id,
      COUNT(*) FILTER (WHERE sr.phase = 'availability' AND sr.status = 'confirmed') AS avail_yes,
      COUNT(*) FILTER (WHERE sr.phase = 'availability' AND sr.status IN ('confirmed', 'declined')) AS avail_total,
      COUNT(*) FILTER (WHERE sr.phase = 'offer' AND sr.status = 'confirmed') AS offer_yes,
      COUNT(*) FILTER (WHERE sr.phase = 'offer' AND sr.status IN ('confirmed', 'declined')) AS offer_total
    FROM staffing_requests sr
    GROUP BY sr.profile_id
  ),
  with_reliability AS (
    SELECT
      b.*,
      ss.manual_skill_score,
      ss.best_skill,
      COALESCE(re.role_completed_jobs, 0)::int AS role_completed_jobs,
      (
        CASE
          WHEN COALESCE(re.role_completed_jobs, 0) >= 11 THEN 80
          WHEN COALESCE(re.role_completed_jobs, 0) >= 7 THEN 65
          WHEN COALESCE(re.role_completed_jobs, 0) >= 4 THEN 50
          WHEN COALESCE(re.role_completed_jobs, 0) >= 2 THEN 35
          WHEN COALESCE(re.role_completed_jobs, 0) = 1 THEN 20
          ELSE 0
        END
      )::int AS role_experience_score,
      COALESCE(rs.avail_yes, 0) AS avail_yes,
      COALESCE(rs.avail_total, 0) AS avail_total,
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
  ),
  scored AS (
    SELECT
      wr.profile_id,
      wr.full_name,
      wr.department,
      wr.user_role,
      GREATEST(wr.manual_skill_score, wr.role_experience_score)::int AS skills_score,
      wr.manual_skill_score,
      wr.best_skill,
      wr.role_completed_jobs,
      wr.role_experience_score,
      wr.jobs_worked,
      wr.current_month_days,
      CASE
        WHEN wr.home_latitude IS NOT NULL
          AND wr.home_longitude IS NOT NULL
        THEN distance_km(wr.home_latitude, wr.home_longitude, v_base_lat, v_base_lng)
        ELSE NULL
      END AS distance_to_base_km,
      LEAST(wr.jobs_worked, 10)::int AS experience_score,
      (
        CASE
          WHEN wr.avail_total > 0 OR wr.offer_total > 0 THEN
            ROUND(
              COALESCE(wr.avail_yes::numeric / NULLIF(wr.avail_total, 0), 0) * 5 +
              COALESCE(wr.offer_yes::numeric / NULLIF(wr.offer_total, 0), 0) * 5
            )
          ELSE 5
        END
      )::int AS reliability_score,
      (
        CASE
          WHEN wr.user_role = 'house_tech' AND wr.current_month_days < 4 THEN 10
          WHEN wr.last_work_date IS NULL THEN 10
          WHEN (now()::date - wr.last_work_date) > 30 THEN 10
          WHEN (now()::date - wr.last_work_date) > 14 THEN 7
          ELSE 3
        END
      )::int AS fairness_score,
      wr.has_same_day_job AS soft_conflict,
      false AS hard_conflict
    FROM with_reliability wr
  ),
  with_proximity AS (
    SELECT
      s.*,
      CASE
        WHEN s.distance_to_base_km IS NULL THEN 5
        WHEN s.distance_to_base_km <= 25 THEN 10
        WHEN s.distance_to_base_km <= 50 THEN 8
        WHEN s.distance_to_base_km <= 100 THEN 6
        WHEN s.distance_to_base_km <= 200 THEN 4
        WHEN s.distance_to_base_km <= 400 THEN 2
        ELSE 1
      END AS proximity_score
    FROM scored s
  ),
  filtered AS (
    SELECT s.*
    FROM with_proximity s
    WHERE s.hard_conflict = false
      AND (v_soft_conflict_policy <> 'block' OR s.soft_conflict = false)
  )
  SELECT
    f.profile_id,
    COALESCE(f.full_name, 'Unknown') AS full_name,
    f.department,
    f.skills_score,
    f.distance_to_base_km AS distance_to_madrid_km,
    f.proximity_score,
    f.experience_score,
    f.reliability_score,
    f.fairness_score,
    f.soft_conflict,
    f.hard_conflict,
    LEAST(
      100,
      ROUND(
        (
          (f.skills_score::numeric) * w_skills +
          (f.proximity_score::numeric * 10) * w_proximity +
          (f.reliability_score::numeric * 10) * w_reliability +
          (f.fairness_score::numeric * 10) * w_fairness +
          (f.experience_score::numeric * 10) * w_experience
        ) * (
          CASE
            WHEN f.user_role = 'house_tech' AND f.current_month_days < 4 THEN 1.3
            ELSE 1.0
          END
        )
      )::int
    ) AS final_score,
    jsonb_build_array(
      CASE
        WHEN f.manual_skill_score > 0 AND f.best_skill IS NOT NULL THEN
          (CASE WHEN (f.best_skill->>'is_primary')::boolean THEN 'Primary skill: ' ELSE 'Skill: ' END) ||
          (f.best_skill->>'name') || ' (lvl ' || (f.best_skill->>'proficiency') || ')' ||
          (CASE WHEN (f.best_skill->>'weight')::numeric < 1 THEN ' [related]' ELSE '' END)
        ELSE 'No matching manual skill for ' || COALESCE(v_role_prefix, p_role_code)
      END,
      CASE
        WHEN f.distance_to_base_km IS NOT NULL THEN
          'Proximity: ' || ROUND(f.distance_to_base_km::numeric, 1) || 'km (' || f.proximity_score || '/10)'
        ELSE 'Proximity: No location data'
      END,
      'Reliability: ' || f.reliability_score || '/10',
      'Fairness: ' || f.fairness_score || '/10',
      'Experience: ' || f.experience_score || '/10'
    ) ||
    (CASE
      WHEN f.role_completed_jobs > 0
      THEN jsonb_build_array('Role experience: ' || f.role_completed_jobs || ' completed ' || COALESCE(v_role_prefix, p_role_code) || ' jobs')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.role_experience_score > f.manual_skill_score
      THEN jsonb_build_array('Skill score boosted by completed role history')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.user_role = 'house_tech' AND f.current_month_days < 4
      THEN jsonb_build_array('House tech boost (+30%)')
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
  FROM filtered f
  ORDER BY final_score DESC, f.profile_id
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
