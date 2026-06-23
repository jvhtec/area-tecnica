import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { addDays, getDaysInMonth } from "npm:date-fns@3.6.0";
import { formatInTimeZone, fromZonedTime } from "npm:date-fns-tz@3.2.0";

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
import { getInvoicingCompanyDetails } from "../_shared/invoicing-company-data.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";

const INVOICE_SUBMISSION_EMAIL = "administracion@sector-pro.com";
const MADRID_TIMEZONE = "Europe/Madrid";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYOUT_EMAIL_BODY_BYTES = 25 * 1024 * 1024;
const ADMIN_ROLES = new Set(["admin", "management"]);

interface JobMetadata {
  id: string;
  title: string;
  start_time?: string;
  tour_id?: string | null;
  invoicing_company?: string | null;
}

interface TechnicianPayload {
  technician_id: string;
  email: string;
  full_name?: string;
  totals?: {
    timesheets_total_eur?: number;
    extras_total_eur?: number;
    expenses_total_eur?: number;
    total_eur?: number;
    deduction_eur?: number;
  };
  pdf_base64: string;
  filename?: string;
  lpo_number?: string;
  worked_dates?: string[];
  prep_dates?: string[];
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
  is_evento?: boolean;
}

interface PayoutOverrideRow {
  technician_id: string;
  override_amount_eur: number | null;
}

interface PayoutEmailResult {
  technician_id: string;
  sent: boolean;
  error?: string;
}

interface JobPayoutRequestBody extends Record<string, unknown> {
  job?: JobMetadata;
  technicians?: TechnicianPayload[];
  missing_emails?: string[];
  requested_at?: string;
}

async function requireAdminOrManagement(
  supabaseAdmin: SupabaseClient,
  req: Request,
): Promise<{ userId: string; role: string }> {
  const token = requireBearerToken(req, {
    message: "Missing or malformed authorization header",
    code: "missing_authorization",
  });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    console.error("[send-job-payout-email] Token verification failed:", authError?.message);
    throw new HttpError(401, "Invalid or expired token", { code: "invalid_authorization" });
  }

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[send-job-payout-email] Profile lookup failed:", profileError.message);
    throw new HttpError(500, "Authorization lookup failed", {
      code: "authorization_lookup_failed",
      exposeDetails: false,
    });
  }

  const role = typeof callerProfile?.role === "string"
    ? callerProfile.role.toLowerCase()
    : "";

  if (!ADMIN_ROLES.has(role)) {
    console.warn("[send-job-payout-email] Forbidden: user", user.id, "role:", role || "<missing>");
    throw new HttpError(403, "Forbidden: insufficient permissions", {
      code: "insufficient_role",
    });
  }

  return { userId: user.id, role };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount?: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(Number(amount ?? 0));
}

function formatJobDate(dateIso?: string) {
  if (!dateIso) return 'fecha desconocida';
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return 'fecha desconocida';
  return formatLongDate(parsed);
}

function parseServiceDate(dateValue: string): Date | null {
  if (!dateValue) return null;

  if (DATE_ONLY_RE.test(dateValue)) {
    return fromZonedTime(`${dateValue}T12:00:00`, MADRID_TIMEZONE);
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseWorkedDates(dates?: string[]): Date[] {
  if (!dates?.length) return [];
  return dates
    .map((d) => parseServiceDate(d))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
}

function formatWorkedDatesFromParsed(parsed: Date[]): string {
  if (parsed.length === 0) return '';
  if (parsed.length === 1) {
    return `el ${formatLongDate(parsed[0])}`;
  }

  // Multiple dates - format as "los días X, Y y Z de mes de año"
  const dayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: MADRID_TIMEZONE });

  // Check if all dates are in the same month/year
  const firstDate = parsed[0];
  const firstMonthKey = formatInTimeZone(firstDate, MADRID_TIMEZONE, 'yyyy-MM');
  const sameMonth = parsed.every((d) => formatInTimeZone(d, MADRID_TIMEZONE, 'yyyy-MM') === firstMonthKey);

  if (sameMonth) {
    const days = parsed.map(d => dayFormatter.format(d));
    const lastDay = days.pop();
    const monthYear = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric',
      timeZone: MADRID_TIMEZONE,
    }).format(firstDate);
    return `los días ${days.join(', ')} y ${lastDay} de ${monthYear}`;
  } else {
    // Different months - list all dates
    const formatted = parsed.map((d) => formatLongDate(d));
    const lastDate = formatted.pop();
    return `los días ${formatted.join(', ')} y ${lastDate}`;
  }
}

