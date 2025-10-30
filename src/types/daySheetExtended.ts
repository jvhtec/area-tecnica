/**
 * Tipos TypeScript para Hojas de Ruta (Day Sheets) Extendidas
 *
 * Este archivo define las interfaces TypeScript para todos los campos extendidos
 * de las hojas de ruta profesionales. Estos tipos corresponden a los campos JSONB
 * en la tabla hoja_de_ruta de la base de datos.
 *
 * Actualizado para incluir campos completos según estándares de la industria.
 */

// ============================================================================
// ENCABEZADO DE LA HOJA DE RUTA
// ============================================================================

export interface EncabezadoInfo {
  nombre_tour?: string;
  artista?: string;
  leg?: string;
  numero_show?: number;
  nota_dst?: string;
  enlace_mapa?: string;
  hora_amanecer?: string; // HH:mm
  hora_atardecer?: string; // HH:mm
  moneda_local?: string; // EUR, USD, GBP, etc.
  tipo_venue?: 'festival' | 'teatro' | 'arena' | 'club' | 'exterior' | 'estadio' | 'otro';
  capacidad?: number;
}

// ============================================================================
// TIEMPOS DEL SHOW
// ============================================================================

export interface TiemposShow {
  soundcheck?: string; // HH:mm
  puertas?: string; // HH:mm (doors open)
  soporte_inicio?: string; // HH:mm (support act on)
  cambio_escenario?: string; // HH:mm (set change)
  headliner_inicio?: string; // HH:mm (headliner on)
  curfew?: string; // HH:mm
  duracion_show_minutos?: number;
  nota_curfew_estricto?: string;
  bus_call?: string; // HH:mm
  carga_completa_objetivo?: string; // HH:mm (load out complete target)
  plan_viaje_posterior?: string; // Descripción del after-show travel
}

// ============================================================================
// HOSPITALIDAD
// ============================================================================

export interface CateringInfo {
  desayuno_personas?: number;
  almuerzo_personas?: number;
  cena_personas?: number;
  desayuno_hora?: string; // HH:mm
  almuerzo_hora?: string; // HH:mm
  cena_hora?: string; // HH:mm
  buyout_cantidad?: number; // EUR
  buyout_notas?: string;
}

export interface DietaInfo {
  alergias?: string[];
  requisitos_dieteticos?: string[]; // ["vegetariano", "vegano", "sin gluten", etc.]
  especificacion_cafe?: string;
  especificacion_agua?: string;
}

export interface AmenidadesInfo {
  duchas?: boolean;
  toallas?: boolean;
  lavanderia?: boolean;
  camerinos?: number;
  wifi_ssid?: string;
  wifi_password?: string;
}

export interface Hospitalidad {
  catering?: CateringInfo;
  dieta?: DietaInfo;
  amenidades?: AmenidadesInfo;
}

// ============================================================================
// DETALLES DE PRODUCCIÓN
// ============================================================================

export interface EscenarioInfo {
  ancho_m?: number;
  profundidad_m?: number;
  altura_m?: number;
  ala_izquierda_m?: number; // Wing space left
  ala_derecha_m?: number; // Wing space right
  altura_muelle_carga_m?: number; // Dock height
  ascensor_carga?: boolean;
  capacidad_ascensor_kg?: number;
}

export interface RiggingInfo {
  altura_grid_m?: number;
  puntos_rigging?: number;
  carga_maxima_kg?: number;
  hora_steel_listo?: string; // HH:mm
}

export interface EnergiaInfo {
  shore_power_buses?: boolean;
  ubicacion_shore_power?: string;
  servicios_energia?: string;
  tie_ins?: string;
}

export interface AudioInfo {
  foh_distancia_m?: number; // FOH throw
  posicion_mezcla?: string;
  limite_spl_db?: number;
  ordenanza_ruido?: string;
  notas_patch?: string;
  enlaces_rf?: string;
}

export interface BacklineInfo {
  notas_backline?: string;
  alquileres_locales?: string;
}

export interface DetallesProduccion {
  escenario?: EscenarioInfo;
  rigging?: RiggingInfo;
  energia?: EnergiaInfo;
  audio?: AudioInfo;
  backline?: BacklineInfo;
}

// ============================================================================
// MERCHANDISING
// ============================================================================

export interface Merchandising {
  porcentaje_venta?: number; // % comisión del venue
  porcentaje_impuesto?: number; // % impuestos
  porcentaje_tarjeta?: number; // % fee de tarjeta de crédito
  nombre_vendedor?: string;
  ubicacion_mesa?: string;
  hora_recuento?: string; // HH:mm
  lugar_settlement?: string;
}

// ============================================================================
// POLÍTICA DE ACCESO
// ============================================================================

export interface PoliticaAcceso {
  politica_pases?: string;
  pulseras?: string; // Wristbands
  reglas_fotos?: string; // Photo policy
  restricciones_edad?: string;
}

