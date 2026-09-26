import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  HojaAggregate,
  HojaStatus,
  HojaStatusTransitionResult,
} from "@/features/hoja-de-ruta/model/HojaDocument";

const client = supabase as unknown as SupabaseClient;

export const hojaDocumentQueryKey = (jobId: string) =>
  ["hoja-de-ruta", jobId] as const;

export async function getHojaAggregate(jobId: string): Promise<HojaAggregate | null> {
  const { data, error } = await client.rpc("get_hoja_de_ruta", {
    p_job_id: jobId,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as unknown as HojaAggregate;
}

export async function saveHojaAggregate(args: {
  jobId: string;
  expectedVersion: number;
  payload: Record<string, unknown>;
}): Promise<{ id: string; document_version: number }> {
  const removedImageIds = Array.isArray(args.payload.removedImageIds)
    ? args.payload.removedImageIds.filter((value): value is string => typeof value === "string")
    : [];
  const { data, error } = await client.rpc("save_hoja_de_ruta", {
    p_job_id: args.jobId,
    p_expected_version: args.expectedVersion,
    p_payload: args.payload as Json,
    p_removed_image_ids: removedImageIds,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") {
    throw new Error("El servidor no devolvió la versión guardada");
  }

  const id = "id" in row ? String(row.id || "") : "";
  const documentVersion = "document_version" in row
    ? Number(row.document_version || 0)
    : 0;
  if (!id) throw new Error("El servidor no devolvió la Hoja de Ruta guardada");

  return { id, document_version: documentVersion };
}

export async function setHojaStatus(
  jobId: string,
  status: HojaStatus,
  expectedVersion: number,
): Promise<HojaStatusTransitionResult> {
  const { data, error } = await client.rpc("set_hoja_de_ruta_status", {
    p_expected_version: expectedVersion,
    p_job_id: jobId,
    p_status: status,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") {
    throw new Error("El servidor no devolvió el nuevo estado");
  }

  return {
    status: String("status" in row ? row.status : "draft") as HojaStatus,
    approved_by:
      "approved_by" in row && typeof row.approved_by === "string"
        ? row.approved_by
        : null,
    approved_at:
      "approved_at" in row && typeof row.approved_at === "string"
        ? row.approved_at
        : null,
    document_version: Number(
      "document_version" in row ? row.document_version || 0 : 0,
    ),
  };
}
