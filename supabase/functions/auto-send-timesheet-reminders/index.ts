import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeptSettings {
  auto_reminders_enabled: boolean
  reminder_frequency_days: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()
  console.log('=== auto-send-timesheet-reminders invoked ===', startedAt)

  try {
    // Called by pg_cron with service_role key, or manually by admin/management.
    // verify_jwt=false in config.toml – we validate the caller here.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    let callerRole = 'unknown'
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      callerRole = payload.role ?? 'unknown'
    } catch {
      console.error('Failed to decode JWT')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let callerAuthorized = false
    if (callerRole === 'service_role') {
      callerAuthorized = true
      console.log('Caller: pg_cron (service_role)')
    } else {
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
      } catch { /* ignore */ }
    }

    if (!callerAuthorized) {
      console.error('Caller not authorized, role:', callerRole)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Load per-department settings ────────────────────────────────────────
    const { data: settingsRows, error: settingsError } = await supabaseAdmin
      .from('timesheet_reminder_settings')
      .select('department, auto_reminders_enabled, reminder_frequency_days')

    if (settingsError) {
      console.error('Failed to load reminder settings:', settingsError)
      return new Response(JSON.stringify({ error: 'Could not load reminder settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build a lookup map: department → settings
    const settingsMap = new Map<string, DeptSettings>()
    for (const row of (settingsRows ?? [])) {
      settingsMap.set(row.department, {
        auto_reminders_enabled: row.auto_reminders_enabled,
        reminder_frequency_days: row.reminder_frequency_days,
      })
    }

    // Default for departments not in the settings table (fallback: enabled, 1 day)
    const DEFAULT_SETTINGS: DeptSettings = { auto_reminders_enabled: true, reminder_frequency_days: 1 }

    // Check if ALL departments are disabled (quick-exit optimisation)
    const anyEnabled = settingsRows?.some((r) => r.auto_reminders_enabled) ?? true
    if (!anyEnabled) {
      console.log('All department reminders disabled – nothing to do.')
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: 'all_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Find candidate timesheets ────────────────────────────────────────────
    // Fetch all draft timesheets – we filter by department frequency in-memory
    // because each department can have a different frequency value.
    const { data: timesheets, error: tsError } = await supabaseAdmin
      .from('timesheets')
      .select('id, technician_id, job_id, date, status, reminder_sent_at, auto_reminder_count')
      .eq('status', 'draft')

    if (tsError) {
      console.error('Failed to query timesheets:', tsError)
      return new Response(JSON.stringify({ error: 'Failed to query timesheets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!timesheets || timesheets.length === 0) {
      console.log('No draft timesheets found.')
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Fetch jobs to find completed ones ───────────────────────────────────
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
      (jobs ?? []).filter((j) => j.end_time && new Date(j.end_time) < now).map((j) => j.id)
    )
    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]))

    // ─── Fetch technician profiles (include department) ──────────────────────
    const techIds = [...new Set(timesheets.map((t) => t.technician_id))]
    const { data: technicians, error: techError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, nickname, email, department')
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
    let skippedDept = 0
    const nowIso = now.toISOString()

    // ─── Group timesheets by (technician_id, job_id) ─────────────────────────
    // A technician can have multiple draft timesheet rows for the same job
    // (one per day). We send at most ONE reminder email per (tech, job) pair.
    type GroupKey = string
    const groups = new Map<GroupKey, typeof timesheets>()
    for (const ts of timesheets) {
      if (!completedJobIds.has(ts.job_id)) continue
      const key: GroupKey = `${ts.technician_id}::${ts.job_id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(ts)
    }

    for (const [, groupTimesheets] of groups) {
      // All rows in a group share the same technician and job
      const ts = groupTimesheets[0]
      const technician = techMap.get(ts.technician_id)
      const job = jobMap.get(ts.job_id)

      if (!technician?.email || !job) {
        console.warn(`Skipping group tech=${ts.technician_id} job=${ts.job_id}: missing tech email or job.`)
        failCount++
        continue
      }

      // ── Department-specific settings ──────────────────────────────────────
      const techDept = technician.department ?? ''
      const deptSettings = settingsMap.get(techDept) ?? DEFAULT_SETTINGS

      if (!deptSettings.auto_reminders_enabled) {
        skippedDept++
        continue
      }

      // ── Frequency check – use the most-recent reminder_sent_at in the group
      // so a manual reminder on any row in the group resets the cooldown.
      const latestReminderSentAt = groupTimesheets
        .map((t) => t.reminder_sent_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null

      if (latestReminderSentAt) {
        const lastSent = new Date(latestReminderSentAt)
        const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince < deptSettings.reminder_frequency_days) {
          continue // Too soon for this department's frequency
        }
      }

      // ── Build and send email ──────────────────────────────────────────────
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
            <td style="padding:24px 24px 0 24px;color:#111827;font-size:15px;line-height:1.6;">
              Hola ${techName},
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:16px 24px 24px 24px;">
              <div style="background:#eef2ff;border-left:4px solid #6366f1;padding:16px 20px;margin-bottom:20px;border-radius:4px;">
                <div style="color:#374151;font-size:15px;line-height:1.6;">
                  Te recordamos que tienes partes de horas pendientes de rellenar para el trabajo: <strong>${jobTitle}</strong>. Te rogamos completes los partes para su aprobación; una vez aprobados obtendrás un informe de los importes a facturar y la referencia que has de adjuntar a la factura.
                </div>
              </div>

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

              <div style="text-align:center;margin:24px 0;">
                <a href="${timesheetUrl}"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(99,102,241,0.3);">
                  Haz clic aquí para rellenar tu parte de horas ahora
                </a>
              </div>

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
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      })

      if (!sendRes.ok) {
        const errText = await sendRes.text()
        console.error(`Failed to send reminder for timesheet ${ts.id} (${techDept}):`, errText)
        failCount++
        continue
      }

      const brevoRes = await sendRes.json()
      const groupIds = groupTimesheets.map((t) => t.id)
      console.log(
        `Reminder sent: ${groupIds.length} timesheet(s) dept=${techDept} to=${technician.email} msgId=${brevoRes.messageId}`
      )

      // Stamp reminder_sent_at and increment auto_reminder_count on ALL timesheets
      // in the group so the frequency check works correctly across the whole group.
      const { error: updateError } = await supabaseAdmin
        .from('timesheets')
        .update({ reminder_sent_at: nowIso })
        .in('id', groupIds)

      if (updateError) {
        console.error(`Failed to update reminder_sent_at for group (${groupIds.join(',')}):`, updateError)
      }

      // Increment auto_reminder_count individually (each row may have a different current value)
      for (const t of groupTimesheets) {
        await supabaseAdmin
          .from('timesheets')
          .update({ auto_reminder_count: (t.auto_reminder_count ?? 0) + 1 })
          .eq('id', t.id)
      }

      sentCount++
    }

    console.log(
      `Done. sent=${sentCount} failed=${failCount} skipped_dept=${skippedDept}`
    )

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failCount, skipped_dept: skippedDept }),
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
