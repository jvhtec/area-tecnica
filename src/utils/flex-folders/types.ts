
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
  | "crewCallSound" // Personnel: Crew Call Sonido
  | "crewCallLights"; // Personnel: Crew Call Luces

export type CreateFoldersOptions = Partial<Record<DepartmentKey, SubfolderKey[]>>;

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
