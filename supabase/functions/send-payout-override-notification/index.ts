import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutOverrideNotificationRequest {
  jobId: string;
  jobTitle: string;
  jobStartTime: string;
  actorId: string;
  oldOverrideEnabled: boolean;
  oldOverrideAmountEur: number | null;
  newOverrideEnabled: boolean;
  newOverrideAmountEur: number | null;
  calculatedTotal: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Parse request body
    const payload: PayoutOverrideNotificationRequest = await req.json();
    const {
      jobId,
      jobTitle,
      jobStartTime,
      actorId,
      oldOverrideEnabled,
      oldOverrideAmountEur,
      newOverrideEnabled,
      newOverrideAmountEur,
      calculatedTotal,
    } = payload;

    // Get actor information
    const { data: actorProfile, error: actorError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, department, role")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actorProfile) {
      console.error("[send-payout-override-notification] Error fetching actor profile:", actorError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch actor information" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actorName = `${actorProfile.first_name || ""} ${actorProfile.last_name || ""}`.trim() || "Unknown User";
    const actorEmail = actorProfile.email || "no-email@example.com";
    const actorRole = actorProfile.role || "unknown";
    const actorDepartment = actorProfile.department || "N/A";

    // Format currency
    const formatCurrency = (amount: number | null) => {
      if (amount === null) return "—";
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
      }).format(amount);
    };

    // Format date
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("es-ES", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(date);
    };

    // Determine change type
    let changeDescription = "";
    if (!oldOverrideEnabled && newOverrideEnabled) {
      changeDescription = "✅ Override activado";
    } else if (oldOverrideEnabled && !newOverrideEnabled) {
      changeDescription = "❌ Override desactivado";
    } else if (oldOverrideEnabled && newOverrideEnabled) {
      changeDescription = "✏️ Override modificado";
    }

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #1e40af;
      font-size: 24px;
    }
    .alert-badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    .section h2 {
      margin: 0 0 15px 0;
      color: #1e40af;
      font-size: 18px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
    }
    .value {
      color: #111827;
      font-weight: 500;
    }
    .comparison {
      margin: 20px 0;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 20px;
      align-items: center;
    }
    .comparison-box {
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .comparison-box.old {
      background-color: #fef2f2;
      border: 2px solid #fca5a5;
    }
    .comparison-box.new {
      background-color: #f0fdf4;
      border: 2px solid #86efac;
    }
    .comparison-box .title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .comparison-box .amount {
      font-size: 24px;
      font-weight: 700;
    }
    .comparison-box.old .amount {
      color: #dc2626;
    }
    .comparison-box.new .amount {
      color: #16a34a;
    }
    .arrow {
      font-size: 32px;
      color: #9ca3af;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .warning-title {
      font-weight: 700;
      color: #92400e;
      margin-bottom: 5px;
    }
    .warning-text {
      color: #78350f;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Alerta: Override de Pago de Trabajo</h1>
      <div class="alert-badge">${changeDescription}</div>
    </div>

    <div class="section">
      <h2>📋 Información del Trabajo</h2>
      <div class="info-row">
        <span class="label">Trabajo:</span>
        <span class="value">${jobTitle}</span>
      </div>
      <div class="info-row">
        <span class="label">ID:</span>
        <span class="value">${jobId}</span>
      </div>
      <div class="info-row">
        <span class="label">Fecha de inicio:</span>
        <span class="value">${formatDate(jobStartTime)}</span>
      </div>
    </div>

    <div class="section">
      <h2>👤 Modificado por</h2>
      <div class="info-row">
        <span class="label">Usuario:</span>
        <span class="value">${actorName}</span>
      </div>
      <div class="info-row">
        <span class="label">Email:</span>
        <span class="value">${actorEmail}</span>
      </div>
      <div class="info-row">
        <span class="label">Rol:</span>
        <span class="value">${actorRole}</span>
      </div>
      <div class="info-row">
        <span class="label">Departamento:</span>
        <span class="value">${actorDepartment}</span>
      </div>
    </div>

    <div class="section">
      <h2>💰 Cambios Financieros</h2>

      <div class="info-row">
        <span class="label">Total calculado (sistema):</span>
        <span class="value">${formatCurrency(calculatedTotal)}</span>
      </div>

      <div class="comparison">
        <div class="comparison-box old">
          <div class="title">Anterior</div>
          <div class="amount">
            ${oldOverrideEnabled ? formatCurrency(oldOverrideAmountEur) : formatCurrency(calculatedTotal)}
          </div>
          <div style="font-size: 12px; margin-top: 5px; color: #6b7280;">
            ${oldOverrideEnabled ? "Override activo" : "Sin override"}
          </div>
        </div>

        <div class="arrow">→</div>

        <div class="comparison-box new">
          <div class="title">Nuevo</div>
          <div class="amount">
            ${newOverrideEnabled ? formatCurrency(newOverrideAmountEur) : formatCurrency(calculatedTotal)}
          </div>
          <div style="font-size: 12px; margin-top: 5px; color: #6b7280;">
            ${newOverrideEnabled ? "Override activo" : "Sin override"}
          </div>
        </div>
      </div>
    </div>

    ${newOverrideEnabled ? `
    <div class="warning">
      <div class="warning-title">⚠️ Importante</div>
      <div class="warning-text">
        El modo override está activo. El total de pago para este trabajo es ahora
        <strong>${formatCurrency(newOverrideAmountEur)}</strong> en lugar del total calculado
        de <strong>${formatCurrency(calculatedTotal)}</strong>.
      </div>
    </div>
    ` : ""}

    <div class="footer">
      <p>Este es un correo automático de notificación. No responder.</p>
      <p>Sector-Pro - Sistema de Gestión de Trabajos</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via corporate email function
    const { data: sendResult, error: sendError } = await supabase.functions.invoke(
      "send-corporate-email",
      {
        body: {
          subject: `⚠️ Override de Pago: ${jobTitle}`,
          bodyHtml: emailHtml,
          recipients: {
            roles: ["admin"],
            profileIds: [], // Will be filled with admin users by the function
          },
        },
      }
    );

    if (sendError) {
      console.error("[send-payout-override-notification] Error calling send-corporate-email:", sendError);
      // Don't fail the whole operation, just log it
    }

    // Also send to finanzas@sector-pro.com via Brevo
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY");
    const BREVO_FROM = Deno.env.get("BREVO_FROM");

    if (BREVO_KEY && BREVO_FROM) {
      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              email: BREVO_FROM,
              name: "Sector-Pro Alertas",
            },
            to: [
              {
                email: "finanzas@sector-pro.com",
                name: "Finanzas Sector-Pro",
              },
            ],
            subject: `⚠️ Override de Pago: ${jobTitle}`,
            htmlContent: emailHtml,
          }),
        });

        if (!brevoResponse.ok) {
          const errorText = await brevoResponse.text();
          console.error(
            "[send-payout-override-notification] Brevo API error:",
            brevoResponse.status,
            errorText
          );
        }
      } catch (brevoError) {
        console.error("[send-payout-override-notification] Error sending to Brevo:", brevoError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification emails sent",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-payout-override-notification] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
