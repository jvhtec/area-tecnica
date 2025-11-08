import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user is authenticated and has management permissions
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check user role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'management')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only management can send reminder emails' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { timesheetId } = await req.json()

    if (!timesheetId) {
      return new Response(JSON.stringify({ error: 'Missing timesheetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch timesheet with technician and job details
    const { data: timesheet, error: timesheetError } = await supabaseClient
      .from('timesheets')
      .select(`
        *,
        technician:profiles!timesheets_technician_id_fkey(
          id,
          first_name,
          last_name,
          nickname,
          email
        ),
        job:jobs(
          id,
          title,
          client_name
        )
      `)
      .eq('id', timesheetId)
      .single()

    if (timesheetError || !timesheet) {
      return new Response(JSON.stringify({ error: 'Timesheet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only send reminders for draft or submitted timesheets
    if (timesheet.status === 'approved') {
      return new Response(
        JSON.stringify({ error: 'Cannot send reminder for approved timesheet' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const technician = timesheet.technician as any
    const job = timesheet.job as any

    if (!technician?.email) {
      return new Response(JSON.stringify({ error: 'Technician email not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare email content
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
    const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "";
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') ||
      `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') ||
      `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    const techName = technician.nickname || technician.first_name;
    const jobTitle = job?.title || 'trabajo desconocido';
    const subject = `Recordatorio: Parte de horas pendiente - ${jobTitle}`;

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
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">

          <!-- Header with logos -->
          <tr>
            <td style="padding:16px 20px;background:#0b0b0b;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px;color:#111827;font-size:15px;line-height:1.6;">
              <div style="margin-bottom:16px;">
                Hola ${techName},
              </div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:0 24px 24px 24px;">
              <div style="background:#eef2ff;border-left:4px solid #6366f1;padding:16px 20px;margin-bottom:20px;border-radius:4px;">
                <div style="color:#374151;font-size:15px;line-height:1.6;">
                  Te recordamos que tienes partes de horas pendientes de rellenar para el trabajo: <strong>${jobTitle}</strong>, te rogamos completes los partes para su aprobación, una vez aprobados obtendrás un informe de los importes a facturar y la referencia que has de adjuntar a la factura.
                </div>
              </div>

              <!-- Job details -->
              <div style="margin-bottom:20px;">
                <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                  <tr>
                    <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">
                      Detalles del Parte
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                      <strong>Trabajo:</strong> ${jobTitle}
                    </td>
                  </tr>
                  ${job?.client_name ? `
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                      <strong>Cliente:</strong> ${job.client_name}
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                      <strong>Fecha:</strong> ${new Date(timesheet.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;">
                      <strong>Estado:</strong> ${timesheet.status === 'draft' ? 'Borrador' : 'Enviado'}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center;margin:24px 0;">
                <a href="https://area-tecnica.lovable.app/timesheets"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">
                  Completar Parte de Horas
                </a>
              </div>

              <div style="color:#6b7280;font-size:14px;line-height:1.5;margin-top:20px;">
                Si tienes alguna duda, no dudes en contactar con el equipo de gestión.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
              <div style="margin-bottom:8px;">
                Este correo es confidencial y puede contener información privilegiada. Si ha recibido este mensaje por error, le rogamos que lo elimine y nos lo comunique inmediatamente.
              </div>
              <div>
                Sector Pro · <a href="https://www.sector-pro.com" style="color:#6366f1;text-decoration:none;">www.sector-pro.com</a>
                &nbsp;|&nbsp; Área Técnica · <a href="https://area-tecnica.lovable.app" style="color:#6366f1;text-decoration:none;">area-tecnica.lovable.app</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email via Brevo
    const emailPayload = {
      sender: {
        email: BREVO_FROM,
        name: "Área Técnica - Sector Pro"
      },
      to: [
        {
          email: technician.email,
          name: `${technician.first_name} ${technician.last_name}`
        }
      ],
      subject,
      htmlContent
    };

    const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      console.error('Brevo API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const brevoResponse = await sendRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        messageId: brevoResponse.messageId,
        sentTo: technician.email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error sending timesheet reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