function buildEventDateClause(dateText: string): string {
  const normalized = dateText.trim().toLowerCase();
  if (normalized.startsWith('los días')) {
    return `en <b>${escapeHtml(dateText)}</b>`;
  }
  if (normalized === 'fecha desconocida') {
    return 'en fecha desconocida';
  }
  if (normalized.startsWith('el ')) {
    return `<b>${escapeHtml(dateText)}</b>`;
  }
  return `de fecha <b>${escapeHtml(dateText)}</b>`;
}

interface PayoutEstimate {
  fromDate: Date;
  toDate: Date;
}

function getEstimatedPayoutFromDate(serviceDate: Date): Date {
  const madridDateStr = formatInTimeZone(serviceDate, MADRID_TIMEZONE, "yyyy-MM-dd");
  const [yearStr, monthStr, dayStr] = madridDateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  // month is 1-indexed from yyyy-MM-dd; JS Date expects 0-indexed month.
  const lastDayOfMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const closingDay = day <= 15 ? 15 : lastDayOfMonth;
  const closingDateStr = `${yearStr}-${monthStr}-${String(closingDay).padStart(2, "0")}T12:00:00`;
  const periodClosingDate = fromZonedTime(closingDateStr, MADRID_TIMEZONE);
  return addDays(periodClosingDate, 30);
}

function calculateEstimatedPayoutRange(serviceDates: Date[]): PayoutEstimate {
  if (serviceDates.length === 0) {
    throw new Error("calculateEstimatedPayoutRange requires at least one service date");
  }
  const payoutFromDates = serviceDates.map(getEstimatedPayoutFromDate);

  const earliestTs = Math.min(...payoutFromDates.map((d) => d.getTime()));
  const latestTs = Math.max(...payoutFromDates.map((d) => d.getTime()));

  return {
    fromDate: new Date(earliestTs),
    toDate: new Date(latestTs),
  };
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: MADRID_TIMEZONE }).format(date);
}

