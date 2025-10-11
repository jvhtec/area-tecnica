import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`[Password Reset] Processing request for: ${email}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')!;
    const brevoFrom = Deno.env.get('BREVO_FROM')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists (silently)
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error("[Password Reset] Error checking user:", userError);
      // Don't reveal error - return success
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

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log(`[Password Reset] User not found for: ${email}`);
      // Don't reveal user doesn't exist - return success
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

    // Generate recovery link using admin API
    const redirectUrl = `${Deno.env.get('PUBLIC_CONFIRM_BASE') || 'http://localhost:3000'}/auth?type=recovery`;
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
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

    console.log(`[Password Reset] Generated recovery link for: ${email}`);

    // Get user name for personalization
    const userName = user.user_metadata?.first_name || email.split('@')[0];

    // Create email HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Restablece tu contraseña</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Restablecer Contraseña</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hola <strong>${userName}</strong>,
                      </p>
                      
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:
                      </p>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                              Restablecer Contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <strong>⏰ Este enlace expira en 24 horas</strong>
                      </p>
                      
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu contraseña no cambiará hasta que crees una nueva.
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                      
                      <p style="color: #999999; font-size: 12px; line-height: 1.5; margin: 0;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                        <a href="${resetLink}" style="color: #3b82f6; word-break: break-all;">${resetLink}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        Este es un correo automático, por favor no respondas a este mensaje.
                      </p>
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
        to: [{ email: email.toLowerCase() }],
        subject: 'Restablece tu contraseña',
        htmlContent: htmlContent
      })
    });

    if (!brevoResponse.ok) {
      const brevoError = await brevoResponse.text();
      console.error("[Password Reset] Brevo API error:", brevoError);
      throw new Error(`Brevo API failed: ${brevoResponse.status}`);
    }

    console.log(`[Password Reset] Email sent successfully to: ${email}`);

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