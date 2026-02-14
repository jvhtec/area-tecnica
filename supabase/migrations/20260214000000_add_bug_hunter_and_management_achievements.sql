-- ============================================================================
-- Add Bug Hunter (community) and Management achievements
-- Extends the achievement system with new categories and metrics
-- ============================================================================

-- 1. Extend the category CHECK constraint to include 'community' and 'management'
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('volume', 'house', 'reliability', 'endurance', 'diversity', 'community', 'management', 'hidden'));

-- 2. Insert all achievements
-- Achievements with working database metrics are auto-evaluated.
-- Achievements whose metrics reference tables/columns that don't yet exist
-- are manual-award-only until the underlying tracking is built.
INSERT INTO achievements (code, title, description, hint, category, evaluation_type, metric_key, threshold, threshold_param, is_hidden, icon, sort_order) VALUES

-- Community (1)
('bug_hunter',        'Cazador de Bugs',           'Has reportado 5 o mas bugs para ayudar a mejorar la plataforma.', 'Reporta bugs desde la pagina de Soporte', 'community', 'threshold', 'bug_reports_submitted', 5, NULL, false, '🐛', 310),

-- Management Only - Job Operations (8) [AUTO-EVALUATED]
('first_job_created',      'Primer Trabajo Creado',     'Has creado tu primer trabajo en el sistema.',                    'Crea un trabajo desde el calendario',     'management', 'threshold', 'jobs_created',        1,   NULL, false, '📝', 320),
('job_machine',            'Maquina de Bolos',          '10 trabajos creados. Ya dominas el sistema.',                    NULL,                                      'management', 'threshold', 'jobs_created',        10,  NULL, false, '⚙️', 330),
('booking_boss',           'Jefe de Booking',           '50 trabajos creados. Eres el motor de la productora.',           NULL,                                      'management', 'threshold', 'jobs_created',        50,  NULL, false, '👔', 340),
('production_powerhouse',  'Potencia de Produccion',    '100 trabajos creados. La agenda gira alrededor tuyo.',           NULL,                                      'management', 'threshold', 'jobs_created',        100, NULL, false, '🏭', 350),
('unstoppable_booker',     'Booker Imparable',          '250 trabajos creados. Tienes el calendario en la sangre.',       NULL,                                      'management', 'threshold', 'jobs_created',        250, NULL, false, '🚀', 360),
('first_confirmation',     'Primera Confirmacion',      'Has confirmado tu primer trabajo.',                              'Confirma un trabajo pendiente',           'management', 'threshold', 'jobs_confirmed',      1,   NULL, false, '✓', 370),
('confirmation_king',      'Rey de Confirmaciones',     '50 confirmaciones. La produccion avanza gracias a ti.',          NULL,                                      'management', 'threshold', 'jobs_confirmed',      50,  NULL, false, '👑', 380),
('master_coordinator',     'Coordinador Maestro',       '100 confirmaciones. Nada se mueve sin tu aprobacion.',           NULL,                                      'management', 'threshold', 'jobs_confirmed',      100, NULL, false, '🎯', 390),

-- Management Only - Documentation (6) [MANUAL-ONLY: no tracking tables yet]
('first_document',         'Primer Documento',          'Has subido tu primer documento al sistema.',                     'Sube un documento a un trabajo',          'management', 'threshold', 'documents_uploaded',  1,   NULL, false, '📄', 400),
('paperwork_pro',          'Pro del Papeleo',           '25 documentos subidos. Organizas la informacion como nadie.',    NULL,                                      'management', 'threshold', 'documents_uploaded',  25,  NULL, false, '📋', 410),
('document_master',        'Maestro de Archivos',       '100 documentos. Eres la biblioteca de la productora.',           NULL,                                      'management', 'threshold', 'documents_uploaded',  100, NULL, false, '📚', 420),
('first_pdf_export',       'Primer PDF Generado',       'Has exportado tu primer PDF del sistema.',                       'Genera un PDF de riders o itinerarios',   'management', 'threshold', 'pdfs_generated',      1,   NULL, false, '📑', 430),
('pdf_wizard',             'Mago de PDFs',              '50 PDFs generados. Los informes salen de tu varita magica.',     NULL,                                      'management', 'threshold', 'pdfs_generated',      50,  NULL, false, '🪄', 440),
('archive_architect',      'Arquitecto del Archivo',    '200 PDFs generados. Documentas la historia de cada evento.',     NULL,                                      'management', 'threshold', 'pdfs_generated',      200, NULL, false, '🏗️', 450),

