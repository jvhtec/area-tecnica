import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()
  console.log('=== auto-send-timesheet-reminders invoked ===', startedAt)

  try {
    // This function is designed to be called by pg_cron with the service_role key,
    // or by an admin/management user for a manual batch trigger.
    // verify_jwt=false in config.toml – we validate caller identity below.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    // Decode JWT claims (Supabase service_role key has role="service_role")
    let callerRole = 'unknown'
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      callerRole = payload.role ?? 'unknown'
    } catch {
      // Non-JWT caller – reject
      console.error('Failed to decode JWT')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Allow service_role (pg_cron) or admin/management users
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let callerAuthorized = false
    if (callerRole === 'service_role') {
      callerAuthorized = true
      console.log('Caller: pg_cron (service_role)')
    } else {
      // Check if it's an admin/management user
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]))
        const userId = payload.sub
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()
          if (profile && (profile.role === 'admin' || profile.role === 'management')) {
            callerAuthorized = true
            console.log('Caller: management user', userId)
          }
        }
      } catch {
        // ignore
      }
    }

    if (!callerAuthorized) {
      console.error('Caller not authorized, role:', callerRole)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load reminder settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('timesheet_reminder_settings')
      .select('auto_reminders_enabled, reminder_frequency_days')
      .eq('id', 1)
      .single()

    if (settingsError || !settings) {
      console.error('Failed to load reminder settings:', settingsError)
      return new Response(JSON.stringify({ error: 'Could not load reminder settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!settings.auto_reminders_enabled) {
      console.log('Auto-reminders disabled in settings – nothing to do.')
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: 'disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const frequencyDays = settings.reminder_frequency_days ?? 1
    console.log(`Reminder frequency: every ${frequencyDays} day(s)`)

    // Find all draft timesheets where:
    //   - The job has already ended (end_time < now)
    //   - No reminder has been sent yet  OR  last reminder was sent more than frequencyDays ago
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - frequencyDays)
    const cutoffIso = cutoff.toISOString()

    const { data: timesheets, error: tsError } = await supabaseAdmin
      .from('timesheets')
      .select(`
        id,
        technician_id,
        job_id,
        date,
        status,
        reminder_sent_at,
        auto_reminder_count
      `)
      .eq('status', 'draft')
      .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${cutoffIso}`)

    if (tsError) {
      console.error('Failed to query timesheets:', tsError)
      return new Response(JSON.stringify({ error: 'Failed to query timesheets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!timesheets || timesheets.length === 0) {
      console.log('No pending timesheets require reminders.')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter: only timesheets whose job has already ended
    const jobIds = [...new Set(timesheets.map((t) => t.job_id))]
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, end_time')
      .in('id', jobIds)

    if (jobsError) {
      console.error('Failed to query jobs:', jobsError)
      return new Response(JSON.stringify({ error: 'Failed to query jobs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const completedJobIds = new Set(
      (jobs ?? [])
        .filter((j) => j.end_time && new Date(j.end_time) < now)
        .map((j) => j.id)
    )
    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]))

    const eligibleTimesheets = timesheets.filter((t) => completedJobIds.has(t.job_id))
    console.log(
      `${timesheets.length} draft timesheets found, ${eligibleTimesheets.length} for completed jobs.`
    )

    if (eligibleTimesheets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, note: 'No completed-job timesheets pending' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch technician details for all relevant tech IDs
    const techIds = [...new Set(eligibleTimesheets.map((t) => t.technician_id))]
    const { data: technicians, error: techError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, nickname, email')
      .in('id', techIds)

    if (techError) {
      console.error('Failed to query technicians:', techError)
      return new Response(JSON.stringify({ error: 'Failed to query technicians' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const techMap = new Map((technicians ?? []).map((t) => [t.id, t]))

    const BREVO_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
    const BREVO_FROM = Deno.env.get('BREVO_FROM') ?? ''
    const COMPANY_LOGO_URL =
      Deno.env.get('COMPANY_LOGO_URL_W') ??
      `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`
    const AT_LOGO_URL =
      Deno.env.get('AT_LOGO_URL') ??
      `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`

    let sentCount = 0
    let failCount = 0
    const nowIso = new Date().toISOString()

    for (const ts of eligibleTimesheets) {
      const technician = techMap.get(ts.technician_id)
      const job = jobMap.get(ts.job_id)

      if (!technician?.email || !job) {
        console.warn(`Skipping timesheet ${ts.id}: missing tech email or job.`)
        failCount++
        continue
      }

      const techName = technician.nickname || technician.first_name || 'Técnico'
      const jobTitle = job.title || 'trabajo desconocido'
      const subject = `Recordatorio: Parte de horas pendiente - ${jobTitle}`
      const timesheetUrl = `https://sector-pro.work/timesheets?jobId=${ts.job_id}`

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
                  Importante: Plazo de rellenado
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
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                      <strong>Fecha:</strong> ${new Date(ts.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;font-size:14px;color:#374151;">
                      <strong>Estado:</strong> Borrador
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
</html>`

      const emailPayload = {
        sender: { email: BREVO_FROM, name: 'Área Técnica - Sector Pro' },
        to: [{ email: technician.email, name: `${technician.first_name} ${technician.last_name}` }],
        subject,
        htmlContent,
      }

      const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      })

      if (!sendRes.ok) {
        const errText = await sendRes.text()
        console.error(`Failed to send reminder for timesheet ${ts.id}:`, errText)
        failCount++
        continue
      }

      const brevoRes = await sendRes.json()
      console.log(`Reminder sent for timesheet ${ts.id} to ${technician.email}, messageId=${brevoRes.messageId}`)

      // Update reminder tracking on the timesheet
      const { error: updateError } = await supabaseAdmin
        .from('timesheets')
        .update({
          reminder_sent_at: nowIso,
          auto_reminder_count: (ts.auto_reminder_count ?? 0) + 1,
        })
        .eq('id', ts.id)

      if (updateError) {
        console.error(`Failed to update reminder tracking for timesheet ${ts.id}:`, updateError)
      }

      sentCount++
    }

    console.log(`Done. Sent: ${sentCount}, Failed: ${failCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failCount,
        total_eligible: eligibleTimesheets.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unhandled error in auto-send-timesheet-reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
