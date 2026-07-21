import { getDepartmentLabel } from "@/types/department";
import { FLEX_FOLDER_IDS } from "@/utils/flex-folders/constants";
import type { FlexElementNode } from "@/utils/flex-folders/getElementTree";

export type FlexReportDepartment = "sound" | "lights" | "video" | "production";

export type FlexReportFolderReference = {
  department?: string | null;
  element_id?: string | null;
  elementId?: string | null;
  folder_type?: string | null;
  name?: string | null;
};

export type FlexPresupuestoOption = {
  department: FlexReportDepartment | null;
  displayName: string;
  documentNumber?: string;
  elementId: string;
};

const REPORT_DEPARTMENTS = new Set<FlexReportDepartment>([
  "sound",
  "lights",
  "video",
  "production",
]);

const PRESUPUESTO_DEFINITION_IDS = new Set([
  FLEX_FOLDER_IDS.presupuesto,
  FLEX_FOLDER_IDS.presupuestoDryHire,
]);

const TRACKED_PRESUPUESTO_FOLDER_TYPES = new Set([
  "comercial_presupuesto",
  "dryhire_presupuesto",
]);

const REPORT_ROOT_FOLDER_TYPES = ["main_event", "main", "dryhire", "tourdate"];

const getFolderElementId = (folder: FlexReportFolderReference): string | null => {
  const value = folder.element_id || folder.elementId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const normalizeDepartment = (value: string | null | undefined): FlexReportDepartment | null => {
  const normalized = value?.trim().toLowerCase() as FlexReportDepartment | undefined;
  return normalized && REPORT_DEPARTMENTS.has(normalized) ? normalized : null;
};

const inferDepartmentFromName = (value: string): FlexReportDepartment | null => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(sonido|sound)\b/.test(normalized)) return "sound";
  if (/\b(iluminacion|luces|lights?)\b/.test(normalized)) return "lights";
  if (/\bvideo\b/.test(normalized)) return "video";
  if (/\b(produccion|production)\b/.test(normalized)) return "production";
  return null;
};

const getTrackedPresupuestoOptions = (
  folders: FlexReportFolderReference[],
): FlexPresupuestoOption[] => folders.flatMap((folder) => {
  const elementId = getFolderElementId(folder);
  if (
    !elementId ||
    !TRACKED_PRESUPUESTO_FOLDER_TYPES.has(folder.folder_type || "")
  ) {
    return [];
  }

  return [{
    department: normalizeDepartment(folder.department),
    displayName: folder.name?.trim() || "Presupuesto",
    elementId,
  }];
});

/**
 * Finds every real Presupuesto element in the Flex tree. Department ownership
 * is inherited from tracked ancestor folders, with department-folder names as
 * a fallback for older Flex structures that were not fully mirrored locally.
 */
export const getFlexPresupuestoOptions = (
  tree: FlexElementNode[] | undefined,
  folders: FlexReportFolderReference[] | null | undefined,
): FlexPresupuestoOption[] => {
  const folderList = folders || [];
  const trackedDepartmentByElementId = new Map<string, FlexReportDepartment>();

  for (const folder of folderList) {
    const elementId = getFolderElementId(folder);
    const department = normalizeDepartment(folder.department);
    if (elementId && department) trackedDepartmentByElementId.set(elementId, department);
  }

  const optionsByElementId = new Map<string, FlexPresupuestoOption>();

  const visit = (nodes: FlexElementNode[], inheritedDepartment: FlexReportDepartment | null) => {
    for (const node of nodes) {
      const trackedDepartment = trackedDepartmentByElementId.get(node.elementId) || null;
      const namedDepartment = node.definitionId === FLEX_FOLDER_IDS.subFolder
        ? inferDepartmentFromName(node.displayName)
        : null;
      // A production-owned job root may contain untracked department folders in
      // older jobs. Let those top-level names refine production, but do not let a
      // nested name such as "Video wall" override an already-known Sound owner.
      const department = trackedDepartment || (
        inheritedDepartment === "production"
          ? namedDepartment || inheritedDepartment
          : inheritedDepartment || namedDepartment
      );

      if (
        node.elementId &&
        node.definitionId &&
        PRESUPUESTO_DEFINITION_IDS.has(node.definitionId)
      ) {
        optionsByElementId.set(node.elementId, {
          department,
          displayName: node.displayName?.trim() || "Presupuesto",
          documentNumber: node.documentNumber?.trim() || undefined,
          elementId: node.elementId,
        });
      }

      if (node.children?.length) visit(node.children, department);
    }
  };

  if (tree?.length) visit(tree, null);

  for (const option of getTrackedPresupuestoOptions(folderList)) {
    if (!optionsByElementId.has(option.elementId)) {
      optionsByElementId.set(option.elementId, option);
    }
  }

  return Array.from(optionsByElementId.values());
};

export const getFlexReportRootElementId = (
  folders: FlexReportFolderReference[] | null | undefined,
): string | null => {
  const folderList = folders || [];
  for (const folderType of REPORT_ROOT_FOLDER_TYPES) {
    const root = folderList.find((folder) => folder.folder_type === folderType);
    const elementId = root ? getFolderElementId(root) : null;
    if (elementId) return elementId;
  }
  return null;
};

export const getFlexPresupuestoOptionLabel = (option: FlexPresupuestoOption): string => {
  const departmentLabel = getDepartmentLabel(option.department);
  const detail = option.documentNumber || option.elementId.slice(0, 8);
  return `${departmentLabel} · ${option.displayName} · ${detail}`;
};
