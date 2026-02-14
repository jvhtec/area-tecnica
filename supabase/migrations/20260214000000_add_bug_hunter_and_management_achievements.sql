-- ============================================================================
-- Add Bug Hunter (community) and Management achievements
-- Extends the achievement system with new categories and metrics
-- ============================================================================

-- 1. Extend the category CHECK constraint to include 'community' and 'management'
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('volume', 'house', 'reliability', 'endurance', 'diversity', 'community', 'management', 'hidden'));

-- 2. Insert new achievements
-- Only achievements with working database metrics are included.
-- Achievements referencing tables/columns that don't yet exist are deferred.
INSERT INTO achievements (code, title, description, hint, category, evaluation_type, metric_key, threshold, threshold_param, is_hidden, icon, sort_order) VALUES

-- Community (1)
('bug_hunter', 'Cazador de Bugs', 'Has reportado 5 o mas bugs para ayudar a mejorar la plataforma.', 'Reporta bugs desde la pagina de Soporte', 'community', 'threshold', 'bug_reports_submitted', 5, NULL, false, '🐛', 310),

-- Management Only - Job Operations (8)
('first_job_created',     'Primer Trabajo Creado',  'Has creado tu primer trabajo en el sistema.',                  'Crea un trabajo desde el calendario',   'management', 'threshold', 'jobs_created',        1,   NULL, false, '📝', 320),
('job_machine',           'Maquina de Bolos',       '10 trabajos creados. Ya dominas el sistema.',                  NULL,                                    'management', 'threshold', 'jobs_created',        10,  NULL, false, '⚙️', 330),
('booking_boss',          'Jefe de Booking',        '50 trabajos creados. Eres el motor de la productora.',         NULL,                                    'management', 'threshold', 'jobs_created',        50,  NULL, false, '👔', 340),
('production_powerhouse', 'Potencia de Produccion', '100 trabajos creados. La agenda gira alrededor tuyo.',         NULL,                                    'management', 'threshold', 'jobs_created',        100, NULL, false, '🏭', 350),
('unstoppable_booker',    'Booker Imparable',       '250 trabajos creados. Tienes el calendario en la sangre.',     NULL,                                    'management', 'threshold', 'jobs_created',        250, NULL, false, '🚀', 360),
('first_confirmation',    'Primera Confirmacion',   'Has confirmado tu primer trabajo.',                            'Confirma un trabajo pendiente',         'management', 'threshold', 'jobs_confirmed',      1,   NULL, false, '✓',  370),
('confirmation_king',     'Rey de Confirmaciones',  '50 confirmaciones. La produccion avanza gracias a ti.',        NULL,                                    'management', 'threshold', 'jobs_confirmed',      50,  NULL, false, '👑', 380),
('master_coordinator',    'Coordinador Maestro',    '100 confirmaciones. Nada se mueve sin tu aprobacion.',         NULL,                                    'management', 'threshold', 'jobs_confirmed',      100, NULL, false, '🎯', 390),

-- Management Only - Crew Management (7)
('first_assignment',      'Primera Asignacion',        'Has asignado a tu primer tecnico.',                            'Asigna un tecnico a un trabajo',        'management', 'threshold', 'assignments_created', 1,   NULL, false, '👤', 460),
('crew_builder',          'Constructor de Crew',       '25 asignaciones. Ya montas equipos con soltura.',              NULL,                                    'management', 'threshold', 'assignments_created', 25,  NULL, false, '👥', 470),
('staffing_expert',       'Experto en Staffing',       '100 asignaciones. Conoces a cada tecnico y su especialidad.', NULL,                                    'management', 'threshold', 'assignments_created', 100, NULL, false, '🎓', 480),
('workforce_commander',   'Comandante de Personal',    '500 asignaciones. Orquestas equipos como un director.',       NULL,                                    'management', 'threshold', 'assignments_created', 500, NULL, false, '🎼', 490),
('first_timesheet_ok',    'Primer Timesheet Aprobado', 'Has aprobado tu primer timesheet.',                            'Aprueba un timesheet pendiente',        'management', 'threshold', 'timesheets_approved', 1,   NULL, false, '⏰', 500),
('payroll_manager',       'Gestor de Nominas',         '50 timesheets aprobados. El equipo cobra gracias a ti.',      NULL,                                    'management', 'threshold', 'timesheets_approved', 50,  NULL, false, '💰', 510),
('timesheet_guardian',    'Guardian de Timesheets',    '200 timesheets aprobados. Nadie escapa a tu revision.',        NULL,                                    'management', 'threshold', 'timesheets_approved', 200, NULL, false, '🛡️', 520),

