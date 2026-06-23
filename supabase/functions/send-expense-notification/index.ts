import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
import { sendBrevoEmail } from "../_shared/brevo.ts";

const MAX_EXPENSE_NOTIFICATION_BODY_BYTES = 16 * 1024;

interface ExpenseNotificationPayload extends Record<string, unknown> {
  expense_id: string;
  job_id: string;
  job_title: string;
  technician_email: string;
  technician_name: string;
  category_label: string;
  amount_eur: number;
  expense_date: string;
  status: "submitted" | "approved" | "rejected" | string;
  rejection_reason?: string;
}

function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function requireServiceRoleRequest(req: Request, serviceRoleKey: string) {
  const token = requireBearerToken(req, {
    message: "Missing service authorization",
    code: "missing_service_authorization",
  });

  if (!timingSafeEqual(token, serviceRoleKey)) {
    throw new HttpError(403, "Forbidden", { code: "service_role_required" });
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "Missing required fields", {
      code: "missing_required_fields",
      details: { field: fieldName },
    });
  }

  return value.trim();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  try {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(parsed);
  } catch {
    return dateStr;
  }
}

serve(createHttpHandler(async (req) => {
  const correlationId = getCorrelationId(req);
  const responseHeaders = correlationHeaders(correlationId);
  const respond = (body: unknown, status = 200) => jsonResponse(body, { status, headers: responseHeaders });

  const {
    BREVO_API_KEY: brevoKey,
    BREVO_FROM: brevoFrom,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(
    ["BREVO_API_KEY", "BREVO_FROM", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );

  requireServiceRoleRequest(req, serviceRoleKey);

  const payload = await readBoundedJsonObject<ExpenseNotificationPayload>(req, {
    maxBytes: MAX_EXPENSE_NOTIFICATION_BODY_BYTES,
  });

  const expenseId = requireString(payload.expense_id, "expense_id");
  const jobTitle = requireString(payload.job_title, "job_title");
  const technicianEmail = requireString(payload.technician_email, "technician_email");
  const technicianName = typeof payload.technician_name === "string" ? payload.technician_name.trim() : "";
  const categoryLabel = typeof payload.category_label === "string" ? payload.category_label.trim() : "";
  const expenseDate = typeof payload.expense_date === "string" ? payload.expense_date : "";
  const status = typeof payload.status === "string" ? payload.status : "updated";
  const amountEur = Number(payload.amount_eur ?? 0);

  console.log("[send-expense-notification] Incoming payload", JSON.stringify(redactSensitiveValues({
    correlationId,
    expense_id: expenseId,
    job_id: payload.job_id,
    status,
  })));

  // Corporate assets
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const companyLogoUrl = Deno.env.get("COMPANY_LOGO_URL_W") ||
    (supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/company-assets/sectorlogow.png` : "");
  const areaTecnicaLogoUrl = Deno.env.get("AT_LOGO_URL") ||
    (supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/company-assets/area-tecnica-logo.png` : "");

  let subject: string;
  let statusText: string;
  let statusColor: string;
  let messageText: string;

  switch (status) {
    case "submitted":
      subject = `Gasto enviado para aprobación · ${jobTitle}`;
      statusText = "Enviado para Aprobación";
      statusColor = "#3b82f6";
      messageText = "Tu gasto ha sido enviado correctamente y está pendiente de revisión por parte de administración.";
      break;
    case "approved":
      subject = `Gasto aprobado · ${jobTitle}`;
      statusText = "Aprobado";
      statusColor = "#10b981";
      messageText = "Tu gasto ha sido aprobado y se incluirá en el próximo pago.";
      break;
    case "rejected":
      subject = `Gasto rechazado · ${jobTitle}`;
      statusText = "Rechazado";
      statusColor = "#ef4444";
      messageText =
        "Tu gasto ha sido rechazado. Por favor, revisa el motivo a continuación y contacta con administración si tienes dudas.";
      break;
    default:
      subject = `Actualización de gasto · ${jobTitle}`;
      statusText = status;
      statusColor = "#6b7280";
      messageText = "El estado de tu gasto ha sido actualizado.";
  }

  const htmlContent = `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
              <tr>
                <td style="padding:16px 20px;background:#0b0b0b;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        ${companyLogoUrl ? `<img src="${escapeHtml(companyLogoUrl)}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />` : ""}
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        ${areaTecnicaLogoUrl ? `<img src="${escapeHtml(areaTecnicaLogoUrl)}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 24px 8px 24px;">
                  <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${escapeHtml(technicianName || "equipo")},</h2>
                  <p style="margin:0;color:#374151;line-height:1.55;">
                    ${escapeHtml(messageText)}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 24px 0 24px;">
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:10px;">
                      <tr>
                        <td style="vertical-align:middle;padding-right:8px;"><b>Estado:</b></td>
                        <td style="vertical-align:middle;">
                          <span style="display:inline-block;background:${statusColor};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${escapeHtml(statusText)}</span>
                        </td>
                      </tr>
                    </table>
                    <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                      <li><b>Trabajo:</b> ${escapeHtml(jobTitle)}</li>
                      <li><b>Categoría:</b> ${escapeHtml(categoryLabel)}</li>
                      <li><b>Fecha del gasto:</b> ${escapeHtml(formatDate(expenseDate))}</li>
                      <li><b>Importe:</b> ${escapeHtml(formatCurrency(amountEur))}</li>
                    </ul>
                    ${status === "rejected" && payload.rejection_reason ? `
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">
                      <b>Motivo del rechazo:</b><br/>
                      <span style="color:#ef4444;">${escapeHtml(payload.rejection_reason)}</span>
                    </div>
                    ` : ""}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 8px 24px;">
                  <p style="margin:0;color:#374151;line-height:1.55;">
                    Si tienes alguna pregunta, no respondas a este mensaje y contacta directamente con administración.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
                  <div style="margin-bottom:8px;">
                    Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
                  </div>
                  <div>
                    Sector Pro · <a href="https://www.sector-pro.com" style="color:#6b7280;text-decoration:underline;">www.sector-pro.com</a>
                    &nbsp;|&nbsp; Área Técnica · <a href="https://area-tecnica.lovable.app" style="color:#6b7280;text-decoration:underline;">area-tecnica.lovable.app</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;

  const emailPayload: Record<string, unknown> = {
    sender: { email: brevoFrom, name: "Área Técnica" },
    to: [{ email: technicianEmail, name: technicianName || undefined }],
    subject,
    htmlContent,
  };

  const expenseNotificationBcc = Deno.env.get("EXPENSE_NOTIFICATION_BCC") ?? "";
  if (expenseNotificationBcc) {
    emailPayload.bcc = [{ email: expenseNotificationBcc }];
  }

  const sendRes = await sendBrevoEmail(brevoKey, emailPayload);

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.error("[send-expense-notification] Brevo error", JSON.stringify(redactSensitiveValues({
      correlationId,
      status: sendRes.status,
      error: errText || sendRes.statusText,
    })));
    throw new HttpError(502, "Email provider rejected the message", {
      code: "email_provider_error",
      exposeDetails: false,
    });
  }

  console.log("[send-expense-notification] Email sent successfully", JSON.stringify({
    correlationId,
    expense_id: expenseId,
  }));

  return respond({
    success: true,
    expense_id: expenseId,
    status,
    sent_to: technicianEmail,
    bcc_sent: !!expenseNotificationBcc,
  });
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Expense notification failed",
  onError(error, req) {
    console.error("[send-expense-notification] Request failed", JSON.stringify(redactSensitiveValues({
      correlationId: getCorrelationId(req),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    })));
  },
}));
