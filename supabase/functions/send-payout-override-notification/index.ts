import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

const MAX_PAYOUT_OVERRIDE_BODY_BYTES = 16 * 1024;
const ADMIN_ROLES = new Set(["admin", "management"]);

/**
 * Escapes HTML special characters to prevent XSS injection in email templates.
 * Converts undefined/null to empty string before escaping.
 */
function escapeHtml(value: string | null | undefined): string {
  const str = value ?? "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface PayoutOverrideNotificationRequest extends Record<string, unknown> {
  jobId: string;
  jobTitle: string;
  jobStartTime: string;
  jobType?: string | null;
  technicianId: string;
  technicianName: string;
  technicianDepartment: string;
  actorId: string;
  oldOverrideAmountEur: number | null;
  newOverrideAmountEur: number | null;
  calculatedTotal: number;
}

async function requireAdminOrManagement(
  supabase: SupabaseClient,
  req: Request,
): Promise<{ userId: string; role: string; authorizationHeader: string }> {
  const token = requireBearerToken(req, {
    message: "Missing or malformed authorization header",
    code: "missing_authorization",
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error("[send-payout-override-notification] Token verification failed:", authError?.message);
    throw new HttpError(401, "Invalid or expired token", { code: "invalid_authorization" });
  }

  const { data: callerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[send-payout-override-notification] Profile lookup failed:", profileError.message);
    throw new HttpError(500, "Authorization lookup failed", {
      code: "authorization_lookup_failed",
      exposeDetails: false,
    });
  }

  const role = typeof callerProfile?.role === "string"
    ? callerProfile.role.toLowerCase()
    : "";

  if (!ADMIN_ROLES.has(role)) {
    console.warn("[send-payout-override-notification] Forbidden: user", user.id, "role:", role || "<missing>");
    throw new HttpError(403, "Forbidden: insufficient permissions", {
      code: "insufficient_role",
    });
  }

  return {
    userId: user.id,
    role,
    authorizationHeader: `Bearer ${token}`,
  };
}

serve(createHttpHandler(async (req) => {
  const correlationId = getCorrelationId(req);
  const responseHeaders = correlationHeaders(correlationId);
  const respond = (body: unknown, status = 200) => jsonResponse(body, { status, headers: responseHeaders });

  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await requireAdminOrManagement(supabase, req);

  // Parse request body
  const payload = await readBoundedJsonObject<PayoutOverrideNotificationRequest>(req, {
    maxBytes: MAX_PAYOUT_OVERRIDE_BODY_BYTES,
  });

    // Validate required fields
    if (!payload.jobId || !payload.technicianId || !payload.actorId) {
      return respond({ error: "Missing required fields: jobId, technicianId, actorId" }, 400);
    }

    const {
      jobId,
      jobTitle,
      jobStartTime,
      jobType,
      technicianId,
      technicianName,
      technicianDepartment,
      actorId,
      oldOverrideAmountEur,
      newOverrideAmountEur,
      calculatedTotal,
    } = payload;

    if (actorId !== caller.userId) {
      console.warn("[send-payout-override-notification] Actor mismatch", JSON.stringify(redactSensitiveValues({
        correlationId,
        caller_id: caller.userId,
        payload_actor_id: actorId,
      })));
      throw new HttpError(403, "Forbidden: actor mismatch", { code: "actor_mismatch" });
    }

    console.log("[send-payout-override-notification] Incoming payload", JSON.stringify(redactSensitiveValues({
      correlationId,
      actor_id: caller.userId,
      role: caller.role,
      job_id: jobId,
      technician_id: technicianId,
      has_override: newOverrideAmountEur !== null,
    })));

    let resolvedJobType = jobType?.toLowerCase()?.trim() || null;
    if (!resolvedJobType && jobId) {
      const { data: jobRow, error: jobTypeError } = await supabase
        .from("jobs")
        .select("job_type")
        .eq("id", jobId)
        .maybeSingle();

      if (jobTypeError) {
        console.warn("[send-payout-override-notification] Failed to resolve job_type:", jobTypeError);
      } else {
        resolvedJobType = jobRow?.job_type?.toLowerCase()?.trim() || null;
      }
    }

    if (resolvedJobType === "ciclo") {
      return respond({
        success: true,
        message: "Notification skipped for ciclo job type",
      });
    }

    // Get actor information
    const { data: actorProfile, error: actorError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, department, role")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actorProfile) {
      console.error("[send-payout-override-notification] Error fetching actor profile:", actorError);
      throw new HttpError(500, "Failed to fetch actor information", {
        code: "actor_lookup_failed",
        exposeDetails: false,
      });
    }

    const actorName = `${actorProfile.first_name || ""} ${actorProfile.last_name || ""}`.trim() || "Unknown User";
    const actorEmail = actorProfile.email || "no-email@example.com";
    const actorRole = actorProfile.role || "unknown";
    const actorDepartment = actorProfile.department || "N/A";

    // Format currency
    const formatCurrency = (amount: number | null) => {
      if (amount === null) return "—";
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
      }).format(amount);
    };

    // Format date
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("es-ES", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(date);
    };

    // Determine change type
    let changeDescription = "";
    if (oldOverrideAmountEur === null && newOverrideAmountEur !== null) {
      changeDescription = "✅ Override activado";
    } else if (oldOverrideAmountEur !== null && newOverrideAmountEur === null) {
      changeDescription = "❌ Override desactivado";
    } else if (oldOverrideAmountEur !== null && newOverrideAmountEur !== null) {
      changeDescription = "✏️ Override modificado";
    } else {
      changeDescription = "ℹ️ Sin cambios";
    }

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #1e40af;
      font-size: 24px;
    }
    .alert-badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    .section h2 {
      margin: 0 0 15px 0;
      color: #1e40af;
      font-size: 18px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
    }
    .value {
      color: #111827;
      font-weight: 500;
    }
    .comparison {
      margin: 20px 0;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 20px;
      align-items: center;
    }
    .comparison-box {
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .comparison-box.old {
      background-color: #fef2f2;
      border: 2px solid #fca5a5;
    }
    .comparison-box.new {
      background-color: #f0fdf4;
      border: 2px solid #86efac;
    }
    .comparison-box .title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .comparison-box .amount {
      font-size: 24px;
      font-weight: 700;
    }
    .comparison-box.old .amount {
      color: #dc2626;
    }
    .comparison-box.new .amount {
      color: #16a34a;
    }
    .arrow {
      font-size: 32px;
      color: #9ca3af;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .warning-title {
      font-weight: 700;
      color: #92400e;
      margin-bottom: 5px;
    }
    .warning-text {
      color: #78350f;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Alerta: Override de Pago de Técnico</h1>
      <div class="alert-badge">${changeDescription}</div>
    </div>

    <div class="section">
      <h2>👤 Técnico Afectado</h2>
      <div class="info-row">
        <span class="label">Nombre:</span>
        <span class="value">${escapeHtml(technicianName)}</span>
      </div>
      <div class="info-row">
        <span class="label">ID:</span>
        <span class="value">${escapeHtml(technicianId)}</span>
      </div>
      <div class="info-row">
        <span class="label">Departamento:</span>
        <span class="value">${escapeHtml(technicianDepartment)}</span>
      </div>
    </div>

    <div class="section">
      <h2>📋 Información del Trabajo</h2>
      <div class="info-row">
        <span class="label">Trabajo:</span>
        <span class="value">${escapeHtml(jobTitle)}</span>
      </div>
      <div class="info-row">
        <span class="label">ID:</span>
        <span class="value">${escapeHtml(jobId)}</span>
      </div>
      <div class="info-row">
        <span class="label">Fecha de inicio:</span>
        <span class="value">${escapeHtml(formatDate(jobStartTime))}</span>
      </div>
    </div>

    <div class="section">
      <h2>👤 Modificado por</h2>
      <div class="info-row">
        <span class="label">Usuario:</span>
        <span class="value">${escapeHtml(actorName)}</span>
      </div>
      <div class="info-row">
        <span class="label">Email:</span>
        <span class="value">${escapeHtml(actorEmail)}</span>
      </div>
      <div class="info-row">
        <span class="label">Rol:</span>
        <span class="value">${escapeHtml(actorRole)}</span>
      </div>
      <div class="info-row">
        <span class="label">Departamento:</span>
        <span class="value">${escapeHtml(actorDepartment)}</span>
      </div>
    </div>

    <div class="section">
      <h2>💰 Cambios Financieros</h2>

      <div class="info-row">
        <span class="label">Total calculado (sistema):</span>
        <span class="value">${formatCurrency(calculatedTotal)}</span>
      </div>

      <div class="comparison">
        <div class="comparison-box old">
          <div class="title">Anterior</div>
          <div class="amount">
            ${oldOverrideAmountEur !== null ? formatCurrency(oldOverrideAmountEur) : formatCurrency(calculatedTotal)}
          </div>
          <div style="font-size: 12px; margin-top: 5px; color: #6b7280;">
            ${oldOverrideAmountEur !== null ? "Override activo" : "Sin override"}
          </div>
        </div>

        <div class="arrow">→</div>

        <div class="comparison-box new">
          <div class="title">Nuevo</div>
          <div class="amount">
            ${newOverrideAmountEur !== null ? formatCurrency(newOverrideAmountEur) : formatCurrency(calculatedTotal)}
          </div>
          <div style="font-size: 12px; margin-top: 5px; color: #6b7280;">
            ${newOverrideAmountEur !== null ? "Override activo" : "Sin override"}
          </div>
        </div>
      </div>
    </div>

    ${newOverrideAmountEur !== null ? `
    <div class="warning">
      <div class="warning-title">⚠️ Importante</div>
      <div class="warning-text">
        El modo override está activo para ${escapeHtml(technicianName)}. El total de pago para este técnico
        en este trabajo es ahora <strong>${escapeHtml(formatCurrency(newOverrideAmountEur))}</strong> en lugar del total calculado
        de <strong>${escapeHtml(formatCurrency(calculatedTotal))}</strong>.
      </div>
    </div>
    ` : ""}

    <div class="footer">
      <p>Este es un correo automático de notificación. No responder.</p>
      <p>Sector-Pro - Sistema de Gestión de Trabajos</p>
    </div>
  </div>
</body>
</html>
    `;

    // Get finanzas user profile ID
    const { data: finanzasProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", "finanzas@sector-pro.com")
      .maybeSingle();

    const finanzasProfileId = finanzasProfile?.id;

    if (!finanzasProfileId) {
      console.warn("[send-payout-override-notification] finanzas@sector-pro.com profile not found");
    }

    // Forward verified caller auth to preserve actor identity/permissions in nested function call.
    const corporateEmailInvokeOptions: {
      body: {
        subject: string;
        bodyHtml: string;
        recipients: {
          roles: string[];
          profileIds: string[];
          emails: string[];
        };
      };
      headers?: Record<string, string>;
    } = {
      body: {
        subject: `⚠️ Override de Pago: ${technicianName} - ${jobTitle}`,
        bodyHtml: emailHtml,
        recipients: {
          roles: ["admin"],
          profileIds: finanzasProfileId ? [finanzasProfileId] : [],
          emails: finanzasProfileId ? [] : ["finanzas@sector-pro.com"],
        },
      },
    };

    corporateEmailInvokeOptions.headers = {
      Authorization: caller.authorizationHeader,
    };

    // Send email via corporate email function to admins and finanzas
    const { error: sendError } = await supabase.functions.invoke(
      "send-corporate-email",
      corporateEmailInvokeOptions
    );

    if (sendError) {
      console.error("[send-payout-override-notification] Error calling send-corporate-email:", JSON.stringify(redactSensitiveValues({
        correlationId,
        error: sendError,
      })));
      throw new HttpError(502, "Notification email delivery failed", {
        code: "notification_delivery_failed",
        exposeDetails: false,
      });
    }

    return respond({
      success: true,
      message: "Notification emails sent",
    });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Payout override notification failed",
  errorHeaders: (req) => correlationHeaders(getCorrelationId(req)),
  onError(error, req) {
    console.error("[send-payout-override-notification] Request failed", JSON.stringify(redactSensitiveValues({
      correlationId: getCorrelationId(req),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    })));
  },
}));
