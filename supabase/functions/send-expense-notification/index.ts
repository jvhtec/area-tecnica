import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "";
const EXPENSE_NOTIFICATION_BCC = Deno.env.get("EXPENSE_NOTIFICATION_BCC") ?? "";

interface ExpenseNotificationPayload {
  expense_id: string;
  job_id: string;
  job_title: string;
  technician_email: string;
  technician_name: string;
  category_label: string;
  amount_eur: number;
  expense_date: string;
  status: 'submitted' | 'approved' | 'rejected';
  rejection_reason?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  try {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(parsed);
  } catch {
    return dateStr;
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
    const payload = (await req.json()) as ExpenseNotificationPayload;
    console.log('[send-expense-notification] Incoming payload', JSON.stringify(payload, null, 2));

    if (!payload || !payload.expense_id || !payload.technician_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = payload.technician_email.trim();
    if (!trimmedEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Corporate assets
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png` : '');
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png` : '');

    let subject: string;
    let statusText: string;
    let statusColor: string;
    let messageText: string;

    switch (payload.status) {
      case 'submitted':
        subject = `Gasto enviado para aprobación · ${payload.job_title}`;
        statusText = 'Enviado para Aprobación';
        statusColor = '#3b82f6';
        messageText = 'Tu gasto ha sido enviado correctamente y está pendiente de revisión por parte de administración.';
        break;
      case 'approved':
        subject = `Gasto aprobado · ${payload.job_title}`;
        statusText = 'Aprobado';
        statusColor = '#10b981';
        messageText = 'Tu gasto ha sido aprobado y se incluirá en el próximo pago.';
        break;
      case 'rejected':
        subject = `Gasto rechazado · ${payload.job_title}`;
        statusText = 'Rechazado';
        statusColor = '#ef4444';
        messageText = 'Tu gasto ha sido rechazado. Por favor, revisa el motivo a continuación y contacta con administración si tienes dudas.';
        break;
      default:
        subject = `Actualización de gasto · ${payload.job_title}`;
        statusText = payload.status;
        statusColor = '#6b7280';
        messageText = 'El estado de tu gasto ha sido actualizado.';
    }

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
                  <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${payload.technician_name || 'equipo'},</h2>
                  <p style="margin:0;color:#374151;line-height:1.55;">
                    ${messageText}
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
                          <span style="display:inline-block;background:${statusColor};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${statusText}</span>
                        </td>
                      </tr>
                    </table>
                    <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                      <li><b>Trabajo:</b> ${payload.job_title}</li>
                      <li><b>Categoría:</b> ${payload.category_label}</li>
                      <li><b>Fecha del gasto:</b> ${formatDate(payload.expense_date)}</li>
                      <li><b>Importe:</b> ${formatCurrency(payload.amount_eur)}</li>
                    </ul>
                    ${payload.status === 'rejected' && payload.rejection_reason ? `
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">
                      <b>Motivo del rechazo:</b><br/>
                      <span style="color:#ef4444;">${payload.rejection_reason}</span>
                    </div>
                    ` : ''}
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
      sender: { email: BREVO_FROM, name: 'Área Técnica' },
      to: [{ email: trimmedEmail, name: payload.technician_name || undefined }],
      subject,
      htmlContent,
    };

    // Add BCC for admin/finanzas shadow notification
    if (EXPENSE_NOTIFICATION_BCC) {
      emailPayload['bcc'] = [{ email: EXPENSE_NOTIFICATION_BCC }];
    }

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
      console.error('[send-expense-notification] Brevo error', sendRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: errText || sendRes.statusText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-expense-notification] Email sent successfully', payload.expense_id);
    return new Response(
      JSON.stringify({
        success: true,
        expense_id: payload.expense_id,
        status: payload.status,
        sent_to: trimmedEmail,
        bcc_sent: !!EXPENSE_NOTIFICATION_BCC,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[send-expense-notification] Unexpected error', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
