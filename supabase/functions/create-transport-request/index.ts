import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireBearerToken,
  requireEnvValues,
} from "../_shared/http.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DEPARTMENTS = new Set(["sound", "lights", "video"]);
const VALID_TRANSPORT_TYPES = new Set(["trailer", "9m", "8m", "6m", "4m", "furgoneta"]);

interface CreateTransportRequestBody extends Record<string, unknown> {
  job_id?: unknown;
  subrental_id?: unknown;
  description?: unknown;
  department?: unknown;
  note?: unknown;
  items?: unknown;
  requested_by?: unknown;
  is_hoja_relevant?: unknown;
}

type TransportRequestItem = {
  leftover_space_meters: number | null;
  transport_type: string;
};

const readOptionalText = (value: unknown, field: string, maxLength: number) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpError(400, `El campo ${field} debe ser un texto de hasta ${maxLength} caracteres`, {
      code: `invalid_${field}`,
    });
  }
  return value.trim();
};

const parseItems = (value: unknown): TransportRequestItem[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpError(400, "Los elementos deben ser una lista de como máximo 20 entradas", { code: "invalid_items" });
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `El elemento ${index + 1} debe ser un objeto`, { code: "invalid_items" });
    }

    const record = item as Record<string, unknown>;
    const transportType = typeof record.transport_type === "string" ? record.transport_type.trim() : "";
    if (!VALID_TRANSPORT_TYPES.has(transportType)) {
      throw new HttpError(400, `El tipo de transporte del elemento ${index + 1} no es válido`, { code: "invalid_transport_type" });
    }

    const leftover = record.leftover_space_meters;
    if (leftover !== undefined && leftover !== null && (typeof leftover !== "number" || !Number.isFinite(leftover))) {
      throw new HttpError(400, `El espacio restante del elemento ${index + 1} no es válido`, {
        code: "invalid_leftover_space_meters",
      });
    }

    return {
      transport_type: transportType,
      leftover_space_meters: leftover ?? null,
    };
  });
};

const existingSubrentalRequestResponse = (id: string) => jsonResponse({
  id,
  message: "Ya existe una solicitud de transporte para este subalquiler",
  existing: true,
});

/**
 * Uses the caller's JWT for all business data operations. The service client is
 * retained solely for token verification and the post-commit push invocation;
 * it never bypasses transport-request or sub-rental RLS.
 */
