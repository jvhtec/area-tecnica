import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";

import type {
  CreateFoldersOptions,
  DepartmentKey,
  SubfolderKey,
} from "@/utils/flex-folders/types";
import { getSubfolderSelectionSummary } from "@/utils/flex-folders/types";
import type {
  FlexFolderJob,
  FlexFolderLocation,
  PullsheetMetadataEntry,
  PullsheetTemplate,
} from "@/utils/flex-folders/folder-creation/types";

const DEFAULT_FLEX_TIMEZONE = "Europe/Madrid";

export const formatDateForFlex = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return undefined;
    return `${date.toISOString().split(".")[0]}.000Z`;
  } catch {
    return undefined;
  }
};

const formatZonedDateForFlex = (date: Date, timezone: string): string => {
  const zonedDate = toZonedTime(date, timezone);
  return `${format(zonedDate, "yyyy-MM-dd'T'HH:mm:ss")}.000Z`;
};

const parseJobDate = (value: unknown, fieldName: string): Date => {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`Invalid ${fieldName} for dryhire job`);
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} for dryhire job`);
  }

  return date;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
};

const getJobTimezone = (job: Pick<FlexFolderJob, "timezone">): string => {
  const timezone = typeof job.timezone === "string" ? job.timezone.trim() : "";
  return timezone || DEFAULT_FLEX_TIMEZONE;
};

export const getDryhireFlexSchedule = (
  job: Pick<FlexFolderJob, "end_time" | "start_time" | "timezone">
) => {
  const timezone = getJobTimezone(job);
  const startDate = parseJobDate(job.start_time, "start_time");
  const endDate = parseJobDate(job.end_time, "end_time");
  const zonedStartDate = toZonedTime(startDate, timezone);

  return {
    year: Number(format(zonedStartDate, "yyyy")),
    monthKey: format(zonedStartDate, "MM"),
    documentNumber: format(zonedStartDate, "yyMMdd"),
    plannedStartDate: formatZonedDateForFlex(startDate, timezone),
    plannedEndDate: formatZonedDateForFlex(endDate, timezone),
  };
};

const getLocationText = (location: FlexFolderLocation): string => {
  if (typeof location === "string") {
    return location.trim();
  }

  if (location && typeof location === "object") {
    return (location.name || location.formatted_address || "").trim();
  }

  return "";
};

export const resolveTourdateLocationName = (
  job: Pick<FlexFolderJob, "location" | "location_data" | "venue_name">
): string => {
  const locationName = getLocationText(job.location);
  if (locationName) return locationName;

  const locationDataName = getLocationText(job.location_data);
  if (locationDataName) return locationDataName;

  if (typeof job.venue_name === "string") {
    const value = job.venue_name.trim();
    if (value) return value;
  }

  return "No Location";
};

export const getJobDepartments = async (jobId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("job_departments")
    .select("department")
    .eq("job_id", jobId);

  if (error) {
    console.error("Error fetching job departments:", error);
    return [];
  }

  return data
    .map((departmentRow) => departmentRow.department)
    .filter((department): department is string => department != null);
};

type TourJobDepartmentsRow = {
  job_departments?: Array<{ department: string | null }> | null;
};

export const getTourJobDepartments = async (tourId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      job_departments (department)
    `)
    .eq("tour_id", tourId)
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error("Error fetching tour job departments:", error);
    return [];
  }

  const rows = data as TourJobDepartmentsRow[];
  return rows[0].job_departments
    ?.map((jobDepartment) => jobDepartment.department)
    .filter((department): department is string => Boolean(department)) || [];
};

export const upsertCrewCall = async (
  jobId: string,
  dept: "sound" | "lights",
  elementId: string
) => {
  try {
    const { data: existing } = await supabase
      .from("flex_crew_calls")
      .select("id")
      .eq("job_id", jobId)
      .eq("department", dept)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("flex_crew_calls")
        .update({ flex_element_id: elementId })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("flex_crew_calls")
        .insert({ job_id: jobId, department: dept, flex_element_id: elementId });
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.error("Failed to upsert flex_crew_calls:", { jobId, dept, elementId, err });
    throw err;
  }
};

