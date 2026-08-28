import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { DEPARTMENT_SUFFIXES } from "@/utils/flex-folders/constants";
import { FlexElementNode } from "@/utils/flex-folders/getElementTree";

const DEFAULT_TIMEZONE = "Europe/Madrid";

export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface FlexFolderSyncRow {
  element_id: string;
  department: string | null;
  folder_type: string | null;
  parent_id?: string | null;
}

export interface FlexCrewCallSyncRow {
  flex_element_id: string;
  department: string;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function formatDateForFlex(
  date: Date,
  timezone = DEFAULT_TIMEZONE
): string {
  const zonedDate = toZonedTime(date, timezone);
  return `${format(zonedDate, "yyyy-MM-dd'T'HH:mm:ss")}.000Z`;
}

export function generateBaseDocumentNumber(
  date: Date,
  timezone = DEFAULT_TIMEZONE
): string {
  return format(toZonedTime(date, timezone), "yyMMdd");
}

export function formatDateForDisplay(
  date: Date,
  timezone = DEFAULT_TIMEZONE
): string {
  return format(toZonedTime(date, timezone), "MMM d, yyyy");
}

export function getEffectiveTimezone(timezone: unknown): string {
  return typeof timezone === "string" && timezone.trim()
    ? timezone.trim()
    : DEFAULT_TIMEZONE;
}

export function haveJobDatesChanged(
  previousStartTime: string | null | undefined,
  previousEndTime: string | null | undefined,
  nextStartTime: string,
  nextEndTime: string
): boolean {
  const previousStart = previousStartTime
    ? new Date(previousStartTime).getTime()
    : Number.NaN;
  const previousEnd = previousEndTime
    ? new Date(previousEndTime).getTime()
    : Number.NaN;
  const nextStart = new Date(nextStartTime).getTime();
  const nextEnd = new Date(nextEndTime).getTime();

  if ([previousStart, previousEnd, nextStart, nextEnd].some(Number.isNaN)) {
    return previousStartTime !== nextStartTime || previousEndTime !== nextEndTime;
  }

  return previousStart !== nextStart || previousEnd !== nextEnd;
}

export function extractDocumentNumberSuffix(docNumber: string): string {
  return docNumber && docNumber.length > 6 ? docNumber.slice(6) : "";
}

export function collectAllElements(
  nodes: FlexElementNode[]
): Array<{ elementId: string; documentNumber?: string; displayName?: string }> {
  const result: Array<{
    elementId: string;
    documentNumber?: string;
    displayName?: string;
  }> = [];

  for (const node of nodes) {
    if (node.elementId) {
      result.push({
        elementId: node.elementId,
        documentNumber: node.documentNumber,
        displayName: node.displayName,
      });
    }

    if (node.children?.length) {
      result.push(...collectAllElements(node.children));
    }
  }

  return result;
}

function findElementInTree(
  nodes: FlexElementNode[],
  elementId: string
): { elementId: string; documentNumber?: string; displayName?: string } | null {
  for (const node of nodes) {
    if (node.elementId === elementId) {
      return {
        elementId: node.elementId,
        documentNumber: node.documentNumber,
        displayName: node.displayName,
      };
    }

    if (node.children?.length) {
      const match = findElementInTree(node.children, elementId);
      if (match) return match;
    }
  }

  return null;
}

export function getRecordedElementFromTree(
  tree: FlexElementNode[],
  elementId: string
): { elementId: string; documentNumber?: string; displayName?: string } {
  return (
    findElementInTree(tree, elementId) ?? {
      elementId,
      displayName: "",
      documentNumber: undefined,
    }
  );
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateFolderName(
  folderType: string,
  department: string,
  jobTitle: string,
  locationName: string,
  displayDate: string,
  displayName = "",
  previousTitle?: string
): string | null {
  const deptLabel = capitalize(department);

  switch (folderType) {
    case "tourdate":
      return `${locationName} - ${displayDate} - ${deptLabel}`;
    case "department":
      return `${jobTitle} - ${deptLabel}`;
    case "main":
    case "main_event":
      return jobTitle;
    case "doc_tecnica":
    case "documentacion_tecnica":
      return `${jobTitle} - Documentación Técnica - ${deptLabel}`;
    case "presupuestos_recibidos":
      return `${jobTitle} - Presupuestos Recibidos - ${deptLabel}`;
    case "hoja_gastos":
      return department === "personnel"
        ? `Gastos de Personal - ${jobTitle}`
        : `${jobTitle} - Hoja de Gastos - ${deptLabel}`;
    case "work_orders":
      return `Orden de Trabajo - ${jobTitle}`;
    case "hoja_info_sx":
    case "hoja_info_lx":
    case "hoja_info_vx":
      return `Hoja de Información - ${jobTitle}`;
    default:
      return previousTitle && displayName.includes(previousTitle)
        ? displayName.replace(previousTitle, jobTitle)
        : null;
  }
}

function getDepartmentSuffix(department: string | null): string | null {
  if (!department || !(department in DEPARTMENT_SUFFIXES)) return null;
  return DEPARTMENT_SUFFIXES[department as keyof typeof DEPARTMENT_SUFFIXES];
}

export function getKnownDocumentSuffix(
  folder: FlexFolderSyncRow
): string | null {
  const departmentSuffix = getDepartmentSuffix(folder.department);

  switch (folder.folder_type) {
    case "main":
    case "main_event":
      return "";
    case "department":
    case "tourdate":
    case "tour_date":
      return departmentSuffix;
    case "doc_tecnica":
    case "documentacion_tecnica":
      return departmentSuffix === null ? null : `${departmentSuffix}DT`;
    case "presupuestos_recibidos":
      return departmentSuffix === null ? null : `${departmentSuffix}PR`;
    case "hoja_gastos":
      if (folder.department === "personnel") return "HRGP";
      return departmentSuffix === null ? null : `${departmentSuffix}HG`;
    case "work_orders":
      return folder.department === "personnel" ? "HROT" : null;
    case "hoja_info_sx":
      return "SIP";
    case "hoja_info_lx":
      return "LIP";
    case "hoja_info_vx":
      return "VIP";
    default:
      return null;
  }
}

export function getCrewCallDocumentSuffix(department: string): string | null {
  if (department === "sound") return "HRCCS";
  if (department === "lights") return "HRCCL";
  return null;
}

export function getCrewCallName(
  department: string,
  jobTitle: string
): string | null {
  if (department === "sound") return `Crew Call Sonido - ${jobTitle}`;
  if (department === "lights") return `Crew Call Luces - ${jobTitle}`;
  return null;
}

export function mergeSyncResults(...results: SyncResult[]): SyncResult {
  return results.reduce<SyncResult>(
    (merged, result) => ({
      success: merged.success + result.success,
      failed: merged.failed + result.failed,
      errors: [...merged.errors, ...result.errors],
    }),
    { success: 0, failed: 0, errors: [] }
  );
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    })
  );
}
