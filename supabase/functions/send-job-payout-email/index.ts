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
      const htmlContent = `
        <p>Hola ${tech.full_name || 'equipo'},</p>
        <p>Adjuntamos tu resumen de pagos correspondiente al trabajo <strong>${body.job.title}</strong>, programado para el <strong>${formatJobDate(body.job.start_time)}</strong>.</p>
        <p>Totales registrados:</p>
        <ul>
          <li>Partes aprobados: <strong>${formatCurrency(tech.totals?.timesheets_total_eur)}</strong></li>
          <li>Extras: <strong>${formatCurrency(tech.totals?.extras_total_eur)}</strong></li>
          <li>Total general: <strong>${formatCurrency(tech.totals?.total_eur)}</strong></li>
        </ul>
        <p>Si detectas alguna incidencia puedes responder a este mensaje o contactar con administración.</p>
        <p>Saludos,<br/>Área Técnica</p>
      `;

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