-- Management Only - Crew Management (8) [AUTO-EVALUATED: assignments_created, timesheets_approved]
('first_assignment',       'Primera Asignacion',        'Has asignado a tu primer tecnico.',                              'Asigna un tecnico a un trabajo',          'management', 'threshold', 'assignments_created', 1,   NULL, false, '👤', 460),
('crew_builder',           'Constructor de Crew',       '25 asignaciones. Ya montas equipos con soltura.',                NULL,                                      'management', 'threshold', 'assignments_created', 25,  NULL, false, '👥', 470),
('staffing_expert',        'Experto en Staffing',       '100 asignaciones. Conoces a cada tecnico y su especialidad.',    NULL,                                      'management', 'threshold', 'assignments_created', 100, NULL, false, '🎓', 480),
('workforce_commander',    'Comandante de Personal',    '500 asignaciones. Orquestas equipos como un director.',          NULL,                                      'management', 'threshold', 'assignments_created', 500, NULL, false, '🎼', 490),
('first_timesheet_ok',     'Primer Timesheet Aprobado', 'Has aprobado tu primer timesheet.',                              'Aprueba un timesheet pendiente',          'management', 'threshold', 'timesheets_approved', 1,   NULL, false, '⏰', 500),
('payroll_manager',        'Gestor de Nominas',         '50 timesheets aprobados. El equipo cobra gracias a ti.',         NULL,                                      'management', 'threshold', 'timesheets_approved', 50,  NULL, false, '💰', 510),
('timesheet_guardian',     'Guardian de Timesheets',    '200 timesheets aprobados. Nadie escapa a tu revision.',           NULL,                                      'management', 'threshold', 'timesheets_approved', 200, NULL, false, '🛡️', 520),
-- [MANUAL-ONLY: staffing_requests has no created_by column]
('staffing_request_pro',   'Pro de Solicitudes',        'Has gestionado 25 solicitudes de staffing.',                     'Gestiona solicitudes de personal',        'management', 'threshold', 'staffing_handled',    25,  NULL, false, '📞', 530),

-- Management Only - Communication (4) [AUTO: announcements_sent; MANUAL: tasks_created]
('first_announcement',     'Primer Anuncio',            'Has publicado tu primer anuncio para el equipo.',                'Publica un anuncio desde la app',         'management', 'threshold', 'announcements_sent',  1,   NULL, false, '📢', 540),
('town_crier',             'Pregonero',                 '10 anuncios publicados. Mantienes informado al equipo.',         NULL,                                      'management', 'threshold', 'announcements_sent',  10,  NULL, false, '🔔', 550),
('first_task',             'Primera Tarea Creada',      'Has creado tu primera tarea en el sistema.',                     'Crea una tarea para el equipo',           'management', 'threshold', 'tasks_created',       1,   NULL, false, '✔️', 560),
('task_master',            'Maestro de Tareas',         '50 tareas creadas. Organizas el trabajo del equipo.',            NULL,                                      'management', 'threshold', 'tasks_created',       50,  NULL, false, '📝', 570),

