export const TECHNICAL_POWER_DEPARTMENTS = ['sound', 'lights', 'video'] as const;

export type TechnicalPowerDepartment = (typeof TECHNICAL_POWER_DEPARTMENTS)[number];

export const isTechnicalPowerDepartment = (
  value: string | null | undefined
): value is TechnicalPowerDepartment =>
  typeof value === 'string' &&
  (TECHNICAL_POWER_DEPARTMENTS as readonly string[]).includes(value);

export const normalizeTechnicalPowerDepartments = (
  departments: readonly (string | null | undefined)[]
): TechnicalPowerDepartment[] =>
  Array.from(
    new Set(
      departments.filter((department): department is TechnicalPowerDepartment =>
        isTechnicalPowerDepartment(department)
      )
    )
  );

export interface PowerReportDocument {
  id?: string;
  file_name: string;
  file_path: string;
  uploaded_at: string | null;
}

export interface DepartmentPowerReportStatus<TDocument extends PowerReportDocument = PowerReportDocument> {
  ready: boolean;
  missingDepartments: TechnicalPowerDepartment[];
  latestDocsByDepartment: Partial<Record<TechnicalPowerDepartment, TDocument>>;
}

export type DepartmentPowerSummarySource =
  | 'job'
  | 'tour-default'
  | 'tour-override'
  | 'legacy-tour-default';

export interface DepartmentPowerSummaryRow {
  name: string;
  pduLabel: string;
  positionLabel: string;
  totalWatts: number;
  currentPerPhase: number;
  totalVa: number;
  notes: string;
  source: DepartmentPowerSummarySource;
}

export interface DepartmentPowerSummaryData {
  department: TechnicalPowerDepartment;
  rows: DepartmentPowerSummaryRow[];
  safetyMargin: number | null;
  totalWatts: number;
  totalAmps: number;
  totalKva: number;
}

export interface CombinedTechnicalPowerSummaryData {
  departments: Record<TechnicalPowerDepartment, DepartmentPowerSummaryData>;
  totalSystemWatts: number;
  totalSystemAmps: number;
  totalSystemKva: number;
}

export interface TechnicalPowerSummaryAvailability {
  ready: boolean;
  requiredDepartments: TechnicalPowerDepartment[];
  availableDepartments: TechnicalPowerDepartment[];
  missingDepartments: TechnicalPowerDepartment[];
}
