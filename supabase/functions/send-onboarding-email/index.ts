import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingRequestBody {
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
}

// Helper to pick a base URL for links in the email
function pickEnvBase(): string | undefined {
  const candidates = [
    Deno.env.get('PUBLIC_APP_URL'),
    Deno.env.get('PUBLIC_SITE_URL'),
    Deno.env.get('NEXT_PUBLIC_SITE_URL'),
    Deno.env.get('SITE_URL'),
    Deno.env.get('PUBLIC_CONFIRM_BASE'),
  ];
  for (const val of candidates) {
    if (val && val.trim()) return val.trim();
  }
  return undefined;
}

function toOrigin(input?: string): string | undefined {
  if (!input) return undefined;
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  } catch {
    return input.replace(/\/$/, '');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, department }: OnboardingRequestBody = await req.json();
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!;
    const BREVO_FROM = Deno.env.get('BREVO_FROM')!;
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    if (!BREVO_KEY || !BREVO_FROM) {
      return new Response(JSON.stringify({ error: 'Missing Brevo configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Compute base URL for CTA links
    const envBaseRaw = pickEnvBase();
    const envBase = toOrigin(envBaseRaw);
    const rawOrigin = req.headers.get('origin') || req.headers.get('referer');
    const originBase = rawOrigin ? toOrigin(rawOrigin.split('?')[0]) : undefined;
    const baseUrl = envBase || originBase || 'http://localhost:3000';

    const userName = (firstName || normalizedEmail.split('@')[0] || 'Técnico');
    const deptLabel = department ? department.charAt(0).toUpperCase() + department.slice(1) : undefined;

    // Key links
    const technicianDashboardUrl = `${baseUrl}/technician-dashboard`;
    const availabilityUrl = `${baseUrl}/dashboard/unavailability`;
    const timesheetsUrl = `${baseUrl}/timesheets`;
    const manualUrl = `${baseUrl}/manual`;
    const profileUrl = `${baseUrl}/profile`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a Área Técnica</title>
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
                          <img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${userName}${deptLabel ? ` (${deptLabel})` : ''},</h2>
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      ¡Bienvenido/a a Área Técnica! Hemos preparado este panel para que gestiones tu trabajo de forma rápida y sencilla.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 0 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <a href="${technicianDashboardUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir Panel de Técnico</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;color:#374151;font-size:14px;">
                      <b>Cómo usar el Panel del Técnico</b>
                      <ul style="margin:10px 0 0 18px;padding:0;line-height:1.55;">
                        <li><b>Tarjeta "Próximos Trabajos"</b>: revisa tus próximos servicios con fechas, horarios y ubicaciones.</li>
                        <li><b>Botón "Confirmar/Declinar"</b>: responde a tus asignaciones directamente cuando recibas solicitudes.</li>
                        <li><b>Tarjeta "Disponibilidad"</b>: marca tus días disponibles/no disponibles para que planificación te tenga en cuenta.</li>
                        <li><b>Tarjeta "Timesheets"</b>: completa tus horas trabajadas y mantén tus registros al día.</li>
                        <li><b>Accesos rápidos</b>: en la parte superior verás botones para acceder a Disponibilidad, Timesheets y tu Perfil.</li>
                      </ul>
                    </div>
                    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
                      <a href="${availabilityUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Actualizar Disponibilidad</a>
                      <a href="${timesheetsUrl}" style="display:inline-block;background:#f59e0b;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700;">Abrir Timesheets</a>
                      <a href="${profileUrl}" style="display:inline-block;background:#e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700;">Perfil</a>
                      <a href="${manualUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700;">Manual</a>
                    </div>
                    <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
                      ¿No puedes iniciar sesión? En la pantalla de acceso pulsa "Olvidé mi contraseña" y recibirás un enlace para restablecerla.
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
      </html>
    `;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: BREVO_FROM,
          name: 'Sistema de Gestión',
        },
        to: [{ email: normalizedEmail, name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || undefined }],
        subject: 'Bienvenido/a · Panel del Técnico y primeros pasos',
        htmlContent,
      }),
    });

    if (!brevoRes.ok) {
      const msg = await brevoRes.text();
      console.error('[send-onboarding-email] Brevo error:', msg);
      return new Response(JSON.stringify({ error: 'Brevo API failed', details: msg }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[send-onboarding-email] Error:', err);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