-- Management Only - Operations (4) [AUTO: equipment_managed, subrentals_managed; MANUAL: presets_created]
('equipment_guru',         'Guru del Equipamiento',     'Has gestionado 25 elementos de equipamiento.',                   'Gestiona el inventario de equipos',       'management', 'threshold', 'equipment_managed',   25,  NULL, false, '🎚️', 580),
('subrental_specialist',   'Especialista en Subrental', '10 subrentals gestionados. Sabes cuando pedir refuerzos.',       NULL,                                      'management', 'threshold', 'subrentals_managed',  10,  NULL, false, '📦', 590),
('preset_creator',         'Creador de Presets',        '5 presets de equipamiento creados. Eficientas el sistema.',      'Crea presets de equipos reutilizables',   'management', 'threshold', 'presets_created',     5,   NULL, false, '⚡', 600),
('operations_mastermind',  'Cerebro de Operaciones',    '1000 acciones totales de gestion. Eres el corazon del sistema.', NULL,                                      'management', 'threshold', 'total_mgmt_actions',  1000,NULL, false, '🧠', 610),

-- Management Only - Production Documents (5) [MANUAL-ONLY: no tracking tables yet]
('first_hoja_ruta',        'Primera Hoja de Ruta',      'Has creado tu primera hoja de ruta para una gira.',              'Genera una hoja de ruta desde Tours',    'management', 'threshold', 'hojas_ruta_created',  1,   NULL, false, '🗺️', 620),
('route_master',           'Maestro de Rutas',          '10 hojas de ruta. Planificas giras como un pro.',               NULL,                                      'management', 'threshold', 'hojas_ruta_created',  10,  NULL, false, '🧭', 630),
('first_rider',            'Primer Rider',              'Has creado tu primer rider tecnico de artista.',                 'Crea un rider desde Festivales',         'management', 'threshold', 'riders_created',      1,   NULL, false, '🎸', 640),
('rider_specialist',       'Especialista en Riders',    '25 riders creados. Conoces cada detalle tecnico.',               NULL,                                      'management', 'threshold', 'riders_created',      25,  NULL, false, '🎛️', 650),
('incident_handler',       'Gestor de Incidencias',     '5 informes de incidencias documentados.',                        'Documenta incidencias desde la app',     'management', 'threshold', 'incidents_reported',  5,   NULL, false, '⚠️', 660),

-- Management Only - Technical Specs (5) [MANUAL-ONLY: no tracking tables yet]
('first_consumo',          'Primer Consumo',            'Has calculado tu primer consumo de potencia.',                   'Calcula consumos de luces o sonido',     'management', 'threshold', 'consumos_created',    1,   NULL, false, '⚡', 670),
('power_calculator',       'Calculador de Potencia',    '10 consumos calculados. Dominas los amperios.',                  NULL,                                      'management', 'threshold', 'consumos_created',    10,  NULL, false, '🔌', 680),
('first_peso',             'Primer Calculo de Peso',    'Has calculado pesos para logistica por primera vez.',            'Calcula pesos para transporte',          'management', 'threshold', 'pesos_calculated',    1,   NULL, false, '⚖️', 690),
('logistics_engineer',     'Ingeniero Logistico',       '15 calculos de peso. Optimizas cada camion.',                    NULL,                                      'management', 'threshold', 'pesos_calculated',    15,  NULL, false, '🚛', 700),
('stage_plotter',          'Disenador de Escenario',    'Has creado 5 stage plots para montajes.',                        'Disena stage plots desde la app',        'management', 'threshold', 'stage_plots_created', 5,   NULL, false, '🎭', 710),

-- Management Only - Warehouse & Logistics (3) [MANUAL-ONLY: no tracking tables yet]
('warehouse_warrior',      'Guerrero del Almacen',      '20 operaciones de load-in/load-out gestionadas.',                'Gestiona entradas/salidas de almacen',   'management', 'threshold', 'warehouse_ops',       20,  NULL, false, '📦', 720),
('transport_coordinator',  'Coordinador de Transporte', 'Has coordinado transporte para 10 eventos.',                     NULL,                                      'management', 'threshold', 'transport_coordinated',10, NULL, false, '🚚', 730),
('flex_integrator',        'Integrador Flex',           'Has sincronizado 15 elementos con Flex Rental.',                 'Integra trabajos con Flex',              'management', 'threshold', 'flex_syncs',          15,  NULL, false, '🔗', 740),

