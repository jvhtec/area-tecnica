-- ============================================================================
-- CAMPOS EXTENDIDOS PARA HOJA DE RUTA (DAY SHEET) COMPLETA
-- ============================================================================
-- Esta migración añade campos completos para generar hojas de ruta profesionales
-- según los estándares de la industria de tours musicales y eventos.
--
-- Incluye:
-- 1. Información de encabezado (tour, clima, zona horaria)
-- 2. Tiempos del show (soundcheck, puertas, curfew, etc.)
-- 3. Hospitalidad (catering, dietas, amenidades)
-- 4. Detalles de producción (rigging, audio, backline)
-- 5. Merchandising (tarifas, ubicación, settlement)
-- 6. Políticas de acceso (pases, fotos, restricciones)
-- 7. Información de seguridad (salidas, médicos, permisos)
-- 8. Liquidación (garantías, bonos, facturación)
-- 9. Notas especiales (invitados, prensa, peculiaridades del venue)
-- ============================================================================

-- ============================================================================
-- EXTENDER TABLA hoja_de_ruta
-- ============================================================================

-- Información del encabezado
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS encabezado_info JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.encabezado_info IS
'Información del encabezado de la hoja de ruta.
Estructura:
{
  "nombre_tour": "string",           // Nombre del tour
  "artista": "string",                // Nombre del artista
  "leg": "string",                    // Leg del tour (ej: "European Leg")
  "numero_show": "number",            // Número de show en el tour
  "nota_dst": "string",               // Nota sobre horario de verano
  "enlace_mapa": "string",            // URL al mapa del venue
  "hora_amanecer": "string",          // HH:mm
  "hora_atardecer": "string",         // HH:mm
  "moneda_local": "string",           // Código de moneda (EUR, USD, GBP)
  "tipo_venue": "string",             // festival, teatro, arena, club, exterior
  "capacidad": "number"               // Capacidad del venue
}';

-- Tiempos del show y logística
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS tiempos_show JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.tiempos_show IS
'Tiempos críticos del día del show.
Estructura:
{
  "soundcheck": "string",                    // HH:mm
  "puertas": "string",                       // HH:mm (doors open)
  "soporte_inicio": "string",                // HH:mm (support act on)
  "cambio_escenario": "string",              // HH:mm (set change)
  "headliner_inicio": "string",              // HH:mm (headliner on)
  "curfew": "string",                        // HH:mm
  "duracion_show_minutos": "number",         // Duración objetivo del show
  "nota_curfew_estricto": "string",          // Notas sobre curfew
  "bus_call": "string",                      // HH:mm - hora de salida del bus
  "carga_completa_objetivo": "string",       // HH:mm - objetivo load out
  "plan_viaje_posterior": "string"           // Descripción del viaje después del show
}';

-- Hospitalidad y catering
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS hospitalidad JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.hospitalidad IS
'Detalles de hospitalidad, catering y amenidades.
Estructura:
{
  "catering": {
    "desayuno_personas": "number",
    "almuerzo_personas": "number",
    "cena_personas": "number",
    "desayuno_hora": "string",          // HH:mm
    "almuerzo_hora": "string",          // HH:mm
    "cena_hora": "string",              // HH:mm
    "buyout_cantidad": "number",        // Cantidad en EUR si es buyout
    "buyout_notas": "string"
  },
  "dieta": {
    "alergias": ["string"],             // Lista de alergias
    "requisitos_dieteticos": ["string"], // Vegetariano, vegano, sin gluten, etc.
    "especificacion_cafe": "string",    // Requerimientos de café
    "especificacion_agua": "string"     // Requerimientos de agua
  },
  "amenidades": {
    "duchas": "boolean",
    "toallas": "boolean",
    "lavanderia": "boolean",
    "camerinos": "number",              // Número de camerinos
    "wifi_ssid": "string",
    "wifi_password": "string"
  }
}';

-- Detalles de producción técnica
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS detalles_produccion JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.detalles_produccion IS
'Especificaciones técnicas de producción.
Estructura:
{
  "escenario": {
    "ancho_m": "number",
    "profundidad_m": "number",
    "altura_m": "number",
    "ala_izquierda_m": "number",        // Wing space
    "ala_derecha_m": "number",
    "altura_muelle_carga_m": "number",  // Dock height
    "ascensor_carga": "boolean",
    "capacidad_ascensor_kg": "number"
  },
  "rigging": {
    "altura_grid_m": "number",
    "puntos_rigging": "number",
    "carga_maxima_kg": "number",
    "hora_steel_listo": "string"        // HH:mm cuando el steel está listo
  },
  "energia": {
    "shore_power_buses": "boolean",
    "ubicacion_shore_power": "string",
    "servicios_energia": "string",      // Descripción de servicios eléctricos
    "tie_ins": "string"                 // Puntos de conexión eléctrica
  },
  "audio": {
    "foh_distancia_m": "number",        // FOH throw
    "posicion_mezcla": "string",
    "limite_spl_db": "number",
    "ordenanza_ruido": "string",
    "notas_patch": "string",
    "enlaces_rf": "string"
  },
  "backline": {
    "notas_backline": "string",
    "alquileres_locales": "string"
  }
}';

