import { buildReadableFilename } from "@/utils/fileName";

/** Which documents the "print all documentation" dialog includes, and for which stages. */
export interface PrintOptions {
  includeGearSetup: boolean;
  gearSetupStages: number[];
  includeShiftSchedules: boolean;
  shiftScheduleStages: number[];
  includeArtistTables: boolean;
  artistTableStages: number[];
  includeArtistRequirements: boolean;
  artistRequirementStages: number[];
  includeRfIemTable: boolean;
  rfIemTableStages: number[];
  includeInfrastructureTable: boolean;
  infrastructureTableStages: number[];
  includeMissingRiderReport: boolean;
  includeWiredMicNeeds: boolean;
  wiredMicNeedsStages: number[];
  includeWeatherPrediction: boolean;
  generateIndividualStagePDFs: boolean;
}

export type PrintStageKey = {
  [K in keyof PrintOptions]: PrintOptions[K] extends number[] ? K : never;
}[keyof PrintOptions];

export type PrintIncludeKey = {
  [K in keyof PrintOptions]: PrintOptions[K] extends boolean ? K : never;
}[keyof PrintOptions];

/** The one-click downloads offered next to a section (the others only exist in the full bundle). */
export type PrintDownloadKind =
  | "gearSetup"
  | "shiftSchedules"
  | "artistTables"
  | "rfIemTable"
  | "infrastructureTable"
  | "wiredMicNeeds"
  | "missingRiderReport";

export interface PrintSection {
  id: string;
  include: PrintIncludeKey;
  /** Absent for sections that are not split by stage (weather, missing riders). */
  stages?: PrintStageKey;
  label: string;
  hint?: string;
  /** Label of the section in the generated file name. */
  filenameLabel: string;
  download?: PrintDownloadKind;
}

/** Every section of the dialog, in the order it is shown. */
export const PRINT_SECTIONS: readonly PrintSection[] = [
  {
    id: "gear-setup",
    include: "includeGearSetup",
    stages: "gearSetupStages",
    label: "Configuración de Equipamiento por Stage",
    filenameLabel: "Dotación técnica",
    download: "gearSetup",
  },
  {
    id: "shift-schedules",
    include: "includeShiftSchedules",
    stages: "shiftScheduleStages",
    label: "Horarios de Turnos de Personal",
    filenameLabel: "Horarios de turnos",
    download: "shiftSchedules",
  },
  {
    id: "artist-tables",
    include: "includeArtistTables",
    stages: "artistTableStages",
    label: "Tablas de Programación de Artistas",
    filenameLabel: "Cronograma artistas",
    download: "artistTables",
  },
  {
    id: "artist-requirements",
    include: "includeArtistRequirements",
    stages: "artistRequirementStages",
    label: "Requerimientos Individuales de Artistas",
    filenameLabel: "Fichas individuales artistas",
  },
  {
    id: "rf-iem-table",
    include: "includeRfIemTable",
    stages: "rfIemTableStages",
    label: "Resumen de RF e IEM de Artistas",
    filenameLabel: "Tabla RF IEM",
    download: "rfIemTable",
  },
  {
    id: "infrastructure-table",
    include: "includeInfrastructureTable",
    stages: "infrastructureTableStages",
    label: "Resumen de Necesidades de Infraestructura",
    filenameLabel: "Tabla infraestructura",
    download: "infrastructureTable",
  },
  {
    id: "wired-mic-needs",
    include: "includeWiredMicNeeds",
    stages: "wiredMicNeedsStages",
    label: "Requerimientos de Micrófonos Cableados",
    hint: "Requerimientos detallados de inventario de micrófonos y análisis de uso pico",
    filenameLabel: "Micrófonos cableados",
    download: "wiredMicNeeds",
  },
  {
    id: "weather-prediction",
    include: "includeWeatherPrediction",
    label: "Incluir Pronóstico del Tiempo",
    hint: "Pronóstico del tiempo para las fechas del festival de Open-Meteo",
    filenameLabel: "Predicción meteorológica",
  },
  {
    id: "missing-rider-report",
    include: "includeMissingRiderReport",
    label: "Reporte de Riders Faltantes",
    hint: "Resumen de todos los artistas con riders técnicos faltantes",
    filenameLabel: "Riders faltantes",
    download: "missingRiderReport",
  },
];