-- Management Only - Communication (2)
('first_announcement',    'Primer Anuncio',   'Has publicado tu primer anuncio para el equipo.', 'Publica un anuncio desde la app', 'management', 'threshold', 'announcements_sent', 1,  NULL, false, '📢', 540),
('town_crier',            'Pregonero',        '10 anuncios publicados. Mantienes informado al equipo.',       NULL,                              'management', 'threshold', 'announcements_sent', 10, NULL, false, '🔔', 550),

-- Management Only - Operations (3)
('equipment_guru',        'Guru del Equipamiento',     'Has gestionado 25 movimientos de equipamiento.',              'Gestiona el inventario de equipos',     'management', 'threshold', 'equipment_managed',   25,  NULL, false, '🎚️', 580),
('subrental_specialist',  'Especialista en Subrental', '10 subrentals gestionados. Sabes cuando pedir refuerzos.',   NULL,                                    'management', 'threshold', 'subrentals_managed',  10,  NULL, false, '📦', 590),
('operations_mastermind', 'Cerebro de Operaciones',    '500 acciones totales de gestion. Eres el corazon del sistema.', NULL,                                 'management', 'threshold', 'total_mgmt_actions',  500, NULL, false, '🧠', 610),

-- Management Only - Financial (1)
('rate_negotiator', 'Negociador de Tarifas', 'Has gestionado tarifas para 25 tecnicos.', 'Gestiona tarifas personalizadas', 'management', 'threshold', 'rates_negotiated', 25, NULL, false, '💼', 900)

ON CONFLICT (code) DO NOTHING;

