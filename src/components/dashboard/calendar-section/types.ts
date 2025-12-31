export type CalendarExportRange = "month" | "quarter" | "year";

export interface PrintSettings {
  range: CalendarExportRange;
  jobTypes: {
    tourdate: boolean;
    tour: boolean;
    single: boolean;
    dryhire: boolean;
    festival: boolean;
  };
}

