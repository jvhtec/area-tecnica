import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import { sendBrevoEmail } from '../_shared/brevo.ts';
import { logEvent } from '../_shared/structuredLogger.ts';
import { escapeHtml } from '../_shared/corporateEmailTemplate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface OnboardingRequestBody {
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName }: OnboardingRequestBody = await req.json();
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    // AuthN/Z: only admin/management may send onboarding
    try {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: userResult } = await supabaseAdmin.auth.getUser(token);
      const requester = userResult?.user;
      if (!requester) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { data: requesterProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requester.id)
        .maybeSingle();
      if (profileErr) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!requesterProfile || !['admin', 'management'].includes((requesterProfile as any).role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Public logos base for remote images (matches how logos are loaded)
    const PUBLIC_LOGOS_BASE = `${SUPABASE_URL}/storage/v1/object/public/public%20logos`;

    // Push notifications walkthrough images (exact filenames from the bucket)
    const PUSH_IMG_PROFILE = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/profile.jpeg`;
    const PUSH_IMG_PUSH = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/push.jpeg`;
    const PUSH_IMG_ALLOW = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/allow.jpeg`;
    const PUSH_IMG_TEST = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/test.jpeg`;
    const PUSH_IMG_FOCUS_1 = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/focus.jpeg`;
    const PUSH_IMG_FOCUS_2 = `${escapeHtml(String(PUBLIC_LOGOS_BASE))}/${encodeURIComponent('focus 2.jpeg')}`;

    // New dark-themed HTML content with header logos and remote images
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenido a Área&nbsp;Técnica</title>
    <style>
      body { background-color: #0e1a28; color: #ffffff; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      h1 { color: #00bcd4; margin-top: 0; }
      p { line-height: 1.5; font-size: 15px; }
      .card { background-color: #14263f; border-radius: 8px; padding: 15px; margin: 20px 0; }
      .accent { color: #00bcd4; font-weight: bold; }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; }
      .footer { font-size: 12px; color: #8fa3bf; margin-top: 20px; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0e1a28;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e1a28;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#0e1a28;">
            <tr>
              <td style="padding:0 16px;">
                <div class="container">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px 0;">
        <tr>
          <td align="left" style="padding:0;">
            <a href="https://www.sector-pro.com" target="_blank" style="display:inline-block;text-decoration:none;">
              <img src="${escapeHtml(String(COMPANY_LOGO_URL))}" alt="Sector Pro" width="160" style="display:block;border:0;max-width:160px;height:auto;" />
            </a>
          </td>
          <td align="right" style="padding:0;">
            <a href="https://sector-pro.work" target="_blank" style="display:inline-block;text-decoration:none;">
              <img src="${escapeHtml(String(AT_LOGO_URL))}" alt="Área Técnica" width="120" style="display:block;border:0;max-width:120px;height:auto;background:#ffffff;border-radius:4px;padding:2px;" />
            </a>
          </td>
        </tr>
      </table>
      <h1>¡Bienvenido a Área&nbsp;Técnica!</h1>
      <p style="color:#dbeafe;">
        ¡Hola! Estamos encantados de tenerte a bordo como técnico en Sector&nbsp;Pro. Este correo incluye una guía rápida
        para que conozcas las funciones básicas de tu panel de trabajo y puedas empezar a usar la plataforma desde el
        primer día.
      </p>
      <p style="color:#dbeafe;">
        Nota: si todavía no has establecido tu contraseña, pulsa "Olvidé mi contraseña" en la pantalla de acceso y
        recibirás un enlace para crearla. Después podrás cambiarla cuando quieras desde la sección de <strong>Perfil</strong>.
      </p>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Tarjetas de asignación</h2>
        <p style="color:#cfe1ff;">
          En la pantalla principal verás tus <strong>tarjetas de asignación</strong>. Cada tarjeta muestra el nombre del
          evento, la fecha y la ubicación. Dispones de tres botones para acceder a más información:
        </p>
        <ul style="padding-left:20px;margin:0;color:#cfe1ff;">
          <li style="margin-bottom:6px;">
            <strong>Detalles:</strong> abre una ventana con toda la información del trabajo.
          </li>
          <li style="margin-bottom:6px;">
            <strong>Tiempos:</strong> gestiona tus horarios de inicio y fin, y firma tus partes.
          </li>
          <li style="margin-bottom:6px;">
            <strong>Incidencia:</strong> reporta cualquier problema con el equipo o con el evento.
          </li>
        </ul>
        <p style="color:#cfe1ff;">Así luce una tarjeta de asignación típica:</p>
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/jobcard.png" alt="Tarjeta de asignación" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:6px;margin:10px 0;" />
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Ventana de detalles</h2>
        <p style="color:#cfe1ff;">
          Al pulsar en <strong>Detalles</strong> se abrirá una ventana con varias pestañas. Encontrarás información
          sobre la hora de inicio y fin, la dirección, el equipo asignado, los documentos asociados, el personal de otras áreas y
          restaurantes cercanos.
        </p>
        <p style="color:#cfe1ff;">Ejemplo de la ventana de detalles:</p>
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/details.png" alt="Ventana de detalles" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:6px;margin:10px 0;" />
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Mi disponibilidad</h2>
        <p style="color:#cfe1ff;">
          Para asegurarte de que no se te asignen trabajos cuando no estés disponible, usa la sección <strong>Mi
          Disponibilidad</strong>. Desde aquí puedes bloquear días u horas en los que no podrás trabajar. En la barra
          lateral izquierda también encontrarás el enlace <strong>My Unavailability</strong> para gestionar tus ausencias.
        </p>
        <p style="color:#cfe1ff;">Vista simplificada de la gestión de disponibilidad:</p>
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/availability.png" alt="Mi disponibilidad" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:6px;margin:10px 0;" />
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Gestión de tiempos</h2>
        <p style="color:#cfe1ff;">
          La opción <strong>Tiempos</strong> te permite gestionar tus partes de horas. Para cada día del trabajo puedes
          indicar la hora de inicio, fin y los descansos y enviar los registros para aprobación. También puedes firmar
          digitalmente para confirmar tu participación.
        </p>
        <p style="color:#cfe1ff;">Vista simplificada de la gestión de tiempos:</p>
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/timesheet.png" alt="Gestión de tiempos" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:6px;margin:10px 0;" />
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Activar notificaciones push</h2>
        <p style="color:#cfe1ff;">
          Para recibir avisos en tu dispositivo (asignaciones, cambios, recordatorios), activa las notificaciones push desde tu perfil.
        </p>
        <ol style="color:#cfe1ff;padding-left:20px;margin:0 0 10px 0;">
          <li style="margin-bottom:6px;"><strong>Abre tu Perfil</strong> y localiza la sección de <strong>Notificaciones push</strong>.</li>
          <li style="margin-bottom:6px;">Pulsa <strong>Activar notificaciones</strong> y, si aparece el mensaje del sistema, toca <strong>Permitir</strong>.</li>
          <li style="margin-bottom:6px;">Usa <strong>Probar notificación</strong> para verificar que llegan correctamente.</li>
          <li style="margin-bottom:6px;">Si usas <strong>Enfoque/No molestar</strong>, añade la app a las excepciones para que puedan entrar las alertas.</li>
        </ol>
        <p style="color:#cfe1ff;margin:0 0 8px;">Referencias visuales:</p>
        <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="width:100%;max-width:560px;margin:0 auto 8px auto;">
          <tr>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_PROFILE))}" alt="Ajuste de push en Perfil" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_PUSH))}" alt="Botones Activar y Probar" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_ALLOW))}" alt="Permitir notificaciones del sistema" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_TEST))}" alt="Notificación de prueba recibida" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_FOCUS_1))}" alt="Permitir en Enfoque (1)" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
            <td align="center" style="padding:4px;">
              <img src="${escapeHtml(String(PUSH_IMG_FOCUS_2))}" alt="Permitir en Enfoque (2)" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:6px;" />
            </td>
          </tr>
        </table>
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Sugerencias rápidas</h2>
        <ul>
          <li style="color:#cfe1ff;">Revisa tu correo y tu panel con frecuencia para no perder ninguna actualización.</li>
          <li style="color:#cfe1ff;">Mantén tu perfil actualizado y cambia tu contraseña inicial desde la sección <strong>Perfil</strong>.</li>
          <li style="color:#cfe1ff;">Utiliza la sección de <strong>Incidencia</strong> tan pronto como detectes un problema; nos ayuda a
            resolverlo con antelación.</li>
        </ul>
      </div>

      <div class="card" style="background-color:#14263f;border-radius:8px;padding:15px;margin:20px 0;">
        <h2 class="accent" style="color:#00bcd4;font-weight:bold;margin:0 0 8px 0;">Añadir el panel como app en iOS</h2>
        <p style="color:#cfe1ff;">Sigue estos pasos en tu iPhone para instalar el panel en tu pantalla de inicio (la mayoria de sistemas Android ofrece una opcion equivalente):</p>
        <ol style="color:#cfe1ff;padding-left:20px;margin:0 0 10px 0;">
          <li style="margin-bottom:6px;">Abre el link en logo S al principio de este correo en <strong>Safari</strong> (no en Chrome).</li>
          <li style="margin-bottom:6px;">Pulsa el botón <strong>Compartir</strong> en la barra inferior.</li>
          <li style="margin-bottom:6px;">Selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
          <li style="margin-bottom:6px;">Confirma el nombre y pulsa <strong>Añadir</strong>.</li>
        </ol>
        <p style="color:#cfe1ff;">Referencias visuales:</p>
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/menu.jpeg" alt="Abrir menú de Safari" width="280" style="display:block;width:100%;max-width:280px;height:auto;border-radius:6px;margin:10px auto;" />
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/add.jpeg" alt="Opción Añadir a pantalla de inicio" width="280" style="display:block;width:100%;max-width:280px;height:auto;border-radius:6px;margin:10px auto;" />
        <img src="${escapeHtml(String(PUBLIC_LOGOS_BASE))}/result.jpeg" alt="Icono instalado en iOS" width="280" style="display:block;width:100%;max-width:280px;height:auto;border-radius:6px;margin:10px auto;" />
      </div>

      <p style="color:#dbeafe;">
        ¡Gracias por formar parte del equipo de Sector&nbsp;Pro! Estamos a tu disposición para cualquier duda o
        sugerencia.
      </p>
      <div class="footer" style="font-size:12px;color:#8fa3bf;margin-top:20px;">
        Si necesitas ayuda adicional, contacta con nuestro equipo de soporte mediante la aplicación o envía un correo a
        soporte@sector-pro.com.
      </div>
    </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

    // Images are referenced by public URLs so no inline attachments are needed.

    const brevoRes = await sendBrevoEmail(BREVO_KEY, {
      sender: {
        email: BREVO_FROM,
        name: 'Sistema de Gestión',
      },
      to: [{ email: normalizedEmail, name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || undefined }],
      subject: 'Bienvenido a Área Técnica',
      htmlContent,
    });

    if (!brevoRes.ok) {
      const msg = await brevoRes.text();
      logEvent('error', 'onboarding.mail_provider_failed');
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
    logEvent('error', 'onboarding.request_failed');
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
