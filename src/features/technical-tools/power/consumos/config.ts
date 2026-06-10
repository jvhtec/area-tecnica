import type {
  PowerComponent,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";
import type { PowerTableControlLabels } from "@/features/technical-tools/power/PowerTableControls";

export type FixtureType =
  | "incandescent"
  | "discharge"
  | "led"
  | "led-pro"
  | "smoke"
  | "consoles";

export const FIXTURE_PF: Record<FixtureType, { label: string; pf: number }> = {
  incandescent: { label: "Incandescent / filament", pf: 1.0 },
  discharge: { label: "Discharge (generic)", pf: 0.9 },
  led: { label: "LED (generic)", pf: 0.9 },
  smoke: { label: "Smoke/Hazer (generic)", pf: 0.95 },
  consoles: { label: "Consoles (generic)", pf: 1 },
  "led-pro": { label: "LED (pro / specified)", pf: 0.95 },
};

export const DEFAULT_FIXTURE_TYPE: FixtureType = "led";

export type ConsumosComponent = PowerComponent & {
  fixtureType?: FixtureType;
};

export type ConsumosLabels = {
  title: string;
  tourDefaultsBadge: string;
  tourDefaultsNoticeTitle: string;
  tourDefaultsNoticeBody: string;
  creatingDefaultsFor: string;
  overrideBadge: string;
  overrideNoticeTitle: string;
  overrideNoticeBody: string;
  existingDefaultsHeading: string;
  readOnlyDefaultsHeading: string;
  existingOverridesHeading: string;
  defaultBadge: string;
  savedBadge: string;
  overrideTableBadge: string;
  edit: string;
  deleteAction: string;
  fohSchuko: string;
  supply: string;
  supplyPlaceholder: string;
  singlePhase: string;
  threePhase: string;
  voltage: string;
  voltageHint: string;
  powerFactor: string;
  powerFactorHint: string;
  safetyMargin: string;
  safetyMarginPlaceholder: string;
  selectJob: string;
  selectJobPlaceholder: string;
  stage: string;
  tableName: string;
  defaultName: string;
  tableNamePlaceholder: string;
  defaultNamePlaceholder: string;
  editingTableSuffix: string;
  editingOverrideSuffix: string;
  position: string;
  noPosition: string;
  customOption: string;
  customPosition: string;
  customPositionPlaceholder: string;
  colQuantity: string;
  colLineName: string;
  lineNamePlaceholder: string;
  colComponent: string;
  componentPlaceholder: string;
  addComponent: string;
  customComponentTitle: string;
  componentName: string;
  componentNamePlaceholder: string;
  componentWatts: string;
  componentType: string;
  saveComponent: string;
  cancel: string;
  colWatts: string;
  colPf: string;
  colTotalWatts: string;
  deleteRowAria: string;
  toastComponentSaved: string;
  toastComponentSaveError: string;
  addRow: string;
  generateTable: string;
  updateTable: string;
  createOverride: string;
  updateOverride: string;
  reset: string;
  cancelEdit: string;
  saveDefaultTables: string;
  saveDefault: string;
  exportPdf: string;
  exportUploadPdf: string;
  removeTable: string;
  totalWattsLabel: string;
  adjustedWattsLabel: (margin: number) => string;
  apparentPower: string;
  currentPerPhase: string;
  current: string;
  pduTypeLabel: string;
  positionLabel: string;
  hoistNote: string;
  notAvailable: string;
  savedSetLoaded: (count: number) => string;
  stagePlotTitle: string;
  stagePlotStage: string;
  stagePlotAudience: string;
  stagePlotUnpositioned: string;
  stagePlotFohSchuko: string;
  stagePlotHoist: string;
  stagePlotDragHint: string;
  pfInfoTitle: string;
  pfInfoFootnote: string;
  loadingOverrideData: string;
  toastSuccess: string;
  toastError: string;
  toastMissingNameTitle: string;
  toastMissingNameBody: string;
  toastNoJobTitle: string;
  toastNoJobBody: string;
  toastNoTourDataTitle: string;
  toastNoTourDataBody: string;
  toastPdfGenerated: string;
  toastPdfUploaded: string;
  toastPdfAutoCompleted: (count: number) => string;
  toastPdfError: string;
  toastDefaultSaved: string;
  toastDefaultSaveError: (message: string) => string;
  toastNoUnsavedDefaultsTitle: string;
  toastNoUnsavedDefaultsBody: string;
  toastDefaultsSaved: (count: number) => string;
  toastDefaultsPartial: (saved: number, failedNames: string[]) => string;
  toastDefaultsFailed: (failedNames: string[]) => string;
  toastOverrideSaved: string;
  toastOverrideSaveError: string;
  toastOverrideUpdated: string;
  toastOverrideDeleted: string;
  toastOverrideDeleteError: string;
  toastTableNotFound: string;
  controls: PowerTableControlLabels;
};

export type ConsumosDepartmentConfig = {
  department: TechnicalDepartment;
  backPath: string;
  components: ConsumosComponent[];
  defaultSafetyMargin: number;
  /** Global power factor default. When undefined the tool works in per-row PF mode (lights). */
  defaultPowerFactor?: number;
  features: {
    fohSchuko: boolean;
    perRowPf: boolean;
    lineName: boolean;
    /** Show legacy tour_power_defaults as fallback when the new defaults system is empty. */
    legacyTourDefaultsFallback: boolean;
  };
  pdfFileName: (title: string) => string;
  defaultsPdfFileName: (tourName: string) => string;
  defaultsReportTitle: (tourName: string) => string;
  defaultsSetName: (tourName: string) => string;
  defaultsSetDescription: string;
  labels: ConsumosLabels;
};
