export const HOJA_DE_RUTA_PDF_SECTIONS = [
  { id: "event", label: "Evento", filenameLabel: "Evento" },
  { id: "venue", label: "Venue", filenameLabel: "Venue" },
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

export const isHojaDeRutaPdfSectionId = (value: string): value is HojaDeRutaPdfSectionId =>
  SECTION_ID_SET.has(value);

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
