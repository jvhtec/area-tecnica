import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Octokit } from "https://esm.sh/@octokit/rest@20.0.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_REPO_OWNER = Deno.env.get("GITHUB_REPO_OWNER") || "jvhtec";
const GITHUB_REPO_NAME = Deno.env.get("GITHUB_REPO_NAME") || "area-tecnica";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface BugReportRequest {
  title: string;
  description: string;
  reproductionSteps?: string;
  severity: "low" | "medium" | "high" | "critical";
  screenshot?: string; // Base64 encoded
  screenshotFilename?: string;
  consoleLogs?: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
  reporterEmail: string;
  appVersion?: string;
  environmentInfo?: Record<string, unknown>;
}

/**
 * Get current user if authenticated
 */
async function getCurrentUser(req: Request) {
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
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn("[submit-bug-report] Error resolving user", err);
    return null;
  }
}

/**
 * Create GitHub issue with bug report
 */
async function createGitHubIssue(
  bugReport: BugReportRequest,
  screenshotUrl?: string
): Promise<{ url: string; number: number }> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // Map severity to emoji
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  };

  // Build issue body
  let body = `## Descripción\n${bugReport.description}\n\n`;

  if (bugReport.reproductionSteps) {
    body += `## Pasos para reproducir\n${bugReport.reproductionSteps}\n\n`;
  }

  body += `## Información del entorno\n`;
  body += `- **Severidad**: ${severityEmoji[bugReport.severity]} ${bugReport.severity.toUpperCase()}\n`;

  if (bugReport.appVersion) {
    body += `- **Versión de la app**: ${bugReport.appVersion}\n`;
  }

  if (bugReport.environmentInfo) {
    body += `- **Navegador**: ${bugReport.environmentInfo.browser || "N/A"}\n`;
    body += `- **SO**: ${bugReport.environmentInfo.os || "N/A"}\n`;
    body += `- **Ancho de pantalla**: ${bugReport.environmentInfo.screenWidth || "N/A"}px\n`;
  }

  if (screenshotUrl) {
    body += `\n## Captura de pantalla\n![Screenshot](${screenshotUrl})\n`;
  }

  if (bugReport.consoleLogs && bugReport.consoleLogs.length > 0) {
    body += `\n## Registros de consola\n\`\`\`\n`;
    bugReport.consoleLogs.forEach((log) => {
      body += `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}\n`;
    });
    body += `\`\`\`\n`;
  }

  body += `\n---\n*Informe generado automáticamente desde el sistema de reportes de errores*`;

  // Create issue
  const { data: issue } = await octokit.issues.create({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    title: `[BUG] ${bugReport.title}`,
    body,
    labels: ["bug", `severity:${bugReport.severity}`],
  });

  // Tag agents in a comment
  try {
    await octokit.issues.createComment({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      issue_number: issue.number,
      body: "cc @claude-code @codex @cto",
    });
  } catch (commentError) {
    // Log error but don't fail the entire function since the issue was created successfully
    console.error("[submit-bug-report] Failed to create tagging comment:", commentError);
  }

  return {
    url: issue.html_url,
    number: issue.number,
  };
}

serve(async (req) => {
  // Validate required environment variables
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GITHUB_TOKEN) {
    console.error("[submit-bug-report] Missing required environment variables");
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
    // Parse request
    const bugReport = (await req.json()) as BugReportRequest;

    // Validate required fields
    if (!bugReport.title || !bugReport.description || !bugReport.reporterEmail) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: "title, description, and reporterEmail are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate screenshot size (max 5MB after base64 decode)
    if (bugReport.screenshot) {
      const base64Data = bugReport.screenshot.split(",")[1] || bugReport.screenshot;
      const binarySize = Math.ceil((base64Data.length * 3) / 4);
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (binarySize > maxSize) {
        return new Response(
          JSON.stringify({
            error: "Screenshot too large",
            details: `Screenshot size (${(binarySize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`,
          }),
          {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get current user if authenticated
    const user = await getCurrentUser(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Upload screenshot to storage if provided
    let screenshotUrl: string | undefined;
    if (bugReport.screenshot && bugReport.screenshotFilename) {
      try {
        console.log("[submit-bug-report] Uploading screenshot...");

        // Convert base64 to binary
        const base64Data = bugReport.screenshot.split(",")[1] || bugReport.screenshot;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const extension = bugReport.screenshotFilename.split(".").pop() || "png";
        const filePath = `bug-reports/${timestamp}_${random}.${extension}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("feedback-system")
          .upload(filePath, bytes, {
            contentType: `image/${extension}`,
            cacheControl: "31536000", // 1 year
            upsert: false,
          });

        if (uploadError) {
          console.error("[submit-bug-report] Failed to upload screenshot:", uploadError);
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from("feedback-system")
            .getPublicUrl(filePath);
          screenshotUrl = urlData.publicUrl;
          console.log("[submit-bug-report] Screenshot uploaded:", screenshotUrl);
        }
      } catch (error) {
        console.error("[submit-bug-report] Error processing screenshot:", error);
        // Continue without screenshot if upload fails
      }
    }

    // Create GitHub issue
    console.log("[submit-bug-report] Creating GitHub issue...");
    let githubIssue: { url: string; number: number } | undefined;
    try {
      githubIssue = await createGitHubIssue(bugReport, screenshotUrl);
      console.log("[submit-bug-report] GitHub issue created:", githubIssue.url);
    } catch (error) {
      console.error("[submit-bug-report] Failed to create GitHub issue:", error);
      // Continue to save in database even if GitHub fails
    }

    // Save to database
    console.log("[submit-bug-report] Saving to database...");
    const { data: savedReport, error: dbError } = await supabase
      .from("bug_reports")
      .insert({
        title: bugReport.title,
        description: bugReport.description,
        reproduction_steps: bugReport.reproductionSteps,
        severity: bugReport.severity,
        screenshot_url: screenshotUrl,
        console_logs: bugReport.consoleLogs,
        reporter_email: bugReport.reporterEmail,
        app_version: bugReport.appVersion,
        environment_info: bugReport.environmentInfo,
        github_issue_url: githubIssue?.url,
        github_issue_number: githubIssue?.number,
        created_by: user?.id,
        status: "open",
      })
      .select()
      .single();

    if (dbError) {
      const errorId = `BR-DB-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      // Properly serialize Supabase error object
      const errorDetails = {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      };
      console.error(`[submit-bug-report] Database error ${errorId}:`, JSON.stringify(errorDetails));
      return new Response(
        JSON.stringify({
          error: "Failed to save bug report",
          errorId: errorId,
          details: errorDetails.message || "Unknown database error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send confirmation email (optional - can be implemented later)
    // TODO: Send confirmation email to reporter

    return new Response(
      JSON.stringify({
        success: true,
        bugReport: savedReport,
        githubIssue: githubIssue
          ? {
              url: githubIssue.url,
              number: githubIssue.number,
            }
          : undefined,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // Log full error details server-side for debugging
    const errorId = `BR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.error(`[submit-bug-report] Error ${errorId}:`, err);

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
