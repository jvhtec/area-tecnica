
import { Department } from "@/types/department";

export type DepartmentKey =
  | "sound"
  | "lights"
  | "video"
  | "production"
  | "personnel"
  | "comercial";

// Toggleable items per department
export type SubfolderKey =
  | "hojaInfo" // SIP/LIP/VIP (only for sound/lights/video)
  | "documentacionTecnica" // DT
  | "presupuestosRecibidos" // PR
  | "hojaGastos" // HG (dept; also used for personnel “Gastos de Personal”)
  | "pullSheetTP" // Tour Pack pull sheet (sound)
  | "pullSheetPA" // PA pull sheet (sound, hidden by tour-pack-only)
  | "gastosDePersonal" // Personnel: “Gastos de Personal - ${job.title}”
  | "workOrder" // Personnel: “Orden de Trabajo - ${job.title}”
  | "crewCallSound" // Personnel: Crew Call Sonido
  | "crewCallLights" // Personnel: Crew Call Luces
  | "extrasSound" // Comercial extras for sound
  | "extrasLights" // Comercial extras for lights
  | "presupuestoSound" // Comercial presupuesto for sound
  | "presupuestoLights"; // Comercial presupuesto for lights

export interface FlexFolderMetadataEntry {
  name: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export interface CustomPullsheetSettings {
  enabled: boolean;
  name: string;
  startDate?: string;
  endDate?: string;
  entries?: FlexFolderMetadataEntry[];
}

export interface ExtrasPresupuestoSettings {
  startDate?: string;
  endDate?: string;
  entries?: FlexFolderMetadataEntry[];
}

export interface DepartmentSelectionOptions {
  subfolders?: SubfolderKey[];
  customPullsheet?: CustomPullsheetSettings;
  extrasPresupuesto?: ExtrasPresupuestoSettings;
}

export type CreateFoldersOptions = Partial<
  Record<DepartmentKey, DepartmentSelectionOptions>
>;

const cloneMetadataEntries = (
  entries?: FlexFolderMetadataEntry[]
): FlexFolderMetadataEntry[] | undefined =>
  entries?.map(entry => ({
    name: entry.name,
    plannedStartDate: entry.plannedStartDate,
    plannedEndDate: entry.plannedEndDate,
  }));

export const sanitizeMetadataEntries = (
  entries?: FlexFolderMetadataEntry[]
): FlexFolderMetadataEntry[] => {
  if (!entries) return [];

  return entries
    .map(entry => ({
      name: entry.name?.trim?.() ?? entry.name ?? "",
      plannedStartDate: entry.plannedStartDate || undefined,
      plannedEndDate: entry.plannedEndDate || undefined,
    }))
    .filter(
      entry =>
        Boolean(entry.name) ||
        Boolean(entry.plannedStartDate) ||
        Boolean(entry.plannedEndDate)
    );
};

export const cloneDepartmentSelectionOptions = (
  selection?: DepartmentSelectionOptions
): DepartmentSelectionOptions | undefined => {
  if (!selection) return undefined;

  const cloned: DepartmentSelectionOptions = {};

  if (selection.subfolders) {
    cloned.subfolders = [...selection.subfolders];
  }

  if (selection.customPullsheet) {
    cloned.customPullsheet = {
      ...selection.customPullsheet,
      entries: cloneMetadataEntries(selection.customPullsheet.entries),
    };
  }

  if (selection.extrasPresupuesto) {
    cloned.extrasPresupuesto = {
      ...selection.extrasPresupuesto,
      entries: cloneMetadataEntries(selection.extrasPresupuesto.entries),
    };
  }

  return cloned;
};

export const cloneOptions = (
  options?: CreateFoldersOptions
): CreateFoldersOptions => {
  if (!options) return {};

  const cloned: CreateFoldersOptions = {};

  for (const [dept, value] of Object.entries(options) as [
    DepartmentKey,
    DepartmentSelectionOptions | undefined,
  ][]) {
    const clonedSelection = cloneDepartmentSelectionOptions(value);
    if (clonedSelection) {
      cloned[dept] = clonedSelection;
    }
  }

  return cloned;
};

export interface SubfolderSelectionSummary {
  keys: SubfolderKey[];
  hasExplicitSelection: boolean;
}

export const getSubfolderSelectionSummary = (
  selection?: DepartmentSelectionOptions
): SubfolderSelectionSummary => {
  const keys = selection?.subfolders ? [...selection.subfolders] : [];
  return {
    keys,
    hasExplicitSelection: Array.isArray(selection?.subfolders),
  };
};

export const getDepartmentCustomPullsheetMetadata = (
  selection?: DepartmentSelectionOptions
): FlexFolderMetadataEntry[] => {
  const entries = selection?.customPullsheet?.entries;
  if (entries && entries.length > 0) {
    return entries.map(entry => ({ ...entry }));
  }

  const legacy = selection?.customPullsheet;
  if (!legacy) return [];

  const name = legacy.name?.trim?.() ?? legacy.name ?? "";
  const startDate = legacy.startDate || undefined;
  const endDate = legacy.endDate || undefined;

  if (!legacy.enabled && !name && !startDate && !endDate) {
    return [];
  }

  const metadata: FlexFolderMetadataEntry = {
    name,
    plannedStartDate: startDate,
    plannedEndDate: endDate,
  };

  if (!metadata.name && !metadata.plannedStartDate && !metadata.plannedEndDate) {
    return [];
  }

  return [metadata];
};

export const getDepartmentExtrasPresupuestoMetadata = (
  selection?: DepartmentSelectionOptions
): FlexFolderMetadataEntry[] => {
  const entries = selection?.extrasPresupuesto?.entries;
  if (entries && entries.length > 0) {
    return entries.map(entry => ({ ...entry }));
  }

  const legacy = selection?.extrasPresupuesto;
  if (!legacy) return [];

  const startDate = legacy.startDate || undefined;
  const endDate = legacy.endDate || undefined;

  if (!startDate && !endDate) {
    return [];
  }

  return [
    {
      name: "",
      plannedStartDate: startDate,
      plannedEndDate: endDate,
    },
  ];
};

export const setDepartmentCustomPullsheetMetadata = (
  selection: DepartmentSelectionOptions | undefined,
  entries: FlexFolderMetadataEntry[]
): DepartmentSelectionOptions => {
  const base = cloneDepartmentSelectionOptions(selection) ?? {};
  const sanitized = sanitizeMetadataEntries(entries);

  if (!base.customPullsheet) {
    base.customPullsheet = {
      enabled: sanitized.length > 0,
      name: "",
    };
  } else {
    base.customPullsheet = {
      ...base.customPullsheet,
    };
  }

  if (sanitized.length > 0) {
    base.customPullsheet.entries = sanitized;
  } else {
    delete base.customPullsheet.entries;
  }

  return base;
};

export const setDepartmentExtrasPresupuestoMetadata = (
  selection: DepartmentSelectionOptions | undefined,
  entries: FlexFolderMetadataEntry[]
): DepartmentSelectionOptions => {
  const base = cloneDepartmentSelectionOptions(selection) ?? {};
  const sanitized = sanitizeMetadataEntries(entries);

  if (!base.extrasPresupuesto) {
    base.extrasPresupuesto = {};
  }

  if (sanitized.length > 0) {
    base.extrasPresupuesto.entries = sanitized;
  } else {
    delete base.extrasPresupuesto.entries;
  }

  return base;
};

export const getCustomPullsheetMetadataForDepartment = (
  options: CreateFoldersOptions | undefined,
  dept: DepartmentKey
): FlexFolderMetadataEntry[] =>
  getDepartmentCustomPullsheetMetadata(options?.[dept]);

export const setCustomPullsheetMetadataForDepartment = (
  options: CreateFoldersOptions | undefined,
  dept: DepartmentKey,
  entries: FlexFolderMetadataEntry[]
): CreateFoldersOptions => {
  const base = cloneOptions(options);
  base[dept] = setDepartmentCustomPullsheetMetadata(base[dept], entries);
  return base;
};

export const getExtrasPresupuestoMetadataForDepartment = (
  options: CreateFoldersOptions | undefined,
  dept: DepartmentKey
): FlexFolderMetadataEntry[] =>
  getDepartmentExtrasPresupuestoMetadata(options?.[dept]);

export const setExtrasPresupuestoMetadataForDepartment = (
  options: CreateFoldersOptions | undefined,
  dept: DepartmentKey,
  entries: FlexFolderMetadataEntry[]
): CreateFoldersOptions => {
  const base = cloneOptions(options);
  base[dept] = setDepartmentExtrasPresupuestoMetadata(base[dept], entries);
  return base;
};

export const sanitizeCustomPullsheetSettings = (
  value?: CustomPullsheetSettings
): CustomPullsheetSettings | undefined => {
  if (!value) return undefined;

  const enabled = Boolean(value.enabled);
  const name = value.name?.trim?.() ?? value.name ?? "";
  const startDate = value.startDate || undefined;
  const endDate = value.endDate || undefined;
  const entries = sanitizeMetadataEntries(value.entries);

  if (!enabled && !name && !startDate && !endDate && entries.length === 0) {
    return undefined;
  }

  const sanitized: CustomPullsheetSettings = {
    enabled,
    name,
  };

  if (startDate) sanitized.startDate = startDate;
  if (endDate) sanitized.endDate = endDate;
  if (entries.length > 0) sanitized.entries = entries;

  return sanitized;
};

export const sanitizeExtrasPresupuestoSettings = (
  value?: ExtrasPresupuestoSettings
): ExtrasPresupuestoSettings | undefined => {
  if (!value) return undefined;

  const startDate = value.startDate || undefined;
  const endDate = value.endDate || undefined;
  const entries = sanitizeMetadataEntries(value.entries);

  if (!startDate && !endDate && entries.length === 0) {
    return undefined;
  }

  const sanitized: ExtrasPresupuestoSettings = {};
  if (startDate) sanitized.startDate = startDate;
  if (endDate) sanitized.endDate = endDate;
  if (entries.length > 0) sanitized.entries = entries;

  return sanitized;
};

// Helper to express “all defaults for a department”
export type DepartmentDefaultSelector = (dept: DepartmentKey) => SubfolderKey[];

export interface FlexFolderPayload {
  definitionId: string;
  parentElementId?: string;
  open: boolean;
  locked: boolean;
  name: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  locationId?: string;
  departmentId?: string;
  documentNumber?: string;
  personResponsibleId?: string;
}

export interface FlexFolderResponse {
  elementId: string;
  [key: string]: any;
}

export interface FolderCreationParams {
  job: any;
  formattedStartDate: string;
  formattedEndDate: string;
  documentNumber: string;
}
