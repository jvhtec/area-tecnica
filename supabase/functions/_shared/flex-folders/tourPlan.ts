import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../../../../src/utils/flex-folders/constants.ts";
import { HttpError } from "../http.ts";
import type { ProvisioningNode } from "./engine.ts";

export const TECHNICAL_DEPARTMENTS = ["sound", "lights", "video"] as const;
export const ROOT_DEPARTMENTS = ["sound", "lights", "video", "production", "personnel", "comercial"] as const;
type RootDepartment = typeof ROOT_DEPARTMENTS[number];

export interface StoredTourSemanticNode {
  semantic_key: string;
  payload: unknown;
}

export interface TourRecord {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  flex_folders_created: boolean | null;
  flex_main_folder_id: string | null;
  flex_sound_folder_id: string | null;
  flex_lights_folder_id: string | null;
  flex_video_folder_id: string | null;
  flex_production_folder_id: string | null;
  flex_personnel_folder_id: string | null;
  flex_comercial_folder_id: string | null;
  flex_estructura_folder_id: string | null;
}

export const flexDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid tour date");
  return `${date.toISOString().split(".")[0]}.000Z`;
};

export const documentNumberFor = (value: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
};

/** Excludes department roots that durable state adopted from legacy tour UUID columns. */
export const plannerOwnedTourSemanticKeys = (
  nodes: StoredTourSemanticNode[],
): Set<string> => new Set(nodes
  .filter((node) => {
    if (!node.payload || typeof node.payload !== "object" || Array.isArray(node.payload)) return true;
    return (node.payload as Record<string, unknown>).provisioningOrigin !== "legacy-tour-column";
  })
  .map((node) => node.semantic_key));

/** Chooses departments whose canonical children are safe to plan. */
export const childDepartmentsForTour = (
  tour: TourRecord,
  selected: ReadonlySet<string>,
  plannerOwnedSemanticKeys: ReadonlySet<string>,
): Set<RootDepartment> => new Set(ROOT_DEPARTMENTS.filter((department) => {
  if (TECHNICAL_DEPARTMENTS.includes(department as typeof TECHNICAL_DEPARTMENTS[number]) && !selected.has(department)) {
    return false;
  }
  const rootElementId = tour[`flex_${department}_folder_id`];
  return !rootElementId || plannerOwnedSemanticKeys.has(`department:${department}`);
}));

export const buildRootPlan = (
  tour: TourRecord,
  selected: ReadonlySet<string>,
  range: { start: string; end: string },
  childDepartments: ReadonlySet<string>,
): ProvisioningNode[] => {
  const plannedStartDate = flexDate(range.start);
  const plannedEndDate = flexDate(range.end);
  const documentNumber = documentNumberFor(range.start);
  const base = { open: true, locked: false, plannedStartDate, plannedEndDate, locationId: FLEX_FOLDER_IDS.location };
  const nodes: ProvisioningNode[] = [{
    key: "root",
    payload: {
      ...base,
      definitionId: FLEX_FOLDER_IDS.mainFolder,
      name: tour.name,
      documentNumber,
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
      notes: "Provisioned by Sector Pro",
    },
    tracking: { folderType: "tour_root", tourColumn: "flex_main_folder_id" },
  }];

  for (const department of ROOT_DEPARTMENTS) {
    if (TECHNICAL_DEPARTMENTS.includes(department as typeof TECHNICAL_DEPARTMENTS[number]) && !selected.has(department)) continue;
    const label = department.charAt(0).toUpperCase() + department.slice(1);
    nodes.push({
      key: `department:${department}`,
      parentKey: "root",
      payload: {
        ...base,
        definitionId: FLEX_FOLDER_IDS.subFolder,
        name: `${tour.name} - ${label}`,
        departmentId: DEPARTMENT_IDS[department],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[department]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
      },
      tracking: { folderType: "tour_department", department, tourColumn: `flex_${department}_folder_id` },
    });

    if (!childDepartments.has(department) || ![...TECHNICAL_DEPARTMENTS, "production"].includes(department)) continue;
    for (const child of [
      { key: "technical-documentation", definitionId: FLEX_FOLDER_IDS.documentacionTecnica, name: "Documentación Técnica", suffix: "DT", folderType: "doc_tecnica" },
      { key: "received-budgets", definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos, name: "Presupuestos Recibidos", suffix: "PR", folderType: "presupuestos_recibidos" },
      { key: "expenses", definitionId: FLEX_FOLDER_IDS.hojaGastos, name: "Hoja de Gastos", suffix: "HG", folderType: "hoja_gastos" },
    ]) {
      nodes.push({
        key: `department:${department}:${child.key}`,
        parentKey: `department:${department}`,
        payload: {
          ...base,
          definitionId: child.definitionId,
          name: `${tour.name} - ${child.name} - ${label}`,
          departmentId: DEPARTMENT_IDS[department],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[department]}${child.suffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
        },
        tracking: { folderType: child.folderType, department },
      });
    }
  }

  nodes.push({
    key: "department:estructura",
    parentKey: "root",
    payload: {
      ...base,
      definitionId: FLEX_FOLDER_IDS.subFolder,
      name: `${tour.name} - Estructura`,
      departmentId: DEPARTMENT_IDS.estructura,
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES.estructura}`,
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    },
    tracking: { folderType: "tour_department", department: "estructura", tourColumn: "flex_estructura_folder_id" },
  });
  return nodes;
};
