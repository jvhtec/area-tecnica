import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  correlationHeaders,
  createHttpHandler,
  getCorrelationId,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  redactSensitiveValues,
  requireBearerToken,
  requireEnvValues,
} from "../_shared/http.ts";

type DeleteUserBody = Record<string, unknown> & {
  userId?: unknown;
};

const MAX_DELETE_USER_BODY_BYTES = 8 * 1024;
const ADMIN_ROLES = new Set(["admin", "management"]);

const normalizeRequiredText = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

serve(createHttpHandler(async (req) => {
  const correlationId = getCorrelationId(req);
  const headers = correlationHeaders(correlationId);
  const respond = (body: unknown, status = 200) => jsonResponse(body, { status, headers });

  const { userId: rawUserId } = await readBoundedJsonObject<DeleteUserBody>(req, {
    maxBytes: MAX_DELETE_USER_BODY_BYTES,
  });
  const userId = normalizeRequiredText(rawUserId);

  if (!userId) {
    throw new HttpError(400, "User ID is required", { code: "missing_user_id" });
  }

  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const token = requireBearerToken(req);
  const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !requestingUser) {
    throw new HttpError(401, "Unauthorized", { code: "invalid_authorization" });
  }

  const { data: requesterProfile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", requestingUser.id)
    .maybeSingle();

  if (profileErr) {
    throw new HttpError(500, "Authorization lookup failed", {
      code: "authorization_lookup_failed",
      exposeDetails: false,
    });
  }

  const requesterRole = typeof requesterProfile?.role === "string"
    ? requesterProfile.role.toLowerCase()
    : "";

  if (!ADMIN_ROLES.has(requesterRole)) {
    throw new HttpError(403, "Unauthorized - admin or management role required", {
      code: "insufficient_role",
    });
  }

  // Guard against self-deletion (would orphan the requester's own session/audit trail).
  if (userId === requestingUser.id) {
    throw new HttpError(400, "You cannot delete your own account", {
      code: "self_delete_blocked",
    });
  }

  // Confirm the target exists for a clear 404 instead of a silent success.
  const { data: targetUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getErr || !targetUser?.user) {
    throw new HttpError(404, "User not found", { code: "user_not_found" });
  }

  console.log("Deleting user:", redactSensitiveValues({ correlationId, userId, requestedBy: requestingUser.id }));

  // Deleting from auth.users cascades to profiles and, via the normalized
  // ON DELETE rules, to all dependent records.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("Error deleting user:", redactSensitiveValues({ correlationId, error: deleteError }));
    throw new HttpError(502, "Failed to delete user", {
      code: "delete_user_failed",
      exposeDetails: false,
    });
  }

  return respond({ message: "User deleted successfully" });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Unexpected error",
  onError: (error, req) => {
    console.error("delete-user error:", redactSensitiveValues({
      correlationId: getCorrelationId(req),
      error,
    }));
  },
}));
