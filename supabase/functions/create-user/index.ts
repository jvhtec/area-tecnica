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
  requireEnvValues,
} from "../_shared/http.ts";
import { requireAdminOrManagement } from "../_shared/auth.ts";

type CreateUserBody = Record<string, unknown> & {
  email?: unknown;
  firstName?: unknown;
  nickname?: unknown;
  lastName?: unknown;
  department?: unknown;
  phone?: unknown;
  dni?: unknown;
  residencia?: unknown;
  role?: unknown;
  flex_resource_id?: unknown;
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

const MAX_CREATE_USER_BODY_BYTES = 16 * 1024;

const normalizeOptional = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const requireText = (value: unknown) => normalizeOptional(value);

const getErrorObject = (error: unknown): ErrorLike =>
  error && typeof error === "object" ? error as ErrorLike : {};

const getErrorStatus = (error: unknown, fallbackStatus = 502) => {
  const status = Number(getErrorObject(error).status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : fallbackStatus;
};

const getErrorCode = (error: unknown) => {
  const code = getErrorObject(error).code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
};

const getErrorMessage = (error: unknown) => {
  const message = getErrorObject(error).message;
  return typeof message === "string" && message.trim() ? message.trim() : undefined;
};

const isEmailExistsError = (error: unknown) => {
  const candidate = getErrorObject(error);
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return (
    candidate.code === "email_exists" ||
    (candidate.status === 422 && message.includes("already") && message.includes("registered")) ||
    (message.includes("email") && (message.includes("already") || message.includes("exists")))
  );
};

const duplicateEmailResponse = (headers: Record<string, string>) =>
  jsonResponse(
    {
      error: "A user with this email address has already been registered",
      code: "email_exists",
    },
    { status: 409, headers },
  );

serve(createHttpHandler(async (req) => {
  const correlationId = getCorrelationId(req);
  const headers = correlationHeaders(correlationId);
  const respond = (body: unknown, status = 200) => jsonResponse(body, { status, headers });

  const body = await readBoundedJsonObject<CreateUserBody>(req, {
    maxBytes: MAX_CREATE_USER_BODY_BYTES,
  });

  const email = requireText(body.email)?.toLowerCase();
  const firstName = requireText(body.firstName);
  const lastName = requireText(body.lastName);

  if (!email || !firstName || !lastName) {
    throw new HttpError(400, "Missing required fields", {
      code: "missing_required_fields",
    });
  }

  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  await requireAdminOrManagement(supabaseAdmin, req, {
    missingMessage: "Unauthorized",
    invalidMessage: "Unauthorized",
    forbiddenMessage: "Unauthorized",
  });

  const { data: existingProfile, error: existingProfileErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileErr) {
    throw new HttpError(500, "User lookup failed", {
      code: "user_lookup_failed",
      exposeDetails: false,
    });
  }

  if (existingProfile) {
    return duplicateEmailResponse(headers);
  }

  const role = normalizeOptional(body.role) ?? "technician";
  const nickname = normalizeOptional(body.nickname);
  const department = normalizeOptional(body.department);
  const phone = normalizeOptional(body.phone);
  const dni = normalizeOptional(body.dni);
  const residencia = normalizeOptional(body.residencia);
  const flexResourceId = normalizeOptional(body.flex_resource_id);

  // Create auth user with a random throwaway password. It is never disclosed:
  // the user sets their real password via the "Olvidé mi contraseña" reset flow.
  const tempPassword = crypto.randomUUID();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      nickname,
      last_name: lastName,
      phone,
      department,
      dni,
      residencia,
      needs_password_change: true,
    },
  });

  if (authError) {
    if (isEmailExistsError(authError)) {
      return duplicateEmailResponse(headers);
    }

    const status = getErrorStatus(authError);
    throw new HttpError(status, status < 500 ? getErrorMessage(authError) ?? "Failed to create user" : "Failed to create user", {
      code: getErrorCode(authError) ?? "create_user_failed",
      exposeDetails: status < 500,
    });
  }

  if (!authData.user?.id) {
    throw new HttpError(502, "Failed to create user", {
      code: "missing_created_user",
      exposeDetails: false,
    });
  }

  const { error: profileUpsertErr } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      department,
      dni,
      residencia,
      role,
      nickname,
      flex_resource_id: flexResourceId,
    }, { onConflict: "id" });

  if (profileUpsertErr) {
    const { error: rollbackErr } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (rollbackErr) {
      console.error("create-user rollback error:", redactSensitiveValues({ correlationId, error: rollbackErr }));
    }

    throw new HttpError(500, "Failed to create profile", {
      code: "profile_upsert_failed",
      exposeDetails: false,
    });
  }

  return respond({ id: authData.user.id, email: authData.user.email });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Unexpected error",
  errorHeaders: (req) => correlationHeaders(getCorrelationId(req)),
  onError: (error, req) => {
    console.error("create-user error:", redactSensitiveValues({
      correlationId: getCorrelationId(req),
      error,
    }));
  },
}));