// ============================================================================
// SEGURIDAD
// ============================================================================

export interface Seguridad {
  salidas_emergencia?: string;
  medicos_en_sitio?: boolean;
  ubicacion_medicos?: string;
  permisos_pirotecnia?: string;
  permisos_humo?: string; // Haze permits
  postura_seguridad?: string; // Security posture
  tipo_barricada?: string;
  reglas_acceso_foso?: string; // Pit access rules
}

// ============================================================================
// LIQUIDACIÓN
// ============================================================================

export interface Liquidacion {
  garantia_eur?: number;
  triggers_bonus?: string; // Cuándo se activan bonos
  hora_settlement?: string; // HH:mm
  lugar_settlement?: string;
  oficina_settlement?: string;
  quien_asiste?: string[]; // Quién debe asistir al settlement
  facturar_a?: string;
  nota_retencion_fiscal?: string;
}

// ============================================================================
// NOTAS ESPECIALES
// ============================================================================

export interface NotasEspeciales {
  invitados_especiales?: string;
  prensa?: string;
  peculiaridades_venue?: string;
  no_repetir?: string; // "Don't do this again" space
}

// ============================================================================
// INFORMACIÓN DE HOTEL EXTENDIDA
// ============================================================================

export interface HotelInfoExtendida {
  // Campos originales
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  check_in_time?: string;
  check_out_time?: string;
  rooms_booked?: number;
  confirmation_number?: string;
  parking_available?: boolean;
  wifi_available?: boolean;
  breakfast_included?: boolean;
  notes?: string;
  latitude?: number;
  longitude?: number;

  // Campos nuevos
  telefono_recepcion?: string;
  nombre_grupo?: string;
  url_rooming_list?: string;
  late_checkout_aprobado?: boolean;
  distancia_venue_km?: number;
  tiempo_conduccion_min?: number;
  notas_parking?: string;
}

// ============================================================================
// CONTACTOS LOCALES EXTENDIDOS
// ============================================================================

export type RolContacto =
  | 'promoter_rep'
  | 'venue_ops'
  | 'production_manager'
  | 'tour_manager'
  | 'box_office'
  | 'security_chief'
  | 'runner_dispatch'
  | 'emergency'
  | 'other';

export interface ContactoLocalExtendido {
  id: string;
  name: string;
  role: RolContacto;
  phone?: string;
  mobile?: string;
  email?: string;
  whatsapp_preferido?: boolean;
  sms_preferido?: boolean;
  company?: string;
  available_hours?: string;
  notes?: string;
  is_emergency_contact?: boolean;
}

// ============================================================================
// HOJA DE RUTA COMPLETA (interfaz principal)
// ============================================================================

export interface HojaDeRutaCompleta {
  // IDs y referencias
  id?: string;
  tour_date_id?: string;
  job_id?: string;

  // Secciones principales
  encabezado_info?: EncabezadoInfo;
  tiempos_show?: TiemposShow;
  hospitalidad?: Hospitalidad;
  detalles_produccion?: DetallesProduccion;
  merchandising?: Merchandising;
  politica_acceso?: PoliticaAcceso;
  seguridad?: Seguridad;
  liquidacion?: Liquidacion;
  notas_especiales?: NotasEspeciales;

  // Información relacionada (campos existentes extendidos)
  hotel_info?: HotelInfoExtendida;
  local_contacts?: ContactoLocalExtendido[];
  program_schedule_json?: any; // ProgramDay[] - ya definido en hoja-de-ruta.ts
  crew_calls?: any[]; // CrewCall[] - ya definido en tourScheduling.ts
  venue_technical_specs?: any; // VenueTechnicalSpecs - ya definido
  logistics_info?: any; // LogisticsInfo - ya definido
  restaurants_info?: any[]; // RestaurantInfo[] - ya definido
  alerts?: any[]; // Alert[] - ya definido