export const shouldCreateDepartmentFolder = (
  department: string,
  selectedDepartments: string[]
): boolean => {
  const alwaysCreateDepartments = ["production", "personnel", "comercial"];
  if (alwaysCreateDepartments.includes(department)) return true;

  const technicalDepartments = ["sound", "lights", "video"];
  if (technicalDepartments.includes(department)) {
    return selectedDepartments.includes(department);
  }

  return false;
};

export const shouldCreateItem = (
  dept: DepartmentKey,
  key: SubfolderKey,
  options?: CreateFoldersOptions
): boolean => {
  if (!options) return true;

  const selection = options[dept];
  if (selection === undefined) return false;

  const { keys, hasExplicitSelection } = getSubfolderSelectionSummary(selection);
  if (!hasExplicitSelection) return true;
  return keys.includes(key);
};

export const buildPullsheetTemplates = (
  defaultEntries: PullsheetTemplate[],
  metadataEntries: PullsheetMetadataEntry[],
  fallbackStartDate: string,
  fallbackEndDate: string,
  fallbackNameForIndex: (index: number, defaultEntry?: PullsheetTemplate) => string
): PullsheetTemplate[] => {
  const templates: PullsheetTemplate[] = [];
  const usedSuffixes = new Set<string>();

  const getUniqueSuffix = (preferred?: string): string => {
    const trimmed = preferred?.trim();
    if (trimmed && !usedSuffixes.has(trimmed)) {
      usedSuffixes.add(trimmed);
      return trimmed;
    }

    let counter = 1;
    while (true) {
      const candidate = `PS${String(counter).padStart(2, "0")}`;
      if (!usedSuffixes.has(candidate)) {
        usedSuffixes.add(candidate);
        return candidate;
      }
      counter += 1;
    }
  };

  const sanitizedMetadata = metadataEntries.filter((entry) =>
    Boolean(entry?.name) || Boolean(entry?.plannedStartDate) || Boolean(entry?.plannedEndDate)
  );

  if (sanitizedMetadata.length > 0) {
    sanitizedMetadata.forEach((entry, index) => {
      const defaultEntry = defaultEntries[index];
      const name = entry.name?.trim?.() || defaultEntry?.name || fallbackNameForIndex(index, defaultEntry);
      const plannedStartDate =
        formatDateForFlex(entry.plannedStartDate) ||
        formatDateForFlex(defaultEntry?.plannedStartDate) ||
        fallbackStartDate;
      const plannedEndDate =
        formatDateForFlex(entry.plannedEndDate) ||
        formatDateForFlex(defaultEntry?.plannedEndDate) ||
        fallbackEndDate;
      const suffix = getUniqueSuffix(defaultEntry?.suffix);

      templates.push({ name, plannedStartDate, plannedEndDate, suffix });
    });

    if (sanitizedMetadata.length < defaultEntries.length) {
      for (let index = sanitizedMetadata.length; index < defaultEntries.length; index += 1) {
        const defaultEntry = defaultEntries[index];
        templates.push({
          name: defaultEntry.name,
          plannedStartDate: defaultEntry.plannedStartDate || fallbackStartDate,
          plannedEndDate: defaultEntry.plannedEndDate || fallbackEndDate,
          suffix: getUniqueSuffix(defaultEntry.suffix),
        });
      }
    }
  } else {
    defaultEntries.forEach((defaultEntry) => {
      templates.push({
        name: defaultEntry.name,
        plannedStartDate: defaultEntry.plannedStartDate || fallbackStartDate,
        plannedEndDate: defaultEntry.plannedEndDate || fallbackEndDate,
        suffix: getUniqueSuffix(defaultEntry.suffix),
      });
    });
  }

  return templates;
};