-- Información de merchandising
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS merchandising JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.merchandising IS
'Detalles de merchandising y ventas.
Estructura:
{
  "porcentaje_venta": "number",         // % de comisión del venue
  "porcentaje_impuesto": "number",      // % de impuestos
  "porcentaje_tarjeta": "number",       // % fee de tarjeta de crédito
  "nombre_vendedor": "string",
  "ubicacion_mesa": "string",
  "hora_recuento": "string",            // HH:mm - cuando se hace el recuento
  "lugar_settlement": "string"          // Dónde se hace la liquidación
}';

-- Políticas de acceso y credenciales
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS politica_acceso JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.politica_acceso IS
'Políticas de acceso, credenciales y restricciones.
Estructura:
{
  "politica_pases": "string",           // Descripción de política de pases
  "pulseras": "string",                 // Tipos de pulseras/wristbands
  "reglas_fotos": "string",             // Política de fotografía
  "restricciones_edad": "string"        // Restricciones de edad
}';

-- Seguridad y emergencias
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS seguridad JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.seguridad IS
'Información de seguridad y emergencias.
Estructura:
{
  "salidas_emergencia": "string",       // Ubicación de salidas
  "medicos_en_sitio": "boolean",
  "ubicacion_medicos": "string",
  "permisos_pirotecnia": "string",
  "permisos_humo": "string",
  "postura_seguridad": "string",        // Nivel de seguridad
  "tipo_barricada": "string",
  "reglas_acceso_foso": "string"        // Pit access rules
}';

-- Información de liquidación financiera
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS liquidacion JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.liquidacion IS
'Detalles de liquidación financiera.
Estructura:
{
  "garantia_eur": "number",             // Garantía del show
  "triggers_bonus": "string",           // Cuándo se activan bonos
  "hora_settlement": "string",          // HH:mm
  "lugar_settlement": "string",         // Ubicación de la liquidación
  "oficina_settlement": "string",
  "quien_asiste": ["string"],           // Quién debe asistir
  "facturar_a": "string",               // A quién facturar
  "nota_retencion_fiscal": "string"     // Notas sobre retenciones fiscales
}';

-- Notas especiales
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS notas_especiales JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hoja_de_ruta.notas_especiales IS
'Notas especiales y recordatorios.
Estructura:
{
  "invitados_especiales": "string",     // Lista de invitados VIP
  "prensa": "string",                   // Actividades de prensa
  "peculiaridades_venue": "string",     // Quirks del venue
  "no_repetir": "string"                // Cosas que no hacer de nuevo
}';

-- ============================================================================
-- EXTENDER TABLA hotel_info EN hoja_de_ruta
-- ============================================================================

-- Nota: hotel_info ya existe como JSONB, vamos a documentar los campos extendidos
COMMENT ON COLUMN public.hoja_de_ruta.hotel_info IS
'Información completa del hotel.
Estructura extendida:
{
  "name": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "website": "string",
  "check_in_time": "string",
  "check_out_time": "string",
  "rooms_booked": "number",
  "confirmation_number": "string",
  "parking_available": "boolean",
  "wifi_available": "boolean",
  "breakfast_included": "boolean",

  // CAMPOS NUEVOS:
  "telefono_recepcion": "string",       // Teléfono de recepción
  "nombre_grupo": "string",             // Nombre del grupo para reserva
  "url_rooming_list": "string",         // URL a la lista de habitaciones
  "late_checkout_aprobado": "boolean",  // Si se aprobó late checkout
  "distancia_venue_km": "number",       // Distancia al venue en km
  "tiempo_conduccion_min": "number",    // Tiempo de conducción en minutos
  "notas_parking": "string"             // Notas sobre estacionamiento
}';

-- ============================================================================
-- EXTENDER TABLA local_contacts EN hoja_de_ruta
-- ============================================================================

-- Nota: local_contacts ya existe como JSONB array, documentamos roles estandarizados
COMMENT ON COLUMN public.hoja_de_ruta.local_contacts IS
'Contactos locales del día del show.
Array de objetos con estructura:
{
  "id": "string",
  "name": "string",
  "role": "string",                     // Ver roles estandarizados abajo
  "phone": "string",
  "mobile": "string",
  "email": "string",
  "whatsapp_preferido": "boolean",
  "sms_preferido": "boolean",
  "company": "string",
  "available_hours": "string",
  "is_emergency_contact": "boolean"
}

Roles estandarizados:
- "promoter_rep": Representante del promotor
- "venue_ops": Operaciones del venue
- "production_manager": Director de producción
- "tour_manager": Tour manager
- "box_office": Taquilla
- "security_chief": Jefe de seguridad
- "runner_dispatch": Coordinador de runners
- "emergency": Contacto de emergencia
- "other": Otro
';

-- ============================================================================
-- EXTENDER program_schedule_json EN hoja_de_ruta
-- ============================================================================

