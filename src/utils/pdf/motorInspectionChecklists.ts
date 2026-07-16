import type { MotorBrandKey } from "@/utils/pdf/motorBrandLogos";

export const MOTOR_INSPECTION_CHECKLIST_URL = "/certificates/motor-inspection-checklists-2026.json";

export type MotorInspectionCheck = {
  area: string;
  verification: string;
};

export type MotorInspectionChecklist = {
  label: string;
  source: string;
  result: string;
  manufacturerSpecific: boolean;
  checks: MotorInspectionCheck[];
};

export type MotorInspectionChecklists = Record<MotorBrandKey | "generic", MotorInspectionChecklist>;

type MotorInspectionChecklistDocument = {
  version: string;
  campaignYear: number;
  checklists: MotorInspectionChecklists;
};

const isChecklist = (value: unknown): value is MotorInspectionChecklist => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MotorInspectionChecklist>;
  return typeof candidate.label === "string"
    && typeof candidate.source === "string"
    && typeof candidate.result === "string"
    && typeof candidate.manufacturerSpecific === "boolean"
    && Array.isArray(candidate.checks)
    && candidate.checks.length > 0
    && candidate.checks.every((item) => (
      item
      && typeof item === "object"
      && typeof (item as MotorInspectionCheck).area === "string"
      && typeof (item as MotorInspectionCheck).verification === "string"
    ));
};

const parseChecklistDocument = (value: unknown): MotorInspectionChecklists => {
  if (!value || typeof value !== "object") throw new Error("El checklist de motores 2026 no es válido.");
  const document = value as Partial<MotorInspectionChecklistDocument>;
  const entries = document.checklists;
  if (
    document.campaignYear !== 2026
    || typeof document.version !== "string"
    || !entries
    || !isChecklist(entries.chainmaster)
    || !isChecklist(entries.liftket)
    || !isChecklist(entries.cm)
    || !isChecklist(entries.generic)
  ) {
    throw new Error("El checklist de motores 2026 no es válido.");
  }
  return entries;
};

export const loadMotorInspectionChecklists = async (
  fetchDocument: typeof fetch = globalThis.fetch,
): Promise<MotorInspectionChecklists> => {
  const response = await fetchDocument(MOTOR_INSPECTION_CHECKLIST_URL);
  if (!response.ok) throw new Error("No se pudo cargar el checklist de motores 2026.");
  return parseChecklistDocument(await response.json());
};

export const resolveMotorInspectionChecklist = (
  checklists: MotorInspectionChecklists,
  brand: MotorBrandKey | null,
): MotorInspectionChecklist => checklists[brand ?? "generic"];
