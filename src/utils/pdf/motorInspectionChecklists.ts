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

export type MotorInspectionReport = {
  checklists: MotorInspectionChecklists;
  reportCopy: string[];
};

type MotorInspectionChecklistDocument = MotorInspectionReport & {
  version: string;
  campaignYear: number;
};

const CHECKLIST_KEYS = ["chainmaster", "liftket", "cm", "generic"] as const;
const TEXT_KEYS = ["label", "source", "result"] as const;

const isChecklist = (value: unknown): value is MotorInspectionChecklist => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MotorInspectionChecklist>;
  return TEXT_KEYS.every((key) => typeof candidate[key] === "string")
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

const parseChecklistDocument = (value: unknown): MotorInspectionReport => {
  if (!value || typeof value !== "object") throw new Error("El checklist de motores 2026 no es válido.");
  const document = value as Partial<MotorInspectionChecklistDocument>;
  const entries = document.checklists;
  if (
    document.campaignYear !== 2026
    || typeof document.version !== "string"
    || !Array.isArray(document.reportCopy)
    || document.reportCopy.length !== 25
    || !document.reportCopy.every((item) => typeof item === "string")
    || !entries
    || !CHECKLIST_KEYS.every((key) => isChecklist(entries[key]))
  ) {
    throw new Error("El checklist de motores 2026 no es válido.");
  }
  return document as MotorInspectionReport;
};

export const loadMotorInspectionReport = async (
  fetchDocument: typeof fetch = globalThis.fetch,
): Promise<MotorInspectionReport> => {
  const response = await fetchDocument(MOTOR_INSPECTION_CHECKLIST_URL);
  if (!response.ok) throw new Error("No se pudo cargar el checklist de motores 2026.");
  return parseChecklistDocument(await response.json());
};

export const resolveMotorInspectionChecklist = (
  checklists: MotorInspectionChecklists,
  brand: MotorBrandKey | null,
): MotorInspectionChecklist => checklists[brand ?? "generic"];
