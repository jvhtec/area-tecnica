export const HOJA_DE_RUTA_PDF_SECTIONS = [
  { id: "event", label: "Evento", filenameLabel: "Evento" },
  { id: "venue", label: "Lugar", filenameLabel: "Lugar" },
  { id: "weather", label: "Clima", filenameLabel: "Clima" },
  { id: "contacts", label: "Contactos", filenameLabel: "Contactos" },
  { id: "staff", label: "Personal", filenameLabel: "Personal" },
  { id: "travel", label: "Viajes", filenameLabel: "Viajes" },
  { id: "accommodation", label: "Alojamiento", filenameLabel: "Alojamiento" },
  { id: "logistics", label: "Logística", filenameLabel: "Logistica" },
  { id: "schedule", label: "Programa", filenameLabel: "Programa" },
  { id: "restaurants", label: "Restaurantes", filenameLabel: "Restaurantes" },
] as const;

export type HojaDeRutaPdfSectionId = (typeof HOJA_DE_RUTA_PDF_SECTIONS)[number]["id"];

const SECTION_BY_ID = new Map<HojaDeRutaPdfSectionId, (typeof HOJA_DE_RUTA_PDF_SECTIONS)[number]>(
  HOJA_DE_RUTA_PDF_SECTIONS.map((section) => [section.id, section])
);

const SECTION_ID_SET = new Set<string>(HOJA_DE_RUTA_PDF_SECTIONS.map((section) => section.id));

export const HOJA_DE_RUTA_PRINT_SECTIONS = [
  { id: "event-details", label: "Información del Evento", parentSectionId: "event" },
  { id: "aux-needs", label: "Necesidades Auxiliares", parentSectionId: "event" },
  { id: "venue", label: "Lugar", parentSectionId: "venue" },
  { id: "weather", label: "Clima", parentSectionId: "weather" },
  { id: "contacts", label: "Contactos", parentSectionId: "contacts" },
  { id: "staff", label: "Personal", parentSectionId: "staff" },
  { id: "travel", label: "Viajes", parentSectionId: "travel" },
  { id: "accommodation", label: "Alojamiento", parentSectionId: "accommodation" },
  { id: "logistics-transport", label: "Transporte", parentSectionId: "logistics" },
  { id: "logistics-details", label: "Logística del Evento", parentSectionId: "logistics" },
  { id: "program", label: "Programa", parentSectionId: "schedule" },
  { id: "schedule-notes", label: "Programa (Texto Libre)", parentSectionId: "schedule" },
  { id: "power", label: "Requisitos de Energía", parentSectionId: "schedule" },
  { id: "restaurants", label: "Restaurantes", parentSectionId: "restaurants" },
] as const satisfies readonly {
  id: string;
  label: string;
  parentSectionId: HojaDeRutaPdfSectionId;
}[];

export type HojaDeRutaPrintSectionId = (typeof HOJA_DE_RUTA_PRINT_SECTIONS)[number]["id"];

const PRINT_SECTION_BY_ID = new Map<HojaDeRutaPrintSectionId, (typeof HOJA_DE_RUTA_PRINT_SECTIONS)[number]>(
  HOJA_DE_RUTA_PRINT_SECTIONS.map((section) => [section.id, section])
);

const PRINT_SECTION_ID_SET = new Set<string>(HOJA_DE_RUTA_PRINT_SECTIONS.map((section) => section.id));

const LEGACY_PRINT_SECTION_EXPANSIONS: Record<HojaDeRutaPdfSectionId, HojaDeRutaPrintSectionId[]> = {
  event: ["event-details", "aux-needs"],
  venue: ["venue"],
  weather: ["weather"],
  contacts: ["contacts"],
  staff: ["staff"],
  travel: ["travel"],
  accommodation: ["accommodation"],
  logistics: ["logistics-transport", "logistics-details"],
  schedule: ["program", "schedule-notes", "power"],
  restaurants: ["restaurants"],
};

export const isHojaDeRutaPdfSectionId = (value: string): value is HojaDeRutaPdfSectionId =>
  SECTION_ID_SET.has(value);

export const normalizeHojaDeRutaPdfSections = (value: unknown): HojaDeRutaPdfSectionId[] => {
  if (!Array.isArray(value)) return [];

  const normalized: HojaDeRutaPdfSectionId[] = [];
  const seen = new Set<HojaDeRutaPdfSectionId>();

  value.forEach((sectionId) => {
    if (typeof sectionId !== "string" || !isHojaDeRutaPdfSectionId(sectionId)) return;
    if (seen.has(sectionId)) return;

    seen.add(sectionId);
    normalized.push(sectionId);
  });

  return normalized;
};

export const isHojaDeRutaPrintSectionId = (value: string): value is HojaDeRutaPrintSectionId =>
  PRINT_SECTION_ID_SET.has(value);

export const normalizeHojaDeRutaPrintSections = (value: unknown): HojaDeRutaPrintSectionId[] => {
  if (!Array.isArray(value)) return [];

  const normalized: HojaDeRutaPrintSectionId[] = [];
  const seen = new Set<HojaDeRutaPrintSectionId>();

  const addSection = (sectionId: HojaDeRutaPrintSectionId) => {
    if (seen.has(sectionId)) return;
    seen.add(sectionId);
    normalized.push(sectionId);
  };

  value.forEach((sectionId) => {
    if (typeof sectionId !== "string") return;

    if (isHojaDeRutaPrintSectionId(sectionId)) {
      addSection(sectionId);
      return;
    }

    if (isHojaDeRutaPdfSectionId(sectionId)) {
      LEGACY_PRINT_SECTION_EXPANSIONS[sectionId].forEach(addSection);
    }
  });

  return normalized;
};

export const getHojaDeRutaPdfSectionLabel = (sectionId: HojaDeRutaPdfSectionId): string =>
  SECTION_BY_ID.get(sectionId)?.label ?? sectionId;

export const getHojaDeRutaPdfSectionFilenameLabel = (sectionId: HojaDeRutaPdfSectionId): string =>
  SECTION_BY_ID.get(sectionId)?.filenameLabel ?? sectionId;

export const getHojaDeRutaPdfSelectionLabel = (
  sectionIds?: readonly HojaDeRutaPdfSectionId[]
): string | undefined => {
  if (!sectionIds || sectionIds.length === 0) return undefined;
  if (sectionIds.length === 1) return getHojaDeRutaPdfSectionLabel(sectionIds[0]);
  return "Secciones seleccionadas";
};

export const getHojaDeRutaPrintSectionLabel = (sectionId: HojaDeRutaPrintSectionId): string =>
  PRINT_SECTION_BY_ID.get(sectionId)?.label ?? sectionId;
