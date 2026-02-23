import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log incoming request
    console.log('=== send-timesheet-reminder invoked ===');
    console.log('Headers received:', {
      hasAuth: !!req.headers.get('Authorization'),
      authHeader: req.headers.get('Authorization')?.substring(0, 20) + '...',
    });

    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract JWT and decode to get user ID
    // Since verify_jwt=true, Supabase has already validated the token
    const jwt = authHeader.replace('Bearer ', '');
    let userId: string;
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub;
      console.log('Decoded user ID from JWT:', userId);
    } catch (decodeError) {
      console.error('Failed to decode JWT:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking user role for:', userId);

    // Check user role using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify user permissions' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'management')) {
      console.log('User does not have required role:', profile?.role);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only management can send reminder emails' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('User authorized, role:', profile.role);

    const { timesheetId } = await req.json();
    console.log('Processing timesheet ID:', timesheetId);

    if (!timesheetId) {
      console.error('Missing timesheetId in request body');
      return new Response(JSON.stringify({ error: 'Missing timesheetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch timesheet using admin client
    const { data: timesheet, error: timesheetError } = await supabaseAdmin
      .from('timesheets')
      .select('*')
      .eq('id', timesheetId)
      .single()

    if (timesheetError || !timesheet) {
      console.error('Timesheet not found:', timesheetError);
      return new Response(JSON.stringify({ error: 'Timesheet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch job details separately since there's no foreign key
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .eq('id', timesheet.job_id)
      .single()

    if (jobError) {
      console.error('Job not found:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch technician details separately since there's no foreign key
    const { data: technician, error: technicianError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, nickname, email')
      .eq('id', timesheet.technician_id)
      .single()

    if (technicianError || !technician) {
      console.error('Technician not found:', technicianError);
      return new Response(JSON.stringify({ error: 'Technician not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Timesheet found, status:', timesheet.status);
    console.log('Job found:', job.title);
    console.log('Technician found:', technician.email);

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

    const timesheetUrl = `https://sector-pro.work/timesheets?jobId=${timesheet.job_id}`;

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
                    <a href="https://www.sector-pro.com" target="_blank" rel="noopener noreferrer">
                      <img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <a href="https://sector-pro.work" target="_blank" rel="noopener noreferrer">
                      <img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />
                    </a>
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
                  Te recordamos que tienes partes de horas pendientes de rellenar para el trabajo: <strong>${jobTitle}</strong>. Te rogamos completes los partes para su aprobación; una vez aprobados obtendrás un informe de los importes a facturar y la referencia que has de adjuntar a la factura.
                </div>
              </div>

              <!-- Important deadline warning -->
              <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;margin-bottom:20px;border-radius:4px;">
                <div style="color:#92400e;font-size:14px;line-height:1.6;font-weight:600;margin-bottom:8px;">
                  ⚠️ Importante: Plazo de rellenado
                </div>
                <div style="color:#92400e;font-size:14px;line-height:1.6;">
                  <strong>Tienes 7 días desde la finalización del trabajo para rellenar tus partes de horas.</strong> Una vez transcurrido este plazo, la ventana de edición se cerrará automáticamente y el sistema establecerá por defecto las horas mínimas correspondientes a tu categoría profesional.
                </div>
                <div style="color:#92400e;font-size:14px;line-height:1.6;margin-top:12px;">
                  <strong>Recomendación:</strong> Para evitar errores y asegurar que se registren correctamente todas tus horas trabajadas, te aconsejamos rellenar los partes inmediatamente después de finalizar cada trabajo.
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
                <a href="${timesheetUrl}"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(99,102,241,0.3);">
                  Haz clic aquí para rellenar tu parte de horas ahora
                </a>
              </div>

              <!-- Login instructions -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:16px;border-radius:6px;margin:20px 0;">
                <div style="color:#6b7280;font-size:13px;line-height:1.5;">
                  <strong style="color:#374151;">Instrucciones de acceso:</strong><br/>
                  Si es la primera vez que accedes a la plataforma, tus credenciales son:
                  <ul style="margin:8px 0;padding-left:20px;">
                    <li><strong>Usuario:</strong> ${technician.email}</li>
                    <li><strong>Contraseña:</strong> default</li>
                  </ul>
                  Te recomendamos cambiar tu contraseña tras el primer acceso desde tu perfil.
                </div>
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
                &nbsp;|&nbsp; Área Técnica · <a href="https://sector-pro.work" style="color:#6366f1;text-decoration:none;">sector-pro.work</a>
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
    console.log('Email sent successfully:', brevoResponse.messageId);

    // Stamp reminder_sent_at so the auto-reminder system knows a reminder was recently sent
    const { error: updateError } = await supabaseAdmin
      .from('timesheets')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', timesheetId);
    if (updateError) {
      console.warn('Could not update reminder_sent_at:', updateError.message);
    }

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