-- 3. Update the evaluation function to include bug_reports_submitted and management metrics
CREATE OR REPLACE FUNCTION evaluate_user_achievements(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_metric_value integer;
  v_new_unlocks integer := 0;
  v_is_house_tech boolean;
  v_ach record;
  v_met_key text;
  v_progress_value integer;
BEGIN
  -- Check if user is a house tech
  SELECT (role = 'house_tech') INTO v_is_house_tech
  FROM profiles WHERE id = p_user_id;

  IF v_is_house_tech IS NULL THEN
    RETURN 0; -- user not found
  END IF;

  -- ---- Metric: job_count ----
  SELECT COUNT(*) INTO v_metric_value
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.technician_id = p_user_id
    AND ja.status = 'confirmed'
    AND j.status = 'Completado'
    AND j.start_time::date <= CURRENT_DATE;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'job_count', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: house_job_count (same as job_count but only for house techs) ----
  IF v_is_house_tech THEN
    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'house_job_count', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();
  END IF;

  -- ---- Metric: venue_count ----
  SELECT COUNT(DISTINCT j.location_id) INTO v_metric_value
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.technician_id = p_user_id
    AND ja.status = 'confirmed'
    AND j.status = 'Completado'
    AND j.location_id IS NOT NULL
    AND j.start_time::date <= CURRENT_DATE;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'venue_count', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: festival_job_count ----
  SELECT COUNT(*) INTO v_metric_value
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.technician_id = p_user_id
    AND ja.status = 'confirmed'
    AND j.status = 'Completado'
    AND j.job_type = 'festival'
    AND j.start_time::date <= CURRENT_DATE;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'festival_job_count', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: long_shift_12h ----
  SELECT COUNT(*) INTO v_metric_value
  FROM timesheets t
  JOIN jobs j ON j.id = t.job_id
  WHERE t.technician_id = p_user_id
    AND j.status = 'Completado'
    AND t.start_time IS NOT NULL
    AND t.end_time IS NOT NULL
    AND j.start_time::date <= CURRENT_DATE
    AND (
      EXTRACT(EPOCH FROM (
        CASE WHEN t.end_time >= t.start_time
          THEN t.end_time - t.start_time
          ELSE t.end_time - t.start_time + INTERVAL '24 hours'
        END
      )) / 3600.0 - COALESCE(t.break_minutes, 0) / 60.0
    ) > 12;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'long_shift_12h', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: long_shift_16h ----
  SELECT COUNT(*) INTO v_metric_value
  FROM timesheets t
  JOIN jobs j ON j.id = t.job_id
  WHERE t.technician_id = p_user_id
    AND j.status = 'Completado'
    AND t.start_time IS NOT NULL
    AND t.end_time IS NOT NULL
    AND j.start_time::date <= CURRENT_DATE
    AND (
      EXTRACT(EPOCH FROM (
        CASE WHEN t.end_time >= t.start_time
          THEN t.end_time - t.start_time
          ELSE t.end_time - t.start_time + INTERVAL '24 hours'
        END
      )) / 3600.0 - COALESCE(t.break_minutes, 0) / 60.0
    ) > 16;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'long_shift_16h', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: consecutive_months ----
  WITH monthly_activity AS (
    SELECT DISTINCT date_trunc('month', j.start_time AT TIME ZONE 'Europe/Madrid')::date AS month_start
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.technician_id = p_user_id
      AND ja.status = 'confirmed'
      AND j.status = 'Completado'
      AND j.start_time::date <= CURRENT_DATE
  ),
  numbered AS (
    SELECT month_start,
      ROW_NUMBER() OVER (ORDER BY month_start DESC) AS rn
    FROM monthly_activity
  ),
  with_expected AS (
    SELECT month_start, rn,
      (date_trunc('month', CURRENT_DATE) - ((rn - 1) || ' months')::interval)::date AS expected_month
    FROM numbered
  )
  SELECT COUNT(*) INTO v_metric_value
  FROM with_expected
  WHERE month_start = expected_month;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'consecutive_months', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: no_cancel_streak ----
  WITH ordered_assignments AS (
    SELECT ja.status AS assign_status,
      ROW_NUMBER() OVER (ORDER BY j.start_time DESC) AS rn
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.technician_id = p_user_id
      AND j.start_time::date <= CURRENT_DATE
      AND ja.status IN ('confirmed', 'declined')
      AND j.status = 'Completado'
  ),
  first_decline AS (
    SELECT MIN(rn) AS decline_rn
    FROM ordered_assignments
    WHERE assign_status = 'declined'
  )
  SELECT CASE
    WHEN fd.decline_rn IS NULL THEN (SELECT COUNT(*) FROM ordered_assignments)
    ELSE fd.decline_rn - 1
  END INTO v_metric_value
  FROM first_decline fd;

  v_metric_value := COALESCE(v_metric_value, 0);

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'no_cancel_streak', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ---- Metric: bug_reports_submitted ----
  SELECT COUNT(*) INTO v_metric_value
  FROM bug_reports
  WHERE created_by = p_user_id;

  INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
  VALUES (p_user_id, 'bug_reports_submitted', v_metric_value, now())
  ON CONFLICT (user_id, metric_key)
  DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  -- ============================================================================
  -- Management Metrics (only calculated for admin/management roles)
  -- Only metrics with verified database columns are included.
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role IN ('admin', 'management')) THEN

    -- ---- Metric: jobs_created ----
    SELECT COUNT(*) INTO v_metric_value
    FROM jobs
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'jobs_created', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: jobs_confirmed ----
    SELECT COUNT(*) INTO v_metric_value
    FROM jobs
    WHERE created_by = p_user_id AND status = 'confirmado';

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'jobs_confirmed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: assignments_created ----
    -- Uses assigned_by (not created_by) on job_assignments
    SELECT COUNT(*) INTO v_metric_value
    FROM job_assignments
    WHERE assigned_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'assignments_created', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: timesheets_approved ----
    -- Uses status enum value 'approved' (not 'aprobado')
    SELECT COUNT(*) INTO v_metric_value
    FROM timesheets
    WHERE created_by = p_user_id AND status = 'approved';

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'timesheets_approved', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: announcements_sent ----
    SELECT COUNT(*) INTO v_metric_value
    FROM announcements
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'announcements_sent', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: equipment_managed ----
    -- Uses user_id (not created_by) on stock_movements
    SELECT COUNT(*) INTO v_metric_value
    FROM stock_movements
    WHERE user_id = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'equipment_managed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: subrentals_managed ----
    -- Table is sub_rentals (not subrental_requests)
    SELECT COUNT(*) INTO v_metric_value
    FROM sub_rentals
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'subrentals_managed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: rates_negotiated ----
    -- Uses updated_by (not created_by) on custom_tech_rates
    SELECT COUNT(*) INTO v_metric_value
    FROM custom_tech_rates
    WHERE updated_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'rates_negotiated', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: total_mgmt_actions ----
    -- Aggregate of all working management metrics
    SELECT COALESCE(
      (SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'jobs_created'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'jobs_confirmed'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'assignments_created'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'timesheets_approved'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'announcements_sent'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'equipment_managed'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'subrentals_managed'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'rates_negotiated'), 0)
    INTO v_metric_value;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'total_mgmt_actions', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

  END IF;

  -- ============================================================================
  -- Check all active achievements and unlock newly qualified ones
  -- ============================================================================
  FOR v_ach IN
    SELECT a.id, a.evaluation_type, a.metric_key AS ach_metric_key, a.threshold
    FROM achievements a
    WHERE a.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM achievement_unlocks au
        WHERE au.user_id = p_user_id AND au.achievement_id = a.id
      )
  LOOP
    -- Skip house achievements for non-house techs
    IF v_ach.evaluation_type = 'house_job_count' AND NOT v_is_house_tech THEN
      CONTINUE;
    END IF;

    SELECT current_value INTO v_progress_value
    FROM achievement_progress
    WHERE user_id = p_user_id AND metric_key = v_ach.ach_metric_key;

    IF v_progress_value IS NOT NULL AND v_progress_value >= v_ach.threshold THEN
      INSERT INTO achievement_unlocks (user_id, achievement_id, unlocked_at, seen)
      VALUES (p_user_id, v_ach.id, now(), false)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;

      v_new_unlocks := v_new_unlocks + 1;
    END IF;
  END LOOP;

  RETURN v_new_unlocks;
END;
$$;

-- Also update evaluate_daily_achievements with proper search_path
CREATE OR REPLACE FUNCTION evaluate_daily_achievements()
RETURNS TABLE(user_id uuid, new_unlocks integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tech record;
  v_unlocks integer;
BEGIN
  FOR v_tech IN
    SELECT DISTINCT ja.technician_id
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    JOIN profiles p ON p.id = ja.technician_id
    WHERE j.status = 'Completado'
      AND j.start_time::date = CURRENT_DATE - INTERVAL '1 day'
      AND ja.status = 'confirmed'
      AND p.role IN ('technician', 'house_tech')
  LOOP
    v_unlocks := evaluate_user_achievements(v_tech.technician_id);
    IF v_unlocks > 0 THEN
      user_id := v_tech.technician_id;
      new_unlocks := v_unlocks;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
