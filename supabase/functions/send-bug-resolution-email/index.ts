import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { wrapInCorporateTemplate, escapeHtml } from "../_shared/corporateEmailTemplate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BugResolutionEmailRequest {
  bugReportId: string;
}

/**
 * Resolve the authenticated user from the request
 */
async function resolveUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[send-bug-resolution-email] Unable to resolve user:", error);
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn("[send-bug-resolution-email] Error resolving user", err);
    return null;
  }
}

/**
 * Check if user has admin or management role
 */
async function checkUserPermission(userId: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[send-bug-resolution-email] Unable to fetch user profile:", error);
    return false;
  }

  return data.role === "admin" || data.role === "management";
}

serve(async (req) => {
  // Validate required environment variables
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BREVO_KEY || !BREVO_FROM) {
    console.error("[send-bug-resolution-email] Missing required environment variables");
    return new Response(
      JSON.stringify({
        error: "Server configuration error",
        details: "Required environment variables are not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Authenticate user
    console.log("[send-bug-resolution-email] Authenticating user...");
    const user = await resolveUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid or missing authentication token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check user permission
    console.log("[send-bug-resolution-email] Checking user permission...");
    const hasPermission = await checkUserPermission(user.id);
    if (!hasPermission) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          details: "Only admin and management users can send bug resolution emails",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    console.log("[send-bug-resolution-email] Parsing request...");
    const body = (await req.json()) as BugResolutionEmailRequest;

    if (!body.bugReportId) {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          details: "Missing required field: bugReportId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch bug report from database
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: bugReport, error: fetchError } = await supabase
      .from("bug_reports")
      .select("*")
      .eq("id", body.bugReportId)
      .single();

    if (fetchError || !bugReport) {
      return new Response(
        JSON.stringify({
          error: "Bug report not found",
          details: fetchError?.message || "No bug report with this ID",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if bug is actually resolved
    if (bugReport.status !== "resolved") {
      return new Response(
        JSON.stringify({
          error: "Bug not resolved",
          details: "This bug report has not been marked as resolved",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate GitHub URL if present (only allow http: or https: protocols)
    let githubLinkHtml = '';
    if (bugReport.github_issue_url) {
      try {
        const url = new URL(bugReport.github_issue_url);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          // Use normalized url.href to avoid edge cases
          githubLinkHtml = `<p>Puedes ver más detalles en el <a href="${escapeHtml(url.href)}">issue de GitHub</a>.</p>`;
        } else {
          console.warn('[send-bug-resolution-email] Invalid URL protocol:', url.protocol);
        }
      } catch (error) {
        console.warn('[send-bug-resolution-email] Invalid GitHub URL:', error);
      }
    }

    // Build email content (escape all user-controlled content to prevent XSS)
    const bodyHtml = `
      <h2>Tu error ha sido resuelto</h2>
      <p>Hola,</p>
      <p>Te escribimos para informarte que el error que reportaste ha sido resuelto.</p>

      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin-top: 0;">${escapeHtml(bugReport.title)}</h3>
        <p style="margin-bottom: 0;"><strong>Descripción:</strong> ${escapeHtml(bugReport.description)}</p>
      </div>

      ${githubLinkHtml}

      <p>Gracias por tu ayuda para mejorar nuestra aplicación.</p>
      <p><strong>Equipo de Sector-Pro</strong></p>
    `;

    const htmlContent = wrapInCorporateTemplate({
      bodyHtml,
      subject: "Tu error ha sido resuelto",
    });

    // Send email via Brevo
    const emailPayload = {
      sender: { email: BREVO_FROM, name: "Sector-Pro" },
      to: [{ email: bugReport.reporter_email }],
      subject: `Tu error ha sido resuelto - ${escapeHtml(bugReport.title).substring(0, 100)}`,
      htmlContent,
    };

    // Log email domain only (avoid PII)
    const emailDomain = bugReport.reporter_email.split('@')[1] || 'unknown';
    console.log("[send-bug-resolution-email] Sending email to domain:", emailDomain);

    // Add timeout for Brevo API call (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorMessage = await response.text();
        const errorId = `BRE-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        console.error(`[send-bug-resolution-email] Brevo error ${errorId}:`, response.status, errorMessage);
        return new Response(
          JSON.stringify({
            error: "Failed to send email",
            errorId: errorId,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const brevoResponse = await response.json();
      console.log("[send-bug-resolution-email] Email sent successfully:", brevoResponse);

      return new Response(
        JSON.stringify({
          success: true,
          messageId: brevoResponse.messageId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorId = `BRE-TIMEOUT-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.error(`[send-bug-resolution-email] Fetch error ${errorId}:`, fetchError);
      return new Response(
        JSON.stringify({
          error: "Email service timeout or network error",
          errorId: errorId,
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err) {
    // Log full error details server-side for debugging
    const errorId = `BRE-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.error(`[send-bug-resolution-email] Error ${errorId}:`, err);

    // Return generic error to client without leaking internal details
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        errorId: errorId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
