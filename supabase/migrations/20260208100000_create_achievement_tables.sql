-- ============================================================================
-- Achievement System Tables, RLS, Indexes, Seed Data & Evaluation Functions
-- ============================================================================

-- 1. Achievement definitions (catalog)
CREATE TABLE IF NOT EXISTS achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  hint text,
  category text NOT NULL CHECK (category IN ('volume', 'house', 'reliability', 'endurance', 'diversity', 'community', 'management', 'hidden')),
  evaluation_type text NOT NULL,
  metric_key text NOT NULL,
  threshold integer NOT NULL,
  threshold_param integer,
  department text,
  role_code text,
  is_hidden boolean DEFAULT false,
  is_active boolean DEFAULT true,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Achievement progress (cached metrics per user)
CREATE TABLE IF NOT EXISTS achievement_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  current_value integer DEFAULT 0,
  last_evaluated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, metric_key)
);

-- 3. Achievement unlocks
CREATE TABLE IF NOT EXISTS achievement_unlocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  seen boolean DEFAULT false,
  UNIQUE(user_id, achievement_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_achievement_progress_user ON achievement_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_user ON achievement_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_unseen ON achievement_unlocks(user_id) WHERE seen = false;
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_achievements_metric_key ON achievements(metric_key);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_unlocks ENABLE ROW LEVEL SECURITY;

-- Achievements catalog: readable by all authenticated users
CREATE POLICY "achievements_select_all" ON achievements
  FOR SELECT TO authenticated USING (true);

-- Progress: users see their own; admins/management see all
CREATE POLICY "achievement_progress_select" ON achievement_progress
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Unlocks: users see their own; admins/management see all
CREATE POLICY "achievement_unlocks_select" ON achievement_unlocks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Users can mark their own unlocks as seen
CREATE POLICY "achievement_unlocks_update_seen" ON achievement_unlocks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Seed v1 Achievements (30 achievements)
-- ============================================================================
INSERT INTO achievements (code, title, description, hint, category, evaluation_type, metric_key, threshold, threshold_param, is_hidden, icon, sort_order) VALUES
-- Volume (10)
('first_gig',       'Primer Bolo',      'Tu primer trabajo completado. Ya no eres nuevo.',               'Completa tu primer trabajo',    'volume',      'job_count',          'job_count',          1,   NULL, false, '🎤', 10),
('getting_started', 'Arrancando',        '5 trabajos. Esto ya no es casualidad.',                         'Sigue trabajando...',           'volume',      'job_count',          'job_count',          5,   NULL, false, '🚀', 20),
('double_digits',   'Doble Dígito',      '10 trabajos completados. Ya te conocen por nombre.',            'Llegarás a los 10',             'volume',      'job_count',          'job_count',          10,  NULL, false, '🔟', 30),
('regular',         'Habitual',          '20 trabajos. Tu cara ya es parte del inventario.',              NULL,                            'volume',      'job_count',          'job_count',          20,  NULL, false, '📋', 40),
('veteran',         'Veterano',          '30 trabajos. Los nuevos te preguntan cosas.',                   NULL,                            'volume',      'job_count',          'job_count',          30,  NULL, false, '⭐', 50),
('senior',          'Senior',            '50 trabajos. Ya nadie te explica dónde va el multi.',           NULL,                            'volume',      'job_count',          'job_count',          50,  NULL, false, '🏅', 60),
('trusted',         'De Confianza',      '80 trabajos. Te llaman sin mirar la agenda.',                   NULL,                            'volume',      'job_count',          'job_count',          80,  NULL, false, '🤝', 70),
('century_club',    'Club de los 100',   '100 trabajos completados. Eres una institución.',               NULL,                            'volume',      'job_count',          'job_count',          100, NULL, false, '💯', 80),
('machine',         'Máquina',           '150 trabajos. No paras. Ni quieres.',                           NULL,                            'volume',      'job_count',          'job_count',          150, NULL, false, '⚙️', 90),
('unstoppable',     'Imparable',         '200 trabajos. A este punto, el trabajo te encuentra a ti.',     NULL,                            'volume',      'job_count',          'job_count',          200, NULL, false, '🔥', 100),

-- House Tech (5)
('first_day_home',  'Primer Día en Casa',        'Tu primer trabajo como técnico de casa.',                       'Completa un trabajo como house tech', 'house', 'house_job_count', 'house_job_count', 1,   NULL, false, '🏠', 110),
('familiar_face',   'Cara Conocida',             '10 trabajos de casa. Ya sabes dónde están las llaves.',         NULL,                                  'house', 'house_job_count', 'house_job_count', 10,  NULL, false, '😊', 120),
('trusted_house',   'Técnico de Confianza',      '30 trabajos. Eres parte del mobiliario (con cariño).',          NULL,                                  'house', 'house_job_count', 'house_job_count', 30,  NULL, false, '🔑', 130),
('backbone',        'Columna Vertebral',         '50 trabajos de casa. Sin ti esto no funciona.',                 NULL,                                  'house', 'house_job_count', 'house_job_count', 50,  NULL, false, '🏛️', 140),
('house_veteran',   'Veterano de la Casa',       '120 trabajos. Llevas más tiempo que las paredes.',              NULL,                                  'house', 'house_job_count', 'house_job_count', 120, NULL, false, '👑', 150),

-- Reliability (5)
('first_month_active',   'Primer Mes Activo',    'Has trabajado al menos un día en un mes. El primer paso.',      'Trabaja en un mes calendario',       'reliability', 'consecutive_months', 'consecutive_months', 1, NULL, false, '📅', 160),
('three_months_streak',  'Trimestre Sólido',     '3 meses consecutivos activo. Consistencia.',                    NULL,                                 'reliability', 'consecutive_months', 'consecutive_months', 3, NULL, false, '📊', 170),
('six_months_streak',    'Semestre de Hierro',   '6 meses consecutivos. No aflojas.',                             NULL,                                 'reliability', 'consecutive_months', 'consecutive_months', 6, NULL, false, '💪', 180),
('no_cancel_10',         'Sin Cancelaciones',    '10 trabajos seguidos sin cancelar. Fiable.',                    'No canceles trabajos aceptados',     'reliability', 'no_cancel_streak',   'no_cancel_streak',   10, NULL, false, '✅', 190),
('rock_solid',           'Roca',                 '25 trabajos sin cancelar. Inquebrantable.',                     NULL,                                 'reliability', 'no_cancel_streak',   'no_cancel_streak',   25, NULL, false, '🪨', 200),

-- Endurance (5)
('long_day',        'Jornada Larga',     'Tu primer turno de +12 horas. Bienvenido al club.',             'Completa un turno largo',       'endurance', 'long_shift', 'long_shift_12h', 1,  12, false, '⏰', 210),
('still_standing',  'Aún de Pie',        '5 turnos de +12 horas. Las piernas ya no se quejan.',           NULL,                            'endurance', 'long_shift', 'long_shift_12h', 5,  12, false, '🦵', 220),
('endurance_tech',  'Resistencia',       '10 turnos de +12 horas. Estás hecho de otra pasta.',            NULL,                            'endurance', 'long_shift', 'long_shift_12h', 10, 12, false, '🏃', 230),
('epic_day',        'Día Épico',         'Tu primer turno de +16 horas. Eso ya es heroísmo.',             'Sobrevive a un turno maratón',  'endurance', 'long_shift', 'long_shift_16h', 1,  16, false, '🦸', 240),
('iron_man',        'Hombre de Hierro',  '5 turnos de +16 horas. Necesitas un monumento.',                NULL,                            'endurance', 'long_shift', 'long_shift_16h', 5,  16, false, '🗿', 250),

-- Diversity (5)
('venues_5',          'Explorador',                'Has trabajado en 5 venues diferentes.',                        'Trabaja en distintos sitios',   'diversity', 'venue_count',        'venue_count',        5,  NULL, false, '🗺️', 260),
('venues_15',         'Viajero',                   '15 venues diferentes. Conoces media ciudad.',                  NULL,                            'diversity', 'venue_count',        'venue_count',        15, NULL, false, '✈️', 270),
('festival_day',      'Día de Festival',           'Tu primer festival completado.',                               'Completa un trabajo de festival','diversity', 'festival_job_count', 'festival_job_count', 1,  NULL, false, '🎪', 280),
('festival_regular',  'Festivalero',               '10 días de festival. Ya tienes botas de barro propias.',       NULL,                            'diversity', 'festival_job_count', 'festival_job_count', 10, NULL, false, '🎶', 290),
('festival_veteran',  'Veterano de Festivales',    '25 días de festival. Tu tienda de campaña tiene wifi.',        NULL,                            'diversity', 'festival_job_count', 'festival_job_count', 25, NULL, false, '⛺', 300),

-- Community (1)
('bug_hunter',        'Cazador de Bugs',           'Has reportado 5 o más bugs para ayudar a mejorar la plataforma.', 'Reporta bugs desde la página de Soporte', 'community', 'threshold', 'bug_reports_submitted', 5, NULL, false, '🐛', 310),

-- Management Only - Job Operations (8)
('first_job_created',      'Primer Trabajo Creado',     'Has creado tu primer trabajo en el sistema.',                    'Crea un trabajo desde el calendario',     'management', 'threshold', 'jobs_created',        1,   NULL, false, '📝', 320),
('job_machine',            'Máquina de Bolos',          '10 trabajos creados. Ya dominas el sistema.',                    NULL,                                      'management', 'threshold', 'jobs_created',        10,  NULL, false, '⚙️', 330),
('booking_boss',           'Jefe de Booking',           '50 trabajos creados. Eres el motor de la productora.',           NULL,                                      'management', 'threshold', 'jobs_created',        50,  NULL, false, '👔', 340),
('production_powerhouse',  'Potencia de Producción',    '100 trabajos creados. La agenda gira alrededor tuyo.',           NULL,                                      'management', 'threshold', 'jobs_created',        100, NULL, false, '🏭', 350),
('unstoppable_booker',     'Booker Imparable',          '250 trabajos creados. Tienes el calendario en la sangre.',       NULL,                                      'management', 'threshold', 'jobs_created',        250, NULL, false, '🚀', 360),
('first_confirmation',     'Primera Confirmación',      'Has confirmado tu primer trabajo.',                              'Confirma un trabajo pendiente',           'management', 'threshold', 'jobs_confirmed',      1,   NULL, false, '✓', 370),
('confirmation_king',      'Rey de Confirmaciones',     '50 confirmaciones. La producción avanza gracias a ti.',          NULL,                                      'management', 'threshold', 'jobs_confirmed',      50,  NULL, false, '👑', 380),
('master_coordinator',     'Coordinador Maestro',       '100 confirmaciones. Nada se mueve sin tu aprobación.',           NULL,                                      'management', 'threshold', 'jobs_confirmed',      100, NULL, false, '🎯', 390),

-- Management Only - Documentation (6)
('first_document',         'Primer Documento',          'Has subido tu primer documento al sistema.',                     'Sube un documento a un trabajo',          'management', 'threshold', 'documents_uploaded',  1,   NULL, false, '📄', 400),
('paperwork_pro',          'Pro del Papeleo',           '25 documentos subidos. Organizas la información como nadie.',    NULL,                                      'management', 'threshold', 'documents_uploaded',  25,  NULL, false, '📋', 410),
('document_master',        'Maestro de Archivos',       '100 documentos. Eres la biblioteca de la productora.',           NULL,                                      'management', 'threshold', 'documents_uploaded',  100, NULL, false, '📚', 420),
('first_pdf_export',       'Primer PDF Generado',       'Has exportado tu primer PDF del sistema.',                       'Genera un PDF de riders o itinerarios',   'management', 'threshold', 'pdfs_generated',      1,   NULL, false, '📑', 430),
('pdf_wizard',             'Mago de PDFs',              '50 PDFs generados. Los informes salen de tu varita mágica.',     NULL,                                      'management', 'threshold', 'pdfs_generated',      50,  NULL, false, '🪄', 440),
('archive_architect',      'Arquitecto del Archivo',    '200 PDFs generados. Documentas la historia de cada evento.',     NULL,                                      'management', 'threshold', 'pdfs_generated',      200, NULL, false, '🏗️', 450),

-- Management Only - Crew Management (8)
('first_assignment',       'Primera Asignación',        'Has asignado a tu primer técnico.',                              'Asigna un técnico a un trabajo',          'management', 'threshold', 'assignments_created', 1,   NULL, false, '👤', 460),
('crew_builder',           'Constructor de Crew',       '25 asignaciones. Ya montas equipos con soltura.',                NULL,                                      'management', 'threshold', 'assignments_created', 25,  NULL, false, '👥', 470),
('staffing_expert',        'Experto en Staffing',       '100 asignaciones. Conoces a cada técnico y su especialidad.',    NULL,                                      'management', 'threshold', 'assignments_created', 100, NULL, false, '🎓', 480),
('workforce_commander',    'Comandante de Personal',    '500 asignaciones. Orquestas equipos como un director.',          NULL,                                      'management', 'threshold', 'assignments_created', 500, NULL, false, '🎼', 490),
('first_timesheet_ok',     'Primer Timesheet Aprobado', 'Has aprobado tu primer timesheet.',                              'Aprueba un timesheet pendiente',          'management', 'threshold', 'timesheets_approved', 1,   NULL, false, '⏰', 500),
('payroll_manager',        'Gestor de Nóminas',         '50 timesheets aprobados. El equipo cobra gracias a ti.',         NULL,                                      'management', 'threshold', 'timesheets_approved', 50,  NULL, false, '💰', 510),
('timesheet_guardian',     'Guardián de Timesheets',    '200 timesheets aprobados. Nadie escapa a tu revisión.',          NULL,                                      'management', 'threshold', 'timesheets_approved', 200, NULL, false, '🛡️', 520),
('staffing_request_pro',   'Pro de Solicitudes',        'Has gestionado 25 solicitudes de staffing.',                     'Gestiona solicitudes de personal',        'management', 'threshold', 'staffing_handled',    25,  NULL, false, '📞', 530),

-- Management Only - Communication (4)
('first_announcement',     'Primer Anuncio',            'Has publicado tu primer anuncio para el equipo.',                'Publica un anuncio desde la app',         'management', 'threshold', 'announcements_sent',  1,   NULL, false, '📢', 540),
('town_crier',             'Pregonero',                 '10 anuncios publicados. Mantienes informado al equipo.',         NULL,                                      'management', 'threshold', 'announcements_sent',  10,  NULL, false, '🔔', 550),
('first_task',             'Primera Tarea Creada',      'Has creado tu primera tarea en el sistema.',                     'Crea una tarea para el equipo',           'management', 'threshold', 'tasks_created',       1,   NULL, false, '✔️', 560),
('task_master',            'Maestro de Tareas',         '50 tareas creadas. Organizas el trabajo del equipo.',            NULL,                                      'management', 'threshold', 'tasks_created',       50,  NULL, false, '📝', 570),

-- Management Only - Operations (4)
('equipment_guru',         'Gurú del Equipamiento',     'Has gestionado 25 elementos de equipamiento.',                   'Gestiona el inventario de equipos',       'management', 'threshold', 'equipment_managed',   25,  NULL, false, '🎚️', 580),
('subrental_specialist',   'Especialista en Subrental', '10 subrentals gestionados. Sabes cuándo pedir refuerzos.',       NULL,                                      'management', 'threshold', 'subrentals_managed',  10,  NULL, false, '📦', 590),
('preset_creator',         'Creador de Presets',        '5 presets de equipamiento creados. Eficientas el sistema.',      'Crea presets de equipos reutilizables',   'management', 'threshold', 'presets_created',     5,   NULL, false, '⚡', 600),
('operations_mastermind',  'Cerebro de Operaciones',    '1000 acciones totales de gestión. Eres el corazón del sistema.', NULL,                                      'management', 'threshold', 'total_mgmt_actions',  1000,NULL, false, '🧠', 610);

-- ============================================================================
-- Evaluation Function: evaluate one user's achievements
-- ============================================================================
CREATE OR REPLACE FUNCTION evaluate_user_achievements(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Count consecutive confirmed assignments on completed jobs (most recent first).
  -- The streak breaks at the first declined assignment.
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
    -- Count jobs where status is 'confirmado' (created by this user)
    SELECT COUNT(*) INTO v_metric_value
    FROM jobs
    WHERE created_by = p_user_id AND status = 'confirmado';

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'jobs_confirmed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: assignments_created ----
    SELECT COUNT(*) INTO v_metric_value
    FROM job_assignments
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'assignments_created', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: timesheets_approved ----
    -- Count approved timesheets (if approved_by column exists, otherwise count by created_by)
    SELECT COUNT(*) INTO v_metric_value
    FROM timesheets
    WHERE created_by = p_user_id AND status = 'aprobado';

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'timesheets_approved', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: staffing_handled ----
    SELECT COUNT(*) INTO v_metric_value
    FROM staffing_requests
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'staffing_handled', v_metric_value, now())
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

    -- ---- Metric: tasks_created ----
    SELECT COUNT(*) INTO v_metric_value
    FROM global_tasks
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'tasks_created', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: equipment_managed ----
    SELECT COUNT(*) INTO v_metric_value
    FROM stock_movements
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'equipment_managed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: subrentals_managed ----
    SELECT COUNT(*) INTO v_metric_value
    FROM subrental_requests
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'subrentals_managed', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: presets_created ----
    SELECT COUNT(*) INTO v_metric_value
    FROM equipment_presets
    WHERE created_by = p_user_id;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'presets_created', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: documents_uploaded ----
    -- Placeholder: might need adjustment based on actual document storage
    SELECT 0 INTO v_metric_value;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'documents_uploaded', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: pdfs_generated ----
    -- Placeholder: might need adjustment based on actual PDF tracking
    SELECT 0 INTO v_metric_value;

    INSERT INTO achievement_progress (user_id, metric_key, current_value, last_evaluated_at)
    VALUES (p_user_id, 'pdfs_generated', v_metric_value, now())
    ON CONFLICT (user_id, metric_key)
    DO UPDATE SET current_value = EXCLUDED.current_value, last_evaluated_at = now();

    -- ---- Metric: total_mgmt_actions ----
    -- Sum of all management actions
    SELECT COALESCE(
      (SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'jobs_created'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'jobs_confirmed'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'assignments_created'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'staffing_handled'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'announcements_sent'), 0) +
      COALESCE((SELECT current_value FROM achievement_progress WHERE user_id = p_user_id AND metric_key = 'tasks_created'), 0)
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

-- ============================================================================
-- Batch Evaluation: find technicians with recently completed jobs and evaluate
-- ============================================================================
CREATE OR REPLACE FUNCTION evaluate_daily_achievements()
RETURNS TABLE(user_id uuid, new_unlocks integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tech record;
  v_unlocks integer;
BEGIN
  -- Find all technicians who had job assignments on completed jobs yesterday
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
