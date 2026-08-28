import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
  type EstructuraSourceDepartment,
} from "@/domain/estructura";
import { supabase } from "@/integrations/supabase/client";
import {
  pushEquipmentToFlexDocumentStrict,
  type EquipmentItem,
  type StrictGroupedPushResult,
} from "@/services/flexPullsheets";

export type EstructuraPullSheetTarget = {
  id: string;
  elementId: string;
  sourceDepartment: EstructuraSourceDepartment;
};

export type EstructuraTargetResolution = {
  targets: Partial<Record<EstructuraSourceDepartment, EstructuraPullSheetTarget>>;
  missing: EstructuraSourceDepartment[];
};

export type MotorQuantitySelection = {
  modelId: string;
  modelName: string;
  quantity: number;
};

export type EstructuraPushDestinationResult = {
  status: "success" | "error" | "skipped";
  requestedQuantity: number;
  result?: StrictGroupedPushResult;
  message: string;
};

export type EstructuraMotorPushResult = Record<
  EstructuraSourceDepartment,
  EstructuraPushDestinationResult
>;

export function buildEstructuraMotorEquipment(
  selections: readonly MotorQuantitySelection[],
): EquipmentItem[] {
  return selections
    .filter((selection) => selection.quantity > 0 && Boolean(selection.modelId))
    .map((selection) => ({
      resourceId: selection.modelId,
      quantity: selection.quantity,
      name: selection.modelName,
      flexCategoryKey: "motores_controles",
    }));
}

export async function resolveEstructuraPullSheetTargets(
  jobId: string,
): Promise<EstructuraTargetResolution> {
  const { data, error } = await supabase
    .from("flex_folders")
    .select("id, element_id, source_department")
    .eq("job_id", jobId)
    .eq("department", ESTRUCTURA_DEPARTMENT)
    .eq("folder_type", "pull_sheet")
    .in("source_department", [...ESTRUCTURA_SOURCE_DEPARTMENTS])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron resolver los Pull Sheets de Estructura: ${error.message}`);
  }

  const grouped = new Map<EstructuraSourceDepartment, typeof data>();
  for (const sourceDepartment of ESTRUCTURA_SOURCE_DEPARTMENTS) {
    grouped.set(
      sourceDepartment,
      (data ?? []).filter((row) => row.source_department === sourceDepartment),
    );
  }

  const targets: EstructuraTargetResolution["targets"] = {};
  const missing: EstructuraSourceDepartment[] = [];
  for (const sourceDepartment of ESTRUCTURA_SOURCE_DEPARTMENTS) {
    const rows = grouped.get(sourceDepartment) ?? [];
    if (rows.length === 0) {
      missing.push(sourceDepartment);
      continue;
    }
    if (rows.length > 1) {
      throw new Error(`Hay más de un Pull Sheet de Estructura para ${sourceDepartment}. Reconcilia las carpetas antes de enviar material.`);
    }
    targets[sourceDepartment] = {
      id: rows[0].id,
      elementId: rows[0].element_id,
      sourceDepartment,
    };
  }

  return { targets, missing };
}

const requestedQuantity = (items: readonly EquipmentItem[]) =>
  items.reduce((total, item) => total + item.quantity, 0);

export async function pushEstructuraMotorQuantities(
  jobId: string,
  selections: Record<EstructuraSourceDepartment, readonly MotorQuantitySelection[]>,
): Promise<EstructuraMotorPushResult> {
  const { targets } = await resolveEstructuraPullSheetTargets(jobId);
  const entries = ESTRUCTURA_SOURCE_DEPARTMENTS.map((sourceDepartment) => {
    const items = buildEstructuraMotorEquipment(selections[sourceDepartment]);
    return { sourceDepartment, items, target: targets[sourceDepartment] };
  });

  const settled = await Promise.all(entries.map(async ({ sourceDepartment, items, target }) => {
    const quantity = requestedQuantity(items);
    if (quantity === 0) {
      return [sourceDepartment, {
        status: "skipped",
        requestedQuantity: 0,
        message: "No se solicitaron motores para este destino.",
      }] as const;
    }
    if (!target) {
      return [sourceDepartment, {
        status: "error",
        requestedQuantity: quantity,
        message: "Falta el Pull Sheet de Estructura para este destino.",
      }] as const;
    }

    try {
      const result = await pushEquipmentToFlexDocumentStrict(
        { elementId: target.elementId, documentType: "pullsheet" },
        items,
      );
      const hasFailures = result.groupsFailed.length > 0 ||
        result.childrenSkippedBecauseParentFailed.length > 0 ||
        result.failedChildItems.length > 0;
      return [sourceDepartment, {
        status: hasFailures ? "error" : "success",
        requestedQuantity: quantity,
        result,
        message: hasFailures
          ? `Flex añadió ${result.totalQuantitiesRepresented} de ${quantity} motores; revisa los errores.`
          : `Flex añadió ${quantity} motores al Pull Sheet.`,
      }] as const;
    } catch (error) {
      return [sourceDepartment, {
        status: "error",
        requestedQuantity: quantity,
        message: error instanceof Error ? error.message : "No se pudo añadir material a Flex.",
      }] as const;
    }
  }));

  return Object.fromEntries(settled) as EstructuraMotorPushResult;
}
