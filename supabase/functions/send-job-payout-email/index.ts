import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "";
const ADMIN_BCC = Deno.env.get("PAYOUT_EMAIL_BCC") ?? "";

interface JobMetadata {
  id: string;
  title: string;
  start_time?: string;
  tour_id?: string | null;
}

interface TechnicianPayload {
  technician_id: string;
  email: string;
  full_name?: string;
  totals?: {
    timesheets_total_eur?: number;
    extras_total_eur?: number;
    total_eur?: number;
  };
  pdf_base64: string;
  filename?: string;
}

interface JobPayoutRequestBody {
  job?: JobMetadata;
  technicians?: TechnicianPayload[];
  missing_emails?: string[];
  requested_at?: string;
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
    const body = (await req.json()) as JobPayoutRequestBody;
    console.log('[send-job-payout-email] Incoming payload', JSON.stringify(body, null, 2));

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

    // Corporate assets (logos)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png` : '');
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png` : '');

    for (const tech of body.technicians) {
      const trimmedEmail = (tech.email || '').trim();
      const pdfBase64 = (tech.pdf_base64 || '').trim();

      if (!trimmedEmail) {
        results.push({ technician_id: tech.technician_id, sent: false, error: 'missing_email' });
        continue;
      }
      if (!pdfBase64) {
        results.push({ technician_id: tech.technician_id, sent: false, error: 'missing_pdf' });
        continue;
      }

      const subject = `Resumen de pagos · ${body.job.title}`;

      // Corporate-styled HTML, aligned with other emails
      const safeName = tech.full_name || '';
      const jobDate = formatJobDate(body.job.start_time);
      const parts = formatCurrency(tech.totals?.timesheets_total_eur);
      const extras = formatCurrency(tech.totals?.extras_total_eur);
      const grand = formatCurrency(tech.totals?.total_eur);

      const htmlContent = `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
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
                          ${COMPANY_LOGO_URL ? `<img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />` : ''}
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          ${AT_LOGO_URL ? `<img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${safeName || 'equipo'},</h2>
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      Adjuntamos tu resumen de pagos correspondiente al trabajo <b>${body.job.title}</b>, programado para el <b>${jobDate}</b>.
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
                        <li><b>Total general:</b> ${grand}</li>
                      </ul>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 8px 24px;">
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      El documento PDF con el detalle va adjunto a este correo.
                    </p>
                    <p style="margin:8px 0 0 0;color:#374151;line-height:1.55;">
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
        sender: { email: BREVO_FROM, name: 'Área Técnica' },
        to: [{ email: trimmedEmail, name: tech.full_name || undefined }],
        subject,
        htmlContent,
        attachments: [
          {
            content: pdfBase64,
            name: tech.filename || `pago_${body.job.id}_${tech.technician_id}.pdf`,
          },
        ],
      };

      if (ADMIN_BCC) {
        emailPayload['bcc'] = [{ email: ADMIN_BCC }];
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