-- Management Only - Festival & Tour Operations (5) [MANUAL-ONLY: tours lacks tour_type column]
('festival_scheduler',     'Programador de Festivales', 'Has programado tu primer festival multi-dia.',                   'Programa un festival en la app',         'management', 'threshold', 'festivals_scheduled', 1,   NULL, false, '🎪', 750),
('festival_maestro',       'Maestro de Festivales',     '5 festivales programados. Organizas eventos epicos.',            NULL,                                      'management', 'threshold', 'festivals_scheduled', 5,   NULL, false, '🎉', 760),
('artist_coordinator',     'Coordinador de Artistas',   'Has gestionado 30 artistas en festivales.',                      'Gestiona artistas y requisitos',         'management', 'threshold', 'artists_managed',     30,  NULL, false, '🎤', 770),
('tour_architect',         'Arquitecto de Giras',       'Has creado 10 giras completas con fechas e itinerarios.',        NULL,                                      'management', 'threshold', 'tours_created',       10,  NULL, false, '🗓️', 780),
('presupuesto_pro',        'Pro de Presupuestos',       '20 presupuestos/quotes generados. Cierras deals.',               'Genera presupuestos para clientes',      'management', 'threshold', 'quotes_generated',    20,  NULL, false, '💼', 790),

-- Management Only - Communication & Messaging (4) [MANUAL-ONLY: messages lacks is_group_message]
('first_group_message',    'Primer Mensaje Grupal',     'Has enviado tu primer mensaje a un grupo de trabajo.',           'Envia mensajes grupales al equipo',      'management', 'threshold', 'group_messages_sent', 1,   NULL, false, '💬', 800),
('team_communicator',      'Comunicador del Equipo',    '50 mensajes grupales enviados. Mantienes al equipo conectado.',  NULL,                                      'management', 'threshold', 'group_messages_sent', 50,  NULL, false, '📱', 810),
('whatsapp_master',        'Maestro de WhatsApp',       'Has gestionado 10 grupos de WhatsApp para proyectos.',           'Gestiona grupos de comunicacion',        'management', 'threshold', 'whatsapp_groups',     10,  NULL, false, '📲', 820),
('broadcast_champion',     'Campeon de Difusion',       '100 comunicaciones enviadas. Tu voz llega a todos.',             NULL,                                      'management', 'threshold', 'broadcasts_sent',     100, NULL, false, '📻', 830),

-- Management Only - Client Relations (4) [MANUAL-ONLY: no client tracking tables]
('first_client_meeting',   'Primera Reunion Cliente',   'Has registrado tu primera reunion con cliente.',                 'Registra reuniones de clientes',         'management', 'threshold', 'client_meetings',     1,   NULL, false, '🤝', 840),
('relationship_builder',   'Constructor de Relaciones', '20 reuniones de cliente. Construyes relaciones solidas.',        NULL,                                      'management', 'threshold', 'client_meetings',     20,  NULL, false, '🏗️', 850),
('feedback_collector',     'Recolector de Feedback',    'Has recopilado feedback de 15 clientes.',                        'Solicita feedback post-evento',          'management', 'threshold', 'client_feedback',     15,  NULL, false, '📝', 860),
('client_champion',        'Campeon del Cliente',       '50 interacciones de cliente. La satisfaccion es tu prioridad.',  NULL,                                      'management', 'threshold', 'client_interactions', 50,  NULL, false, '⭐', 870),

-- Management Only - Financial Operations (3) [AUTO: rates_negotiated; MANUAL: expenses, budgets]
('expense_tracker',        'Rastreador de Gastos',      'Has registrado 30 gastos de produccion.',                        'Registra gastos de eventos',             'management', 'threshold', 'expenses_tracked',    30,  NULL, false, '💵', 880),
('budget_guardian',        'Guardian del Presupuesto',  'Has revisado presupuestos para 15 proyectos.',                   'Revisa y ajusta presupuestos',           'management', 'threshold', 'budgets_reviewed',    15,  NULL, false, '💰', 890),
('rate_negotiator',        'Negociador de Tarifas',     'Has negociado tarifas para 25 tecnicos.',                        'Gestiona tarifas personalizadas',        'management', 'threshold', 'rates_negotiated',    25,  NULL, false, '💼', 900),

