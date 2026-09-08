import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { DEPARTMENT_IDS, DEPARTMENT_SUFFIXES, FLEX_FOLDER_IDS, RESPONSIBLE_PERSON_IDS } from "../../../../src/utils/flex-folders/constants.ts";
import type { ProvisioningNode, ProvisioningStore } from "./engine.ts";

const DEPARTMENTS = ["sound", "lights", "video", "production", "personnel", "comercial"] as const;
type Department = typeof DEPARTMENTS[number];

type MetadataEntry = { name?: string; plannedStartDate?: string; plannedEndDate?: string };
type Selection = Record<string, {
  subfolders?: string[];
  customPullsheet?: { entries?: MetadataEntry[] };
  extrasPresupuesto?: { entries?: MetadataEntry[] };
} | undefined>;

const allowed = (options: Selection | undefined, department: string, key: string) => {
  if (!options) return true;
  const selection = options[department];
  if (!selection) return false;
  return Array.isArray(selection.subfolders) ? selection.subfolders.includes(key) : true;
};

const basePayload = (start: string, end: string) => ({
  open: true, locked: false, plannedStartDate: start, plannedEndDate: end,
  locationId: FLEX_FOLDER_IDS.location,
});

export const buildJobPlan = (context: {
  job: Record<string, unknown>; selected: Set<string>; options?: Selection;
  start: string; end: string; documentNumber: string; tour?: Record<string, unknown>;
}): ProvisioningNode[] => {
  const { job, selected, options, start, end, documentNumber, tour } = context;
  const title = String(job.title || "Sin título").trim() || "Sin título";
  const isTourDate = job.job_type === "tourdate";
  const nodes: ProvisioningNode[] = [];
  const base = basePayload(start, end);
  if (!isTourDate) nodes.push({ key: "root", payload: {
    ...base, definitionId: FLEX_FOLDER_IDS.mainFolder, name: title, documentNumber,
    personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
  }, tracking: { folderType: "main_event" } });

  const estructuraParent = isTourDate ? String(tour?.flex_estructura_folder_id || "") : undefined;
  nodes.push({ key: "department:estructura", ...(isTourDate ? { externalParentElementId: estructuraParent } : { parentKey: "root" }), payload: {
    ...base, definitionId: FLEX_FOLDER_IDS.subFolder, name: `${title} - Estructura`,
    departmentId: DEPARTMENT_IDS.estructura, documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES.estructura}`,
    personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
  }, tracking: { folderType: isTourDate ? "tourdate" : "department", department: "estructura", sourceDepartment: null } });
  for (const source of ["sound", "lights"] as const) nodes.push({
    key: `estructura:source:${source}`, parentKey: "department:estructura", payload: {
      ...base, definitionId: FLEX_FOLDER_IDS.pullSheet, name: `${title} - ${source === "sound" ? "Sonido" : "Luces"}`,
      departmentId: DEPARTMENT_IDS.estructura, documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES.estructura}${DEPARTMENT_SUFFIXES[source]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[source],
    }, tracking: { folderType: "pull_sheet", department: "estructura", sourceDepartment: source },
  });

  for (const department of DEPARTMENTS) {
    if (["sound", "lights", "video"].includes(department) && !selected.has(department)) continue;
    const suffix = DEPARTMENT_SUFFIXES[department];
    const label = department.charAt(0).toUpperCase() + department.slice(1);
    const externalParentElementId = isTourDate ? String(tour?.[`flex_${department}_folder_id`] || "") : undefined;
    nodes.push({ key: `department:${department}`, ...(isTourDate ? { externalParentElementId } : { parentKey: "root" }), payload: {
      ...base, definitionId: FLEX_FOLDER_IDS.subFolder, name: `${title} - ${label}`,
      departmentId: DEPARTMENT_IDS[department], documentNumber: `${documentNumber}${suffix}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
    }, tracking: { folderType: isTourDate ? "tourdate" : "department", department } });

    if (["sound", "lights", "video", "production"].includes(department)) {
      const children = [
        ["documentacionTecnica", FLEX_FOLDER_IDS.documentacionTecnica, "Documentación Técnica", "DT", "doc_tecnica"],
        ["presupuestosRecibidos", FLEX_FOLDER_IDS.presupuestosRecibidos, "Presupuestos Recibidos", "PR", "presupuestos_recibidos"],
        ["hojaGastos", FLEX_FOLDER_IDS.hojaGastos, "Hoja de Gastos", "HG", "hoja_gastos"],
      ] as const;
      for (const [key, definitionId, name, childSuffix, folderType] of children) if (allowed(options, department, key)) nodes.push({
        key: `department:${department}:${key}`, parentKey: `department:${department}`, payload: {
          ...base, definitionId, name: `${title} - ${name} - ${label}`, departmentId: DEPARTMENT_IDS[department],
          documentNumber: `${documentNumber}${suffix}${childSuffix}`, personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
        }, tracking: { folderType, department },
      });
      const pulls = department === "sound" ? [["pullSheetTP", "Tour Pack", "TP"], ["pullSheetPA", "PA", "PA"]] as const : [];
      for (const [key, name, childSuffix] of pulls) if (allowed(options, department, key)) nodes.push({
        key: `department:${department}:${key}`, parentKey: `department:${department}`, payload: {
          ...base, definitionId: FLEX_FOLDER_IDS.pullSheet, name: `${title} - ${name}`, departmentId: DEPARTMENT_IDS[department],
          documentNumber: `${documentNumber}${suffix}${childSuffix}`, personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
        }, tracking: { folderType: "pull_sheet", department },
      });
      for (const [index, custom] of (options?.[department]?.customPullsheet?.entries || []).entries()) nodes.push({
        key: `department:${department}:custom-pullsheet:${index}`, parentKey: `department:${department}`, payload: {
          ...base, definitionId: FLEX_FOLDER_IDS.pullSheet, name: custom.name?.trim() || `${title} - ${label} Pullsheet ${index + 1}`,
          plannedStartDate: custom.plannedStartDate || start, plannedEndDate: custom.plannedEndDate || end,
          departmentId: DEPARTMENT_IDS[department], documentNumber: `${documentNumber}${suffix}PS${index + 1}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
        }, tracking: { folderType: "pull_sheet", department },
      });
    }
    if (department === "personnel") {
      const personnel = [["workOrder", FLEX_FOLDER_IDS.ordenTrabajo, "Orden de Trabajo", "OT", "work_orders"], ["gastosDePersonal", FLEX_FOLDER_IDS.hojaGastos, "Gastos de Personal", "GP", "hoja_gastos"], ["crewCallSound", FLEX_FOLDER_IDS.crewCall, "Crew Call Sonido", "CCS", "crew_call", "sound"], ["crewCallLights", FLEX_FOLDER_IDS.crewCall, "Crew Call Luces", "CCL", "crew_call", "lights"]] as const;
      for (const [key, definitionId, name, childSuffix, folderType, crewDepartment] of personnel) if (allowed(options, department, key)) nodes.push({
        key: `department:personnel:${key}`, parentKey: "department:personnel", payload: { ...base, definitionId, name: `${name} - ${title}`, departmentId: DEPARTMENT_IDS.personnel, documentNumber: `${documentNumber}${suffix}${childSuffix}`, personResponsibleId: RESPONSIBLE_PERSON_IDS.personnel },
        tracking: { folderType, department: "personnel", crewDepartment },
      });
    }
    if (department === "comercial") for (const target of ["sound", "lights"] as const) if (allowed(options, department, `extras${target === "sound" ? "Sound" : "Lights"}`)) {
      const extrasKey = `department:comercial:extras:${target}`;
      nodes.push({ key: extrasKey, parentKey: "department:comercial", payload: { ...base, definitionId: FLEX_FOLDER_IDS.subFolder, name: `${title} - Extras - ${target}`, departmentId: DEPARTMENT_IDS[target], documentNumber: `${documentNumber}QT${DEPARTMENT_SUFFIXES[target]}EX`, personResponsibleId: RESPONSIBLE_PERSON_IDS[target] }, tracking: { folderType: "comercial_extras", department: target } });
      if (allowed(options, department, `presupuesto${target === "sound" ? "Sound" : "Lights"}`)) nodes.push({ key: `${extrasKey}:budget`, parentKey: extrasKey, payload: { ...base, definitionId: FLEX_FOLDER_IDS.presupuesto, name: `${title} - Presupuesto - ${target}`, departmentId: DEPARTMENT_IDS[target], documentNumber: `${documentNumber}QT${DEPARTMENT_SUFFIXES[target]}PR`, personResponsibleId: RESPONSIBLE_PERSON_IDS[target] }, tracking: { folderType: "comercial_presupuesto", department: target } });
    }
  }
  return nodes;
};

export const makeJobStore = (supabase: SupabaseClient, operationId: string, job: Record<string, unknown>): ProvisioningStore => ({
  load: async () => { const { data, error } = await supabase.from("flex_provisioning_nodes").select("semantic_key,state,element_id").eq("operation_id", operationId); if (error) throw error; return (data || []).map((row) => ({ key: row.semantic_key, state: row.state, elementId: row.element_id || undefined })); },
  markCreating: async (node) => { const { error } = await supabase.from("flex_provisioning_nodes").upsert({ operation_id: operationId, semantic_key: node.key, parent_key: node.parentKey, state: "creating", payload: node.payload }, { onConflict: "operation_id,semantic_key" }); if (error) throw error; },
  markRemoteElement: async (node, elementId) => { const { error } = await supabase.from("flex_provisioning_nodes").update({ state: "needs_reconciliation", element_id: elementId }).eq("operation_id", operationId).eq("semantic_key", node.key); if (error) throw error; },
  persistTracking: async (node, elementId, parentTrackingId) => {
    const tracking = node.tracking as { folderType: string; department?: string; sourceDepartment?: string; crewDepartment?: string; externalParentTrackingId?: string };
    const { data: existing, error: existingError } = await supabase.from("flex_folders").select("id").eq("element_id", elementId).maybeSingle(); if (existingError) throw existingError;
    let id = existing?.id;
    if (!id) { const { data, error } = await supabase.from("flex_folders").insert({ job_id: job.id, tour_date_id: job.tour_date_id || null, parent_id: parentTrackingId || tracking.externalParentTrackingId || null, element_id: elementId, department: tracking.department || null, source_department: tracking.sourceDepartment || null, folder_type: tracking.folderType }).select("id").single(); if (error) throw error; id = data.id; }
    if (tracking.crewDepartment) { const { error } = await supabase.from("flex_crew_calls").upsert({ job_id: job.id, department: tracking.crewDepartment, flex_element_id: elementId }, { onConflict: "job_id,department" }); if (error) throw error; }
    return id;
  },
  markPersisted: async (node, elementId, trackingRowId) => { const { error } = await supabase.from("flex_provisioning_nodes").update({ state: "persisted", element_id: elementId, tracking_row_id: trackingRowId || null, safe_error: null }).eq("operation_id", operationId).eq("semantic_key", node.key); if (error) throw error; },
  markNeedsReconciliation: async (node, safeError) => { const { error } = await supabase.from("flex_provisioning_nodes").update({ state: "needs_reconciliation", safe_error: safeError }).eq("operation_id", operationId).eq("semantic_key", node.key); if (error) throw error; },
});
