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
}

type TransportRequestItem = {
  leftover_space_meters: number | null;
  transport_type: string;
};

const readOptionalText = (value: unknown, field: string, maxLength: number) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpError(400, `${field} must be text up to ${maxLength} characters`, {
      code: `invalid_${field}`,
    });
  }
  return value.trim();
};

const parseItems = (value: unknown): TransportRequestItem[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpError(400, "items must be an array of at most 20 entries", { code: "invalid_items" });
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(400, `items[${index}] must be an object`, { code: "invalid_items" });
    }

    const record = item as Record<string, unknown>;
    const transportType = typeof record.transport_type === "string" ? record.transport_type.trim() : "";
    if (!VALID_TRANSPORT_TYPES.has(transportType)) {
      throw new HttpError(400, `items[${index}].transport_type is invalid`, { code: "invalid_transport_type" });
    }

    const leftover = record.leftover_space_meters;
    if (leftover !== undefined && leftover !== null && (typeof leftover !== "number" || !Number.isFinite(leftover))) {
      throw new HttpError(400, `items[${index}].leftover_space_meters is invalid`, {
        code: "invalid_leftover_space_meters",
      });
    }

    return {
      transport_type: transportType,
      leftover_space_meters: leftover ?? null,
    };
  });
};

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
    throw new HttpError(400, "job_id must be a UUID", { code: "invalid_job_id" });
  }
  if (!VALID_DEPARTMENTS.has(department)) {
    throw new HttpError(400, "department must be sound, lights, or video", {
      code: "invalid_department",
    });
  }
  if (subrentalId !== null && !UUID_PATTERN.test(subrentalId)) {
    throw new HttpError(400, "subrental_id must be a UUID", { code: "invalid_subrental_id" });
  }

  const { SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );
  const token = requireBearerToken(req);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) {
    throw new HttpError(401, "Invalid or expired token", { code: "invalid_authorization" });
  }

  if (body.requested_by !== undefined && body.requested_by !== null && body.requested_by !== user.id) {
    throw new HttpError(403, "created_by must match the authenticated user", {
      code: "created_by_mismatch",
    });
  }

  const descriptionInput = readOptionalText(body.description, "description", 2_000);
  const noteInput = readOptionalText(body.note, "note", 4_000);
  const items = parseItems(body.items);

  // The anon API key plus the caller JWT keeps these data operations entirely
  // inside PostgREST's authenticated RLS boundary.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  let description = descriptionInput;
  let note = noteInput;
  if (subrentalId) {
    const { data: subrental, error: subrentalError } = await callerClient
      .from("sub_rentals")
      .select("id, job_id, department, notes, equipment:equipment(name, category)")
      .eq("id", subrentalId)
      .maybeSingle();

    if (subrentalError) {
      console.error("Transport sub-rental lookup failed", subrentalError.message);
      throw new HttpError(500, "Unable to validate sub-rental", {
        code: "subrental_lookup_failed",
        exposeDetails: false,
      });
    }
    if (!subrental) {
      throw new HttpError(404, "Sub-rental was not found or is not accessible", {
        code: "subrental_not_found",
      });
    }
    if (subrental.job_id !== jobId || subrental.department !== department) {
      throw new HttpError(403, "Sub-rental does not belong to this job and department", {
        code: "subrental_scope_mismatch",
      });
    }

    const vendorName = subrental.notes?.trim() || "Unknown vendor";
    const equipment = Array.isArray(subrental.equipment) ? subrental.equipment[0] : subrental.equipment;
    if (!description) {
      description = `Subrental pickup: ${vendorName} (${equipment?.name || "equipment"})`;
    }

    const marker = `[subrental:${subrentalId}]`;
    const { data: existingRequest, error: existingRequestError } = await callerClient
      .from("transport_requests")
      .select("id")
      .eq("job_id", jobId)
      .eq("department", department)
      .neq("status", "cancelled")
      .ilike("note", `%${marker}%`)
      .maybeSingle();
    if (existingRequestError) {
      console.error("Transport duplicate lookup failed", existingRequestError.message);
      throw new HttpError(500, "Unable to validate existing transport request", {
        code: "duplicate_lookup_failed",
        exposeDetails: false,
      });
    }
    if (existingRequest) {
      return jsonResponse({
        id: existingRequest.id,
        message: "Transport request already exists for this sub-rental",
        existing: true,
      });
    }

    note = note ? `${note} ${marker}` : marker;
  }

  const { data: transportRequest, error: insertError } = await callerClient
    .from("transport_requests")
    .insert({
      created_by: user.id,
      department,
      description: description || null,
      job_id: jobId,
      note: note || null,
      status: "requested",
    })
    .select("id")
    .single();
  if (insertError || !transportRequest) {
    console.warn("Transport request was denied or failed", insertError?.message);
    throw new HttpError(403, "Not permitted to create a transport request for this job", {
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
      throw new HttpError(500, "Unable to create transport request items", {
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
    message: "Transport request created successfully",
    description,
  });
}), {
  onError: (error) => console.error("create-transport-request failed", error),
});
