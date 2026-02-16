import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getInvoicingCompanyDetails } from "../_shared/invoicing-company-data.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "";
const ADMIN_BCC = Deno.env.get("PAYOUT_EMAIL_BCC") ?? "";

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
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
  is_evento?: boolean;
}

interface PayoutOverrideRow {
  technician_id: string;
  override_amount_eur: number | null;
}

interface JobPayoutRequestBody {
  job?: JobMetadata;
  technicians?: TechnicianPayload[];
  missing_emails?: string[];
  requested_at?: string;
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
  if (!dateIso) return 'sin fecha';
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return 'sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(parsed);
}

function formatWorkedDates(dates?: string[]): string {
  if (!dates || dates.length === 0) return '';

  const parsed = dates
    .map(d => new Date(d))
    .filter(d => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (parsed.length === 0) return '';
  if (parsed.length === 1) {
    return 'el ' + new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(parsed[0]);
  }

  // Multiple dates - format as "los días X, Y y Z de mes de año"
  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const dayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric' });

  // Check if all dates are in the same month/year
  const firstDate = parsed[0];
  const sameMonth = parsed.every(d =>
    d.getMonth() === firstDate.getMonth() && d.getFullYear() === firstDate.getFullYear()
  );

  if (sameMonth) {
    const days = parsed.map(d => dayFormatter.format(d));
    const lastDay = days.pop();
    const monthYear = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(firstDate);
    return `los días ${days.join(', ')} y ${lastDay} de ${monthYear}`;
  } else {
    // Different months - list all dates
    const formatted = parsed.map(d => formatter.format(d));
    const lastDate = formatted.pop();
    return `los días ${formatted.join(', ')} y ${lastDate}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  if (!BREVO_KEY || !BREVO_FROM) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Email channel not configured',
        missing_env: [
          ...(BREVO_KEY ? [] : ['BREVO_API_KEY']),
          ...(BREVO_FROM ? [] : ['BREVO_FROM']),
        ],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Service-role client for DB queries (bypasses RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Authorization: verify caller is admin or management ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or malformed authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('[send-job-payout-email] Token verification failed:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[send-job-payout-email] Profile lookup failed:', profileError.message);
    }

    if (!callerProfile || !['admin', 'management'].includes(callerProfile.role)) {
      console.warn('[send-job-payout-email] Forbidden: user', user.id, 'role:', callerProfile?.role);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as JobPayoutRequestBody;
    const DEBUG = Deno.env.get('DEBUG_PAYOUT_EMAILS') === 'true';

    // Avoid dumping base64 PDFs / PII into logs.
    console.log('[send-job-payout-email] Incoming payload', JSON.stringify({
      job: { id: body.job?.id, title: body.job?.title },
      technicians: body.technicians?.map(t => ({
        technician_id: t.technician_id,
        has_pdf: Boolean(t.pdf_base64),
        pdf_length: t.pdf_base64?.length ?? 0,
      })),
      technicians_count: body.technicians?.length ?? 0,
    }));

    if (DEBUG) {
      console.log('[send-job-payout-email][debug] Incoming payload (full)', {
        job: body.job,
        technicians_count: body.technicians?.length ?? 0,
      });
    }

    if (!body || !body.job || !body.job.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing job metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(body.technicians) || body.technicians.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No technician payloads received' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ technician_id: string; sent: boolean; error?: string }> = [];

    // Preload payout overrides for this job (so email totals never depend on client-side enrichment)
    const technicianIds = body.technicians.map((t) => t.technician_id).filter(Boolean);
    const overrideMap = new Map<string, number>();
    if (technicianIds.length > 0) {
      const { data: overrides, error: overrideError } = await supabaseAdmin
        .from("job_technician_payout_overrides")
        .select("technician_id, override_amount_eur")
        .eq("job_id", body.job.id)
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
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    for (const tech of body.technicians) {
      const trimmedEmail = (tech.email || '').trim();
      const pdfBase64 = (tech.pdf_base64 || '').trim();

      if (!trimmedEmail) {
        results.push({ technician_id: tech.technician_id, sent: false, error: 'missing_email' });
        continue;
      }
      if (!pdfBase64) {
        console.error('[send-job-payout-email] Missing PDF for technician:', tech.technician_id);
        results.push({ technician_id: tech.technician_id, sent: false, error: 'missing_pdf' });
        continue;
      }
      if (DEBUG) {
        console.log(`[send-job-payout-email][debug] PDF length for technician: ${tech.technician_id}`, {
          pdfLength: pdfBase64.length,
        });
      }

      const escapedJobTitle = escapeHtml(body.job.title || '');
      const subject = `Resumen de pagos · ${body.job.title}`;

      // Corporate-styled HTML, aligned with other emails
      const safeName = escapeHtml(tech.full_name || '');
      const workedDatesText = formatWorkedDates(tech.worked_dates);
      const fallbackJobDate = formatJobDate(body.job.start_time);
      const dateText = workedDatesText || `el ${fallbackJobDate}`;
      const parts = formatCurrency(tech.totals?.timesheets_total_eur);
      const extras = formatCurrency(tech.totals?.extras_total_eur);
      const expensesAmount = tech.totals?.expenses_total_eur ?? 0;
      const expensesFormatted = formatCurrency(expensesAmount);
      const hasExpenses = expensesAmount > 0;

      const deductionAmount = tech.totals?.deduction_eur ?? 0;
      const deductionFormatted = formatCurrency(deductionAmount);
      const hasDeduction = deductionAmount > 0;

      // Prefer DB overrides when present (PDF already reflects override; email body must match)
      const overrideAmount = overrideMap.get(tech.technician_id);
      const totalFromPayload = Number(tech.totals?.total_eur ?? 0);
      const effectiveTotal = overrideAmount != null ? overrideAmount - deductionAmount : totalFromPayload;
      const grand = formatCurrency(effectiveTotal);
      const invoicingCompany = body.job.invoicing_company;

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
                        Adjuntamos tu resumen de pagos correspondiente al trabajo <b>${escapedJobTitle}</b>, realizado <b>${dateText}</b>.
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
                    </div>
                  </td>
                </tr>
                ${(() => {
                  // Only show invoicing details for autonomo technicians (excluding house techs)
                  if (tech.autonomo !== true || tech.is_house_tech === true) return '';
                  if (!companyDetails && !tech.lpo_number) return '';
                  return `
                <tr>
                  <td style="padding:12px 24px 0 24px;">
                    <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:12px 14px;color:#1e40af;font-size:14px;">
                      <b>Nota de facturación:</b>
                      <p style="margin:8px 0 0 0;line-height:1.55;">
                        ${companyDetails ? `Te rogamos emitas tu factura a: <b>${escapeHtml(companyDetails.legalName)}</b> (CIF: ${escapeHtml(companyDetails.cif)}, ${escapeHtml(companyDetails.address)})` : ''}${companyDetails && tech.lpo_number ? ' e incluyas el siguiente número de referencia: ' : ''}${tech.lpo_number ? `<b>${escapeHtml(tech.lpo_number)}</b>` : ''}.
                      </p>
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
        sender: { email: BREVO_FROM, name: 'Área Técnica' },
        to: [{ email: trimmedEmail, name: tech.full_name || undefined }],
        subject,
        htmlContent,
        attachment: [
          {
            content: pdfBase64,
            name: tech.filename || `pago_${body.job.id}_${tech.technician_id}.pdf`,
          },
        ],
      };

      // Always CC administration
      emailPayload['cc'] = [{ email: 'administracion@mfo-producciones.com' }];

      if (DEBUG) {
        console.log('[send-job-payout-email][debug] Sending email with attachment:', {
          to: '***',
          pdfLength: pdfBase64.length,
          filename: tech.filename || `pago_${body.job.id}_${tech.technician_id}.pdf`,
        });
      }

      try {
        const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload),
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error('[send-job-payout-email] Brevo error', sendRes.status, errText);
          results.push({ technician_id: tech.technician_id, sent: false, error: errText || sendRes.statusText });
        } else {
          results.push({ technician_id: tech.technician_id, sent: true });
        }
      } catch (err) {
        console.error('[send-job-payout-email] Failed to send email', err);
        results.push({ technician_id: tech.technician_id, sent: false, error: (err as Error).message });
      }
    }

    const success = results.every((r) => r.sent);
    return new Response(
      JSON.stringify({
        success,
        results,
        job: body.job,
        missing_emails: body.missing_emails || [],
        requested_at: body.requested_at || new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[send-job-payout-email] Unexpected error', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