  // Metadatos
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// ============================================================================
// TIPOS DE AYUDA PARA FORMULARIOS
// ============================================================================

/**
 * Tipo para secciones editables de la hoja de ruta
 */
export type SeccionHojaDeRuta =
  | 'encabezado'
  | 'tiempos'
  | 'hospitalidad'
  | 'produccion'
  | 'merchandising'
  | 'acceso'
  | 'seguridad'
  | 'liquidacion'
  | 'notas';

/**
 * Labels para las secciones (para UI)
 */
export const LABELS_SECCIONES: Record<SeccionHojaDeRuta, string> = {
  encabezado: 'Información del Encabezado',
  tiempos: 'Tiempos del Show',
  hospitalidad: 'Hospitalidad y Catering',
  produccion: 'Detalles de Producción',
  merchandising: 'Merchandising',
  acceso: 'Política de Acceso',
  seguridad: 'Seguridad',
  liquidacion: 'Liquidación',
  notas: 'Notas Especiales',
};

/**
 * Iconos para las secciones (usando lucide-react icons)
 */
export const ICONOS_SECCIONES: Record<SeccionHojaDeRuta, string> = {
  encabezado: 'info',
  tiempos: 'clock',
  hospitalidad: 'utensils',
  produccion: 'settings',
  merchandising: 'shopping-bag',
  acceso: 'key',
  seguridad: 'shield',
  liquidacion: 'dollar-sign',
  notas: 'sticky-note',
};

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

export const DEFAULT_ENCABEZADO: EncabezadoInfo = {
  moneda_local: 'EUR',
  tipo_venue: 'otro',
};

export const DEFAULT_TIEMPOS_SHOW: TiemposShow = {
  duracion_show_minutos: 90,
};

export const DEFAULT_HOSPITALIDAD: Hospitalidad = {
  catering: {
    desayuno_personas: 0,
    almuerzo_personas: 0,
    cena_personas: 0,
  },
  dieta: {
    alergias: [],
    requisitos_dieteticos: [],
  },
  amenidades: {
    duchas: false,
    toallas: false,
    lavanderia: false,
    camerinos: 1,
  },
};

export const DEFAULT_DETALLES_PRODUCCION: DetallesProduccion = {
  escenario: {},
  rigging: {},
  energia: {
    shore_power_buses: false,
  },
  audio: {},
  backline: {},
};

export const DEFAULT_MERCHANDISING: Merchandising = {
  porcentaje_venta: 20,
  porcentaje_impuesto: 21,
  porcentaje_tarjeta: 2,
};

export const DEFAULT_SEGURIDAD: Seguridad = {
  medicos_en_sitio: false,
};

// ============================================================================
// HELPERS PARA VALIDACIÓN
// ============================================================================

/**
 * Valida que un tiempo esté en formato HH:mm
 */
export function esFormatoHoraValido(hora?: string): boolean {
  if (!hora) return true;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(hora);
}

/**
 * Valida que todos los tiempos en TiemposShow sean válidos
 */
export function validarTiemposShow(tiempos: TiemposShow): string[] {
  const errores: string[] = [];
  const campos = [
    'soundcheck',
    'puertas',
    'soporte_inicio',
    'cambio_escenario',
    'headliner_inicio',
    'curfew',
    'bus_call',
    'carga_completa_objetivo',
  ] as const;

  campos.forEach((campo) => {
    if (tiempos[campo] && !esFormatoHoraValido(tiempos[campo])) {
      errores.push(`${campo} debe estar en formato HH:mm`);
    }
  });

  return errores;
}

/**
 * Obtiene un resumen de completitud de la hoja de ruta
 */
export function obtenerCompletion(hoja: HojaDeRutaCompleta): {
  porcentaje: number;
  secciones_completas: SeccionHojaDeRuta[];
  secciones_incompletas: SeccionHojaDeRuta[];
} {
  const secciones: SeccionHojaDeRuta[] = [
    'encabezado',
    'tiempos',
    'hospitalidad',
    'produccion',
    'merchandising',
    'acceso',
    'seguridad',
    'liquidacion',
    'notas',
  ];

  const completas: SeccionHojaDeRuta[] = [];
  const incompletas: SeccionHojaDeRuta[] = [];

  secciones.forEach((seccion) => {
    const campo = `${seccion === 'tiempos' ? 'tiempos_show' : seccion === 'produccion' ? 'detalles_produccion' : seccion === 'acceso' ? 'politica_acceso' : seccion === 'notas' ? 'notas_especiales' : `${seccion}`}` as keyof HojaDeRutaCompleta;
    const valor = hoja[campo];

    if (valor && typeof valor === 'object' && Object.keys(valor).length > 0) {
      completas.push(seccion);
    } else {
      incompletas.push(seccion);
    }
  });

  return {
    porcentaje: (completas.length / secciones.length) * 100,
    secciones_completas: completas,
    secciones_incompletas: incompletas,
  };
}

// ============================================================================
// TIPOS PARA RESPUESTA DE LA FUNCIÓN get_complete_day_sheet
// ============================================================================

export interface CompleteDaySheetResponse {
  tour_date_info: any;
  hoja_de_ruta_info: any;
  encabezado: EncabezadoInfo;
  tiempos: TiemposShow;
  hospitalidad_info: Hospitalidad;
  produccion: DetallesProduccion;
  merch: Merchandising;
  acceso: PoliticaAcceso;
  seguridad_info: Seguridad;
  liquidacion_info: Liquidacion;
  notas: NotasEspeciales;
  hotel: HotelInfoExtendida;
  contactos_locales: ContactoLocalExtendido[];
  programa: any;
  llamadas_crew: any[];
  especificaciones_tecnicas: any;
  logistica: any;
}
