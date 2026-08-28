import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
  type EstructuraSourceDepartment,
} from "@/domain/estructura";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import {
  pushEquipmentToFlexDocumentStrict,
  type EquipmentItem,
  type StrictGroupedPushResult,
} from "@/services/flexPullsheets";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import type { FlexFolderJob } from "@/utils/flex-folders/folder-creation/types";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";

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

export async function reconcileEstructuraFoldersForJob(
  jobId: string,
): Promise<EstructuraTargetResolution> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      start_time,
      end_time,
      job_type,
      tour_id,
      tour_date_id,
      timezone,
      location:locations(name, formatted_address)
    `)
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`No se pudo cargar el trabajo para crear Estructura: ${jobError?.message ?? "trabajo no encontrado"}.`);
  }
  if (job.job_type === "dryhire") {
    throw new Error("La preparación de motores de Estructura no está disponible para dry-hire.");
  }

  if (job.job_type === "tourdate") {
    if (!job.tour_id) {
      throw new Error("La fecha de gira no tiene una gira asociada para crear la raíz Estructura.");
    }
    const { error: tourRootError } = await supabase.functions.invoke("create-flex-folders", {
      body: {
        tourId: job.tour_id,
        createRootFolders: true,
        createDateFolders: false,
      },
    });
    if (tourRootError) {
      throw new Error(`No se pudo reconciliar la raíz Estructura de la gira: ${tourRootError.message}`);
    }
  }

  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("El trabajo no tiene fechas válidas para crear las carpetas Estructura.");
  }

  await createAllFoldersForJob(
    job as FlexFolderJob,
    `${startDate.toISOString().split(".")[0]}.000Z`,
    `${endDate.toISOString().split(".")[0]}.000Z`,
    formatInTimeZone(startDate, MADRID_TIMEZONE, "yyMMdd"),
    {},
  );

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ flex_folders_created: true })
    .eq("id", jobId);
  if (updateError) {
    throw new Error(`Se creó Estructura en Flex, pero no se pudo actualizar el trabajo: ${updateError.message}`);
  }

  const resolution = await resolveEstructuraPullSheetTargets(jobId);
  if (resolution.missing.length > 0) {
    throw new Error(`Siguen faltando los Pull Sheets de Estructura de ${resolution.missing.join(" y ")}.`);
  }
  return resolution;
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
