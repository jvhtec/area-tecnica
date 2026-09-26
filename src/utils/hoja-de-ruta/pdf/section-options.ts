import {
  HOJA_PRINT_PART_DEFINITIONS,
  HOJA_SECTION_DEFINITIONS,
  type HojaPrintPartId,
  type HojaSectionId,
} from "@/features/hoja-de-ruta/model/sectionDefinitions";

export const HOJA_DE_RUTA_PDF_SECTIONS = HOJA_SECTION_DEFINITIONS;
export type HojaDeRutaPdfSectionId = HojaSectionId;

const SECTION_BY_ID = new Map<
  HojaDeRutaPdfSectionId,
  (typeof HOJA_DE_RUTA_PDF_SECTIONS)[number]
>(HOJA_DE_RUTA_PDF_SECTIONS.map((section) => [section.id, section]));

const SECTION_ID_SET = new Set<string>(
  HOJA_DE_RUTA_PDF_SECTIONS.map((section) => section.id),
);

export const HOJA_DE_RUTA_PRINT_SECTIONS = HOJA_PRINT_PART_DEFINITIONS;
export type HojaDeRutaPrintSectionId = HojaPrintPartId;

const PRINT_SECTION_BY_ID = new Map<
  HojaDeRutaPrintSectionId,
  (typeof HOJA_DE_RUTA_PRINT_SECTIONS)[number]
>(HOJA_DE_RUTA_PRINT_SECTIONS.map((section) => [section.id, section]));

const PRINT_SECTION_ID_SET = new Set<string>(
  HOJA_DE_RUTA_PRINT_SECTIONS.map((section) => section.id),
);

const LEGACY_PRINT_SECTION_EXPANSIONS: Record<
  HojaDeRutaPdfSectionId,
  HojaDeRutaPrintSectionId[]
> = Object.fromEntries(
  HOJA_DE_RUTA_PDF_SECTIONS.map((section) => [
    section.id,
    [...section.printParts],
  ]),
) as Record<HojaDeRutaPdfSectionId, HojaDeRutaPrintSectionId[]>;

export const isHojaDeRutaPdfSectionId = (
  value: string,
): value is HojaDeRutaPdfSectionId => SECTION_ID_SET.has(value);

export const normalizeHojaDeRutaPdfSections = (
  value: unknown,
): HojaDeRutaPdfSectionId[] => {
  if (!Array.isArray(value)) return [];

  const normalized: HojaDeRutaPdfSectionId[] = [];
  const seen = new Set<HojaDeRutaPdfSectionId>();

  value.forEach((sectionId) => {
    if (
      typeof sectionId !== "string"
      || !isHojaDeRutaPdfSectionId(sectionId)
      || seen.has(sectionId)
    ) {
      return;
    }
    seen.add(sectionId);
    normalized.push(sectionId);
  });

  return normalized;
};

export const isHojaDeRutaPrintSectionId = (
  value: string,
): value is HojaDeRutaPrintSectionId => PRINT_SECTION_ID_SET.has(value);

export const normalizeHojaDeRutaPrintSections = (
  value: unknown,
): HojaDeRutaPrintSectionId[] => {
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

export const getHojaDeRutaPdfSectionLabel = (
  sectionId: HojaDeRutaPdfSectionId,
): string => SECTION_BY_ID.get(sectionId)?.label ?? sectionId;

export const getHojaDeRutaPdfSectionFilenameLabel = (
  sectionId: HojaDeRutaPdfSectionId,
): string => SECTION_BY_ID.get(sectionId)?.filenameLabel ?? sectionId;

export const getHojaDeRutaPdfSelectionLabel = (
  sectionIds?: readonly HojaDeRutaPdfSectionId[],
): string | undefined => {
  if (!sectionIds?.length) return undefined;
  if (sectionIds.length === 1) return getHojaDeRutaPdfSectionLabel(sectionIds[0]);
  return "Secciones seleccionadas";
};

export const getHojaDeRutaPrintSectionLabel = (
  sectionId: HojaDeRutaPrintSectionId,
): string => PRINT_SECTION_BY_ID.get(sectionId)?.label ?? sectionId;