-- Management Only - Venue & Location Management (3) [MANUAL-ONLY: no created_by on locations]
('venue_mapper',           'Mapeador de Venues',        'Has anadido 10 nuevos venues al sistema.',                       'Anade venues nuevos',                    'management', 'threshold', 'venues_added',        10,  NULL, false, '📍', 910),
('location_expert',        'Experto en Localizaciones', 'Has actualizado informacion de 25 venues.',                      'Manten datos de venues actualizados',    'management', 'threshold', 'venues_updated',      25,  NULL, false, '🗺️', 920),
('venue_scout',            'Scout de Venues',           '5 scouting reports de localizaciones completados.',              'Realiza scouting de nuevos espacios',    'management', 'threshold', 'venue_scouts',        5,   NULL, false, '🔍', 930),

-- Management Only - Safety & Quality (3) [MANUAL-ONLY: no safety tracking tables]
('safety_first',           'Seguridad Primero',         'Has completado 10 checklists de seguridad.',                     'Completa checklists de seguridad',       'management', 'threshold', 'safety_checks',       10,  NULL, false, '🦺', 940),
('quality_auditor',        'Auditor de Calidad',        '15 auditorias de calidad realizadas.',                           'Audita calidad de eventos',              'management', 'threshold', 'quality_audits',      15,  NULL, false, '✅', 950),
('incident_investigator',  'Investigador de Incidentes','Has investigado y documentado 10 incidentes.',                    'Investiga y previene incidentes',        'management', 'threshold', 'incidents_investigated', 10, NULL, false, '🔎', 960),

-- Management Only - System Administration (3) [MANUAL-ONLY: no user mgmt tracking]
('user_manager',           'Gestor de Usuarios',        'Has gestionado accesos de 20 usuarios.',                         'Gestiona usuarios del sistema',          'management', 'threshold', 'users_managed',       20,  NULL, false, '👤', 970),
('permissions_master',     'Maestro de Permisos',       'Has configurado permisos para 10 departamentos o roles.',        'Configura permisos y roles',             'management', 'threshold', 'permissions_set',     10,  NULL, false, '🔐', 980),
('system_architect',       'Arquitecto del Sistema',    '50 configuraciones del sistema realizadas. Moldeas la plataforma.', 'Personaliza configuracion del sistema', 'management', 'threshold', 'system_configs',      50,  NULL, false, '⚙️', 990)

ON CONFLICT (code) DO NOTHING;

-- 3. Update the evaluation function to include bug_reports_submitted and management metrics.
-- Only metrics backed by verified database columns are auto-evaluated.
-- Achievements without matching metrics here can only be awarded manually.
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
  -- Only metrics backed by verified database columns are auto-evaluated.
  -- Achievements referencing missing tables/columns are manual-award-only.
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

    -- NOTE: The following management metrics are NOT auto-evaluated because
    -- their underlying tables/columns don't exist yet:
    --   documents_uploaded, pdfs_generated, staffing_handled, tasks_created,
    --   presets_created, hojas_ruta_created, riders_created, incidents_reported,
    --   consumos_created, pesos_calculated, stage_plots_created, warehouse_ops,
    --   transport_coordinated, flex_syncs, festivals_scheduled, artists_managed,
    --   tours_created, quotes_generated, group_messages_sent, whatsapp_groups,
    --   broadcasts_sent, client_meetings, client_feedback, client_interactions,
    --   expenses_tracked, budgets_reviewed, venues_added, venues_updated,
    --   venue_scouts, safety_checks, quality_audits, incidents_investigated,
    --   users_managed, permissions_set, system_configs
    -- These achievements can be awarded manually via manually_award_achievement().
    -- Add metric evaluation here as tracking tables are created.

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