serve(createHttpHandler(async (req) => {
  const correlationId = getCorrelationId(req);
  const responseHeaders = correlationHeaders(correlationId);
  const respond = (body: unknown, status = 200) => jsonResponse(body, { status, headers: responseHeaders });

  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    BREVO_API_KEY: brevoKey,
    BREVO_FROM: brevoFrom,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BREVO_API_KEY", "BREVO_FROM"] as const,
    (name) => Deno.env.get(name),
  );

  // Service-role client for DB queries (bypasses RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await requireAdminOrManagement(supabaseAdmin, req);
  const body = await readBoundedJsonObject<JobPayoutRequestBody>(req, {
    maxBytes: MAX_PAYOUT_EMAIL_BODY_BYTES,
  });
  const DEBUG = Deno.env.get('DEBUG_PAYOUT_EMAILS') === 'true';

    // Avoid dumping base64 PDFs / PII into logs.
    console.log('[send-job-payout-email] Incoming payload', JSON.stringify(redactSensitiveValues({
      correlationId,
      actor_id: caller.userId,
      job: { id: body.job?.id, title: body.job?.title },
      technicians: body.technicians?.map(t => ({
        technician_id: t.technician_id,
        has_pdf: Boolean(t.pdf_base64),
        pdf_length: t.pdf_base64?.length ?? 0,
      })),
      technicians_count: body.technicians?.length ?? 0,
    })));

    if (DEBUG) {
      console.log('[send-job-payout-email][debug] Incoming payload (full)', {
        job: body.job,
        technicians_count: body.technicians?.length ?? 0,
      });
    }

    if (!body || !body.job || !body.job.id) {
      return respond({ success: false, error: 'Missing job metadata' }, 400);
    }

    if (!Array.isArray(body.technicians) || body.technicians.length === 0) {
      return respond({ success: false, error: 'No technician payloads received' }, 400);
    }

    const job = body.job;
    const technicians = body.technicians;

    // Preload payout overrides for this job (so email totals never depend on client-side enrichment)
    const technicianIds = technicians.map((t) => t.technician_id).filter(Boolean);
    const overrideMap = new Map<string, number>();
    if (technicianIds.length > 0) {
      const { data: overrides, error: overrideError } = await supabaseAdmin
        .from("job_technician_payout_overrides")
        .select("technician_id, override_amount_eur")
        .eq("job_id", job.id)
        .in("technician_id", technicianIds);

      if (overrideError) {
        console.error('[send-job-payout-email] Failed to fetch overrides', overrideError);
      } else {
        (overrides as PayoutOverrideRow[] | null | undefined)?.forEach((row) => {
          if (!row?.technician_id) return;
          if (row.override_amount_eur == null) return;
          overrideMap.set(row.technician_id, Number(row.override_amount_eur));
        });
      }
    }

    // Corporate assets (logos)
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || `${supabaseUrl}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || `${supabaseUrl}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;
    const todayEstimate = calculateEstimatedPayoutRange([new Date()]);
    const todayEstimateText = escapeHtml(`a partir del ${formatLongDate(todayEstimate.fromDate)}`);

    const configuredConcurrency = Number(Deno.env.get('PAYOUT_EMAIL_CONCURRENCY') || 3);
    const emailConcurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
      ? Math.min(5, Math.floor(configuredConcurrency))
      : 3;
    const results = await mapWithConcurrency<TechnicianPayload, PayoutEmailResult>(
      technicians,
      emailConcurrency,
      async (tech) => {
      const trimmedEmail = (tech.email || '').trim();
      const pdfBase64 = (tech.pdf_base64 || '').trim();

      if (!trimmedEmail) {
        return { technician_id: tech.technician_id, sent: false, error: 'missing_email' };
      }
      if (!pdfBase64) {
        console.error('[send-job-payout-email] Missing PDF for technician:', tech.technician_id);
        return { technician_id: tech.technician_id, sent: false, error: 'missing_pdf' };
      }
      if (DEBUG) {
        console.log(`[send-job-payout-email][debug] PDF length for technician: ${tech.technician_id}`, {
          pdfLength: pdfBase64.length,
        });
      }

      const normalizedJobTitle = (job.title || '').trim();
      const escapedJobTitle = escapeHtml(normalizedJobTitle);
      const subject = normalizedJobTitle
        ? `Resumen de pagos · ${normalizedJobTitle}`
        : 'Resumen de pagos';

      // Corporate-styled HTML, aligned with other emails
      const safeName = escapeHtml(tech.full_name || '');
      const workedServiceDates = parseWorkedDates(tech.worked_dates);
      const prepServiceDates = parseWorkedDates(tech.prep_dates);
      const workedDatesText = formatWorkedDatesFromParsed(workedServiceDates);
      const prepDatesText = prepServiceDates.length > 0 ? formatWorkedDatesFromParsed(prepServiceDates) : '';
      const fallbackJobDate = formatJobDate(job.start_time);
      const dateText =
        workedDatesText ||
        (fallbackJobDate === 'fecha desconocida' ? 'fecha desconocida' : `el ${fallbackJobDate}`);
      const eventDateClause = buildEventDateClause(dateText);
      const parts = formatCurrency(tech.totals?.timesheets_total_eur);
      const extras = formatCurrency(tech.totals?.extras_total_eur);
      const expensesAmount = tech.totals?.expenses_total_eur ?? 0;
      const expensesFormatted = formatCurrency(expensesAmount);
      const hasExpenses = expensesAmount > 0;

      const deductionAmount = tech.totals?.deduction_eur ?? 0;
      const deductionFormatted = formatCurrency(deductionAmount);
      const hasDeduction = deductionAmount > 0;

      const jobFallbackServiceDate = job.start_time ? parseServiceDate(job.start_time) : null;
      const estimateSourceDates = workedServiceDates.length > 0
        ? workedServiceDates
        : (jobFallbackServiceDate ? [jobFallbackServiceDate] : []);
      const payoutEstimate = estimateSourceDates.length > 0
        ? calculateEstimatedPayoutRange(estimateSourceDates)
        : null;
      const rawPayoutEstimateText = payoutEstimate
        ? (payoutEstimate.fromDate.getTime() === payoutEstimate.toDate.getTime()
          ? `a partir del ${formatLongDate(payoutEstimate.fromDate)}`
          : `entre el ${formatLongDate(payoutEstimate.fromDate)} y el ${formatLongDate(payoutEstimate.toDate)}`)
        : null;
      const payoutEstimateText = rawPayoutEstimateText ? escapeHtml(rawPayoutEstimateText) : null;

      // Prefer DB overrides when present (PDF already reflects override; email body must match)
      const overrideAmount = overrideMap.get(tech.technician_id);
      const totalFromPayload = Number(tech.totals?.total_eur ?? 0);
      const effectiveTotal = overrideAmount != null ? overrideAmount - deductionAmount : totalFromPayload;
      const grand = formatCurrency(effectiveTotal);
      const invoicingCompany = job.invoicing_company;

      const companyDetails = getInvoicingCompanyDetails(invoicingCompany);
      if (DEBUG) {
        console.log('[send-job-payout-email][debug] Company details resolved:', companyDetails ? 'FOUND' : 'NULL');
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
                          ${COMPANY_LOGO_URL ? `<a href="https://www.sector-pro.com" target="_blank" rel="noopener noreferrer"><img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" /></a>` : ''}
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          ${AT_LOGO_URL ? `<a href="https://sector-pro.work" target="_blank" rel="noopener noreferrer"><img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" /></a>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${safeName || 'equipo'},</h2>
                      <p style="margin:0;color:#374151;line-height:1.55;">
                        El detalle económico de los trabajos realizados en el evento <b>${escapedJobTitle}</b> ${eventDateClause}, según acuerdo previo, es el siguiente:
                      </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 24px 0 24px;">
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;">
                      <b>Totales registrados</b>
                      <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                        <li><b>Partes aprobados:</b> ${parts}</li>
                        <li><b>Extras:</b> ${extras}</li>
                        ${hasExpenses ? `<li><b>Gastos aprobados:</b> ${expensesFormatted}</li>` : ''}
                       ${hasDeduction ? `<li><b style="color:#b91c1c;">Deducción IRPF (estimada):</b> -${deductionFormatted}</li>` : ''}
                        <li><b>Total general:</b> ${grand}</li>
                      </ul>
                       ${hasDeduction ? `<p style="margin:10px 0 0 0;font-size:12px;color:#b91c1c;">* Se ha aplicado una deducción de 30€/día por condición de no autónomo.</p>` : ''}
                       ${tech.is_evento ? `<p style="margin:10px 0 0 0;font-size:12px;color:#6b7280;">* Evento: tarifa fija de 12h (base + plus) independientemente de las horas trabajadas.</p>` : ''}
                       ${prepDatesText ? `<p style="margin:10px 0 0 0;font-size:12px;color:#2563eb;">* Incluye día(s) de preparación (${escapeHtml(prepDatesText)}), calculados a 15€/h sobre horas redondeadas.</p>` : ''}
                    </div>
                  </td>
                </tr>
                ${(() => {
                  // Only show invoicing details for autonomo technicians (excluding house techs)
                  if (tech.autonomo !== true || tech.is_house_tech === true) return '';
                  return `
                <tr>
                  <td style="padding:12px 24px 0 24px;">
                    <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:12px 14px;color:#1e40af;font-size:14px;">
                      <b>Nota de facturación:</b>
                      <ul style="margin:8px 0 0 18px;padding:0;line-height:1.55;">
                        ${companyDetails ? `<li><b>Empresa de facturación:</b> ${escapeHtml(companyDetails.legalName)} (CIF: ${escapeHtml(companyDetails.cif)}, ${escapeHtml(companyDetails.address)})</li>` : ''}
                        ${tech.lpo_number ? `<li><b>LPO:</b> ${escapeHtml(tech.lpo_number)}</li>` : ''}
                        <li><b>Enviar factura a:</b> <a href="mailto:${INVOICE_SUBMISSION_EMAIL}" style="color:#1e40af;text-decoration:underline;">${INVOICE_SUBMISSION_EMAIL}</a></li>
                      </ul>
                    </div>
                  </td>
                </tr>
                `;
                })()}
                <tr>
                  <td style="padding:16px 24px 8px 24px;">
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      Si detectas alguna incidencia no respondas a este mensaje y contacta con administración.
                    </p>
                    <div style="margin-top:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;color:#1e3a8a;font-size:14px;line-height:1.55;">
                      <b>FORMA DE PAGO</b>
                      <p style="margin:8px 0 0 0;">
                        El pago de los servicios se realizará de forma quincenal conforme al siguiente calendario:
                      </p>
                      <ul style="margin:8px 0 0 18px;padding:0;line-height:1.55;">
                        <li>Los servicios prestados entre el día 1 y el día 15 de cada mes serán abonados en un plazo no inferior a 30 días naturales contados a partir del día 15 del mismo mes.</li>
                        <li>Los servicios prestados entre el día 16 y el último día del mes serán abonados en un plazo no inferior a 30 días naturales contados a partir del último día del mes correspondiente.</li>
                      </ul>
                      <p style="margin:8px 0 0 0;">
                        El pago quedará supeditado a la correcta cumplimentación y validación de los partes de trabajo y/o hojas de horas correspondientes, dentro de los términos establecidos.
                      </p>
                      ${payoutEstimateText ? `<p style="margin:10px 0 0 0;"><b>Estimación para este trabajo:</b> ${payoutEstimateText}.</p>` : ''}
                      <p style="margin:6px 0 0 0;"><b>Si emites la factura hoy:</b> puedes esperar el pago ${todayEstimateText}.</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
                    <div style="margin-bottom:8px;">
                      Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
                    </div>
                    <div>
                      Sector Pro · <a href="https://www.sector-pro.com" style="color:#6b7280;text-decoration:underline;">www.sector-pro.com</a>
                      &nbsp;|&nbsp; Área Técnica · <a href="https://sector-pro.work" style="color:#6b7280;text-decoration:underline;">sector-pro.work</a>
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
        sender: { email: brevoFrom, name: 'Área Técnica' },
        to: [{ email: trimmedEmail, name: tech.full_name || undefined }],
        subject,
        htmlContent,
        attachment: [
          {
            content: pdfBase64,
            name: tech.filename || `pago_${job.id}_${tech.technician_id}.pdf`,
          },
        ],
      };

      // Always CC administration
      emailPayload['cc'] = [{ email: 'administracion@mfo-producciones.com' }];

      if (DEBUG) {
        console.log('[send-job-payout-email][debug] Sending email with attachment:', {
          to: '***',
          pdfLength: pdfBase64.length,
          filename: tech.filename || `pago_${job.id}_${tech.technician_id}.pdf`,
        });
      }

      try {
        const sendRes = await sendBrevoEmail(brevoKey, emailPayload, { timeoutMs: 10000 });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error('[send-job-payout-email] Brevo error', sendRes.status, errText);
          return { technician_id: tech.technician_id, sent: false, error: errText || sendRes.statusText };
        }
        return { technician_id: tech.technician_id, sent: true };
      } catch (err) {
        console.error('[send-job-payout-email] Failed to send email', err);
        return { technician_id: tech.technician_id, sent: false, error: (err as Error).message };
      }
      },
    );

    const success = results.every((r) => r.sent);
    return respond(
      {
        success,
        results,
        job,
        missing_emails: body.missing_emails || [],
        requested_at: body.requested_at || new Date().toISOString(),
      },
    );
}, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Payout email request failed",
  onError(error, req) {
    console.error("[send-job-payout-email] Request failed", JSON.stringify(redactSensitiveValues({
      correlationId: getCorrelationId(req),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    })));
  },
}));