const STAGE_KEYS: readonly PrintStageKey[] = PRINT_SECTIONS.flatMap((section) =>
  section.stages ? [section.stages] : [],
);

export const stageNumbers = (maxStages: number): number[] =>
  Array.from({ length: maxStages }, (_, index) => index + 1);

/** Everything included, every stage selected. */
export function defaultPrintOptions(maxStages: number): PrintOptions {
  const all = stageNumbers(maxStages);
  return {
    includeGearSetup: true,
    gearSetupStages: [...all],
    includeShiftSchedules: true,
    shiftScheduleStages: [...all],
    includeArtistTables: true,
    artistTableStages: [...all],
    includeArtistRequirements: true,
    artistRequirementStages: [...all],
    includeRfIemTable: true,
    rfIemTableStages: [...all],
    includeInfrastructureTable: true,
    infrastructureTableStages: [...all],
    includeMissingRiderReport: true,
    includeWiredMicNeeds: true,
    wiredMicNeedsStages: [...all],
    includeWeatherPrediction: true,
    generateIndividualStagePDFs: false,
  };
}

/** Adds or removes one stage from one section's selection, keeping the list sorted. */
export function toggleStage(
  options: PrintOptions,
  section: PrintStageKey,
  stageNumber: number,
  checked: boolean,
): PrintOptions {
  const current = options[section];
  const next = checked
    ? current.includes(stageNumber)
      ? current
      : [...current, stageNumber].sort((a, b) => a - b)
    : current.filter((stage) => stage !== stageNumber);
  return { ...options, [section]: next };
}

/** Selects every stage (or none) in every section at once. */
export function setAllStages(options: PrintOptions, maxStages: number, selected: boolean): PrintOptions {
  const stages = selected ? stageNumbers(maxStages) : [];
  const next = { ...options };
  for (const key of STAGE_KEYS) next[key] = [...stages];
  return next;
}

/**
 * The file name the dialog proposes. One section → that section's name; several → "Documentación
 * completa"; per-stage PDFs → a zip. The stage is named only when it narrows the festival down.
 */
export function printFilename(options: PrintOptions, jobTitle: string, maxStages: number): string {
  const baseTitle = jobTitle || "Festival";

  if (options.generateIndividualStagePDFs) {
    return buildReadableFilename([baseTitle, "Documentación por escenario"], "zip");
  }

  const included = PRINT_SECTIONS.filter((section) => options[section.include]);
  // The label order is the order the documents are described elsewhere, not the dialog's order.
  const labelOrder = [
    "includeShiftSchedules",
    "includeGearSetup",
    "includeArtistTables",
    "includeRfIemTable",
    "includeInfrastructureTable",
    "includeMissingRiderReport",
    "includeArtistRequirements",
    "includeWiredMicNeeds",
    "includeWeatherPrediction",
  ] as const satisfies readonly PrintIncludeKey[];
  const sectionLabels = labelOrder.flatMap((key) => {
    const section = included.find((candidate) => candidate.include === key);
    return section ? [section.filenameLabel] : [];
  });

  const selectedStages = new Set<number>();
  for (const section of included) {
    if (section.stages) for (const stage of options[section.stages]) selectedStages.add(stage);
  }
  const sortedStages = [...selectedStages].sort((a, b) => a - b);
  const stageLabel =
    sortedStages.length > 0 && sortedStages.length < maxStages
      ? sortedStages.length === 1
        ? `Escenario ${sortedStages[0]}`
        : `Escenarios ${sortedStages.join(", ")}`
      : "";

  if (sectionLabels.length === 1) {
    return buildReadableFilename([baseTitle, stageLabel, sectionLabels[0]]);
  }
  return buildReadableFilename([baseTitle, stageLabel, "Documentación completa"]);
}