serve(createHttpHandler(async (req) => {
  const body = await readBoundedJsonObject<CreateTransportRequestBody>(req, { maxBytes: 16 * 1024 });
  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  const department = typeof body.department === "string" ? body.department.trim() : "";
  const subrentalId = body.subrental_id === undefined || body.subrental_id === null
    ? null
    : typeof body.subrental_id === "string" ? body.subrental_id : "";

  if (!UUID_PATTERN.test(jobId)) {
    throw new HttpError(400, "job_id debe ser un UUID válido", { code: "invalid_job_id" });
  }
  if (!VALID_DEPARTMENTS.has(department)) {
    throw new HttpError(400, "El departamento debe ser sound, lights o video", {
      code: "invalid_department",
    });
  }
  if (subrentalId !== null && !UUID_PATTERN.test(subrentalId)) {
    throw new HttpError(400, "subrental_id debe ser un UUID válido", { code: "invalid_subrental_id" });
  }

  const { SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );
  const token = requireBearerToken(req);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) {
    throw new HttpError(401, "El token no es válido o ha caducado", { code: "invalid_authorization" });
  }

  if (body.requested_by !== undefined && body.requested_by !== null && body.requested_by !== user.id) {
    throw new HttpError(403, "requested_by debe coincidir con el usuario autenticado", {
      code: "created_by_mismatch",
    });
  }

  const descriptionInput = readOptionalText(body.description, "description", 2_000);
  const noteInput = readOptionalText(body.note, "note", 4_000);
  const items = parseItems(body.items);

  if (body.is_hoja_relevant !== undefined && body.is_hoja_relevant !== null && typeof body.is_hoja_relevant !== "boolean") {
    throw new HttpError(400, "El campo is_hoja_relevant debe ser booleano", { code: "invalid_is_hoja_relevant" });
  }
  const isHojaRelevant = body.is_hoja_relevant === undefined || body.is_hoja_relevant === null
    ? true
    : body.is_hoja_relevant;

  // The anon API key plus the caller JWT keeps these data operations entirely
  // inside PostgREST's authenticated RLS boundary.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const findExistingSubrentalRequest = async (id: string, marker: string) => {
    const { data: linkedRequest, error: linkedRequestError } = await callerClient
      .from("transport_requests")
      .select("id")
      .eq("subrental_id", id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (linkedRequestError) {
      console.error("Transport duplicate lookup failed", linkedRequestError.message);
      throw new HttpError(500, "No se pudo comprobar la solicitud de transporte existente", {
        code: "duplicate_lookup_failed",
        exposeDetails: false,
      });
    }
    if (linkedRequest) return linkedRequest;

    // Preserve idempotency for requests created before subrental_id was added.
    const { data: legacyRequest, error: legacyRequestError } = await callerClient
      .from("transport_requests")
      .select("id")
      .neq("status", "cancelled")
      .ilike("note", `%${marker}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyRequestError) {
      console.error("Legacy transport duplicate lookup failed", legacyRequestError.message);
      throw new HttpError(500, "No se pudo comprobar la solicitud de transporte existente", {
        code: "duplicate_lookup_failed",
        exposeDetails: false,
      });
    }
    return legacyRequest;
  };

  let description = descriptionInput;
  let note = noteInput;
  let subrentalMarker: string | null = null;
  if (subrentalId) {
    const { data: subrental, error: subrentalError } = await callerClient
      .from("sub_rentals")
      .select("id, job_id, department, notes, equipment:equipment(name, category)")
      .eq("id", subrentalId)
      .maybeSingle();

    if (subrentalError) {
      console.error("Transport sub-rental lookup failed", subrentalError.message);
      throw new HttpError(500, "No se pudo validar el subalquiler", {
        code: "subrental_lookup_failed",
        exposeDetails: false,
      });
    }
    if (!subrental) {
      throw new HttpError(404, "El subalquiler no se ha encontrado o no es accesible", {
        code: "subrental_not_found",
      });
    }
    if (subrental.job_id !== jobId || subrental.department !== department) {
      throw new HttpError(403, "El subalquiler no pertenece a este trabajo y departamento", {
        code: "subrental_scope_mismatch",
      });
    }

    const vendorName = subrental.notes?.trim() || "Proveedor no especificado";
    const equipment = Array.isArray(subrental.equipment) ? subrental.equipment[0] : subrental.equipment;
    if (!description) {
      description = `Recogida de subalquiler: ${vendorName} (${equipment?.name || "equipo"})`;
    }

    const marker = `[subrental:${subrentalId}]`;
    subrentalMarker = marker;
    const existingRequest = await findExistingSubrentalRequest(subrentalId, marker);
    if (existingRequest) {
      return existingSubrentalRequestResponse(existingRequest.id);
    }

    note = note ? `${note} ${marker}` : marker;
  }

  const { data: transportRequest, error: insertError } = await callerClient
    .from("transport_requests")
    .insert({
      created_by: user.id,
      department,
      description: description || null,
      is_hoja_relevant: isHojaRelevant,
      job_id: jobId,
      note: note || null,
      status: "requested",
      subrental_id: subrentalId,
    })
    .select("id")
    .single();
  if (insertError?.code === "23505" && subrentalId && subrentalMarker) {
    const existingRequest = await findExistingSubrentalRequest(subrentalId, subrentalMarker);
    if (existingRequest) return existingSubrentalRequestResponse(existingRequest.id);
  }
  if (insertError || !transportRequest) {
    console.warn("Transport request was denied or failed", insertError?.message);
    throw new HttpError(403, "No tienes permiso para crear una solicitud de transporte para este trabajo", {
      code: "transport_request_forbidden",
    });
  }

  if (items.length > 0) {
    const { error: itemsError } = await callerClient
      .from("transport_request_items")
      .insert(items.map((item) => ({ ...item, request_id: transportRequest.id })));
    if (itemsError) {
      console.error("Transport item creation failed", itemsError.message);
      const { error: rollbackError } = await callerClient
        .from("transport_requests")
        .delete()
        .eq("id", transportRequest.id);
      if (rollbackError) console.error("Transport request rollback failed", rollbackError.message);
      throw new HttpError(500, "No se pudieron crear los elementos de la solicitud de transporte", {
        code: "transport_items_create_failed",
        exposeDetails: false,
      });
    }
  }

  try {
    const { error: pushError } = await admin.functions.invoke("push", {
      body: {
        action: "broadcast",
        department,
        description: description || undefined,
        job_id: jobId,
        request_id: transportRequest.id,
        type: "logistics.transport.requested",
      },
    });
    if (pushError) console.error("Transport push notification failed", pushError.message);
  } catch (pushError) {
    console.error("Transport push notification failed", pushError);
  }

  return jsonResponse({
    id: transportRequest.id,
    message: "Solicitud de transporte creada correctamente",
    description,
  });
}), {
  onError: (error) => console.error("create-transport-request failed", error),
});
