import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  HojaAggregate,
  HojaStatus,
  HojaStatusTransitionResult,
} from "@/features/hoja-de-ruta/model/HojaDocument";

export const hojaDocumentQueryKey = (jobId: string) =>
  ["hoja-de-ruta", jobId] as const;

const HOJA_STATUSES: readonly HojaStatus[] = ["draft", "review", "approved", "final"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isRecordArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isRecord);

/** Runtime shape check for the `get_hoja_de_ruta` projection. */
export const isHojaAggregate = (value: unknown): value is HojaAggregate => {
  if (!isRecord(value) || !isRecord(value.main)) return false;
  if (value.logistics !== undefined && !isRecord(value.logistics)) return false;
  return (
    ["contacts", "staff", "transport", "travelArrangements", "accommodations", "images"] as const
  ).every((key) => value[key] === undefined || isRecordArray(value[key]));
};

export const toHojaStatus = (value: unknown): HojaStatus =>
  HOJA_STATUSES.find((status) => status === value) ?? "draft";

export async function getHojaAggregate(jobId: string): Promise<HojaAggregate | null> {
  const { data, error } = await supabase.rpc("get_hoja_de_ruta", {
    p_job_id: jobId,
  });
  if (error) throw error;
  if (data === null) return null;
  if (!isHojaAggregate(data)) {
    throw new Error("La Hoja de Ruta recibida no tiene el formato esperado");
  }
  return data;
}

export async function saveHojaAggregate(args: {
  jobId: string;
  expectedVersion: number;
  payload: Json;
  removedImageIds: string[];
}): Promise<{ id: string; document_version: number }> {
  const { data, error } = await supabase.rpc("save_hoja_de_ruta", {
    p_job_id: args.jobId,
    p_expected_version: args.expectedVersion,
    p_payload: args.payload,
    p_removed_image_ids: args.removedImageIds,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row?.id) throw new Error("El servidor no devolvió la Hoja de Ruta guardada");
  return { id: row.id, document_version: Number(row.document_version || 0) };
}

export async function setHojaStatus(
  jobId: string,
  status: HojaStatus,
  expectedVersion: number,
): Promise<HojaStatusTransitionResult> {
  const { data, error } = await supabase.rpc("set_hoja_de_ruta_status", {
    p_expected_version: expectedVersion,
    p_job_id: jobId,
    p_status: status,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error("El servidor no devolvió el nuevo estado");

  return {
    status: toHojaStatus(row.status),
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    document_version: Number(row.document_version || 0),
  };
}

export async function reopenHoja(
  jobId: string,
  expectedVersion: number,
  reason: string,
): Promise<{ status: HojaStatus; document_version: number }> {
  const { data, error } = await supabase.rpc("reopen_hoja_de_ruta", {
    p_expected_version: expectedVersion,
    p_job_id: jobId,
    p_reason: reason,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error("El servidor no devolvió el nuevo estado");
  return {
    status: toHojaStatus(row.status),
    document_version: Number(row.document_version || 0),
  };
}
