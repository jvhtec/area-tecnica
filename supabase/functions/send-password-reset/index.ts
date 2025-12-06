import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    // Sanitize and validate basic shape
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`[Password Reset] Processing request for: ${normalizedEmail}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')!;
    const brevoFrom = Deno.env.get('BREVO_FROM')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate recovery link using admin API
    // Prefer explicit env base over Origin/Referer to avoid localhost in prod
    const pickEnvBase = () => {
      const candidates = [
        'https://sector-pro.work',
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
    };
    const toOrigin = (input?: string) => {
      if (!input) return undefined;
      try {
        const u = new URL(input);
        return `${u.protocol}//${u.host}`;
      } catch {
        return input.replace(/\/$/, '');
      }
    };
    const envBaseRaw = pickEnvBase();
    const envBase = toOrigin(envBaseRaw);
    const rawOrigin = req.headers.get('origin') || req.headers.get('referer');
    const originBase = rawOrigin ? toOrigin(rawOrigin.split('?')[0]) : undefined;
    const baseUrl = envBase || originBase || 'http://localhost:3000';
    console.log('[Password Reset] Using baseUrl:', baseUrl, '(envRaw:', envBaseRaw, ')');
    const redirectUrl = `${baseUrl}/auth?type=recovery`;
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkError || !linkData) {
      console.error("[Password Reset] Error generating link:", linkError);
      throw new Error("Failed to generate recovery link");
    }

    const resetLink = linkData.properties?.action_link;
    if (!resetLink) {
      console.error("[Password Reset] No action link in response");
      throw new Error("Invalid recovery link generated");
    }

    console.log(`[Password Reset] Generated recovery link for: ${normalizedEmail}`);

    // Basic personalization without metadata lookup
    const userName = normalizedEmail.split('@')[0] || 'User';

    // Branding assets (same defaults as staffing function)
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || `${supabaseUrl}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || `${supabaseUrl}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    // Create email HTML template (branded like staffing emails)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablece tu contraseña</title>
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
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${userName},</h2>
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 0 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
                      <tr>
                        <td align="center" style="padding:8px 0;">
                          <a href="${resetLink}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Restablecer contraseña</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;">
                      <b>⏰ Este enlace expira en 24 horas.</b>
                    </div>
                    <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
                      Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu contraseña no cambiará hasta que crees una nueva.
                    </p>
                    <p style="margin:16px 0 0 0;color:#6b7280;font-size:12px;line-height:1.55;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                      <a href="${resetLink}" style="color:#3b82f6;text-decoration:underline;word-break:break-all;">${resetLink}</a>
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
      </html>
    `;

    // Send email via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { 
          email: brevoFrom,
          name: "Sistema de Gestión"
        },
        to: [{ email: normalizedEmail }],
        subject: 'Restablece tu contraseña',
        htmlContent: htmlContent
      })
    });

    if (!brevoResponse.ok) {
      const brevoError = await brevoResponse.text();
      console.error("[Password Reset] Brevo API error:", brevoError);
      throw new Error(`Brevo API failed: ${brevoResponse.status}`);
    }

    console.log(`[Password Reset] Email sent successfully to: ${normalizedEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, a password reset link has been sent." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("[Password Reset] Error:", error);
    // Always return success to prevent user enumeration
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, a password reset link has been sent." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