-- Nota: program_schedule_json ya existe, documentamos estructura completa
COMMENT ON COLUMN public.hoja_de_ruta.program_schedule_json IS
'Programa completo del día (schedule).
Array de ProgramDay con estructura:
{
  "id": "string",
  "label": "string",                    // "Día 1", "Montaje", etc.
  "date": "string",                     // YYYY-MM-DD (opcional)
  "rows": [                             // Array de actividades
    {
      "time": "string",                 // HH:mm
      "item": "string",                 // Actividad/Item
      "dept": "string",                 // Departamento (Audio, Luces, Video, etc.)
      "notes": "string"                 // Notas adicionales
    }
  ]
}

Debe incluir:
- Crew calls por departamento (Audio, Luces, Video, Escenario)
- Load in
- Lunch
- Line check
- Changeover
- Meet & greet
- VIP
- Press/Prensa
- Soundcheck
- Doors
- Show times
- Load out
';

-- ============================================================================
-- EXTENDER crew_calls EN hoja_de_ruta
-- ============================================================================

COMMENT ON COLUMN public.hoja_de_ruta.crew_calls IS
'Llamadas de crew por departamento.
Array de objetos con estructura:
{
  "id": "string",
  "department": "string",               // "Audio", "Luces", "Video", "Escenario", etc.
  "call_time": "string",                // HH:mm
  "location": "string",                 // Ubicación de la llamada
  "notes": "string",
  "crew_members": ["string"],           // IDs de técnicos
  "completed": "boolean"
}';

-- ============================================================================
-- CREAR ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================================================

-- Índices GIN para búsqueda en JSONB
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_tiempos_show_gin
  ON public.hoja_de_ruta USING GIN (tiempos_show);

CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_hospitalidad_gin
  ON public.hoja_de_ruta USING GIN (hospitalidad);

CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_detalles_produccion_gin
  ON public.hoja_de_ruta USING GIN (detalles_produccion);

-- ============================================================================
-- FUNCIÓN DE AYUDA: Obtener hoja de ruta completa para un tour_date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_complete_day_sheet(p_tour_date_id UUID)
RETURNS TABLE (
  -- Información básica
  tour_date_info JSONB,
  hoja_de_ruta_info JSONB,

  -- Secciones de la hoja de ruta
  encabezado JSONB,
  tiempos JSONB,
  hospitalidad_info JSONB,
  produccion JSONB,
  merch JSONB,
  acceso JSONB,
  seguridad_info JSONB,
  liquidacion_info JSONB,
  notas JSONB,

  -- Información relacionada
  hotel JSONB,
  contactos_locales JSONB,
  programa JSONB,
  llamadas_crew JSONB,
  especificaciones_tecnicas JSONB,
  logistica JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Información básica del tour_date
    to_jsonb(td.*) as tour_date_info,
    to_jsonb(hdr.*) as hoja_de_ruta_info,

    -- Secciones
    hdr.encabezado_info as encabezado,
    hdr.tiempos_show as tiempos,
    hdr.hospitalidad as hospitalidad_info,
    hdr.detalles_produccion as produccion,
    hdr.merchandising as merch,
    hdr.politica_acceso as acceso,
    hdr.seguridad as seguridad_info,
    hdr.liquidacion as liquidacion_info,
    hdr.notas_especiales as notas,

    -- Información relacionada
    hdr.hotel_info as hotel,
    hdr.local_contacts as contactos_locales,
    hdr.program_schedule_json as programa,
    hdr.crew_calls as llamadas_crew,
    hdr.venue_technical_specs as especificaciones_tecnicas,
    hdr.logistics_info as logistica
  FROM public.tour_dates td
  LEFT JOIN public.hoja_de_ruta hdr ON hdr.tour_date_id = td.id
  WHERE td.id = p_tour_date_id;
END;
$$;

COMMENT ON FUNCTION public.get_complete_day_sheet(UUID) IS
'Obtiene toda la información de la hoja de ruta para un tour_date específico.
Retorna todas las secciones organizadas para generar el PDF de la hoja de ruta.

Uso:
  SELECT * FROM get_complete_day_sheet(''uuid-del-tour-date'');
';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Asegurar que los usuarios autenticados puedan usar la función
GRANT EXECUTE ON FUNCTION public.get_complete_day_sheet(UUID) TO authenticated;

-- ============================================================================
-- NOTAS DE MIGRACIÓN
-- ============================================================================

-- Esta migración:
-- ✓ Añade 8 nuevos campos JSONB a hoja_de_ruta
-- ✓ Documenta estructura extendida de campos existentes (hotel_info, local_contacts, etc.)
-- ✓ Crea índices GIN para búsquedas eficientes en JSONB
-- ✓ Proporciona función helper para obtener datos completos
-- ✓ Es completamente retrocompatible (campos con DEFAULT)
-- ✓ No requiere migración de datos existentes

-- Siguiente paso: Actualizar tipos TypeScript para reflejar estas estructuras
