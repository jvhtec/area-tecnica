import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml, wrapInCorporateTemplate } from "../_shared/corporateEmailTemplate.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("CREW_EMAIL_FROM") || "crew@sector-pro.com";
const FROM_NAME = Deno.env.get("CREW_EMAIL_FROM_NAME") || "Crew | Sector Pro";
const ALLOWED_ROLES = new Set(["admin", "management", "logistics"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RequestBody {
  jobId?: unknown;
  technicianId?: unknown;
}

interface JobRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  timezone: string | null;
  job_type: string;
  preventive_resource_technician_id: string | null;
}

interface TechnicianProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function normalizeNullableUuid(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (isUuid(value)) return value;
  return undefined;
}

function fullName(profile: Pick<TechnicianProfile, "first_name" | "last_name" | "email">): string {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.email || "Técnico";
}

function safeDateRange(job: JobRow): string {
  const timezone = job.timezone || "Europe/Madrid";
  const start = new Date(job.start_time);
  const end = new Date(job.end_time);

  if (Number.isNaN(start.getTime())) {
    return "fecha pendiente";
  }

  try {
    const dateText = new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(start);
    const timeFormat = new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
    const startTime = timeFormat.format(start);
    const endTime = Number.isNaN(end.getTime()) ? null : timeFormat.format(end);
    return endTime ? `${dateText} · ${startTime}-${endTime}` : `${dateText} · ${startTime}`;
  } catch {
    return start.toISOString();
  }
}

async function sendPreventiveResourceEmail(params: {
  technician: TechnicianProfile;
  job: JobRow;
}): Promise<{ sent: boolean; error?: string }> {
  const email = params.technician.email?.trim();
  if (!email) {
    return { sent: false, error: "missing_email" };
  }
  if (!BREVO_KEY) {
    return { sent: false, error: "missing_brevo_api_key" };
  }

  const technicianName = fullName(params.technician);
  const escapedJobTitle = escapeHtml(params.job.title);
  const escapedDateRange = escapeHtml(safeDateRange(params.job));
  const subject = `Recurso preventivo · ${params.job.title}`;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;color:#374151;line-height:1.55;">
      Has sido designado como <b>recurso preventivo</b> para el trabajo <b>${escapedJobTitle}</b>.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#374151;font-size:14px;line-height:1.55;margin-bottom:12px;">
      <b>Trabajo:</b> ${escapedJobTitle}<br/>
      <b>Fecha y hora:</b> ${escapedDateRange}<br/>
      <b>Compensación:</b> extra de 10€ en el payout de este trabajo.
    </div>
    <p style="margin:0 0 8px 0;color:#374151;line-height:1.55;">
      Como recurso preventivo, tus responsabilidades asociadas son:
    </p>
    <ul style="margin:0 0 12px 18px;padding:0;color:#374151;line-height:1.55;">
      <li>Vigilar que se respeten las medidas preventivas durante la actividad.</li>
      <li>Coordinar la comunicación de cualquier riesgo con el responsable del trabajo y producción.</li>
      <li>Parar o escalar cualquier tarea si detectas una situación insegura.</li>
      <li>Comunicar incidentes, desviaciones o necesidades preventivas antes de continuar.</li>
    </ul>
    <p style="margin:0;color:#374151;line-height:1.55;">
      Si no puedes asumir esta función, contacta con coordinación antes del inicio del trabajo.
    </p>
  `;

  const htmlContent = wrapInCorporateTemplate({
    subject,
    greeting: technicianName,
    bodyHtml,
  });

  const response = await sendBrevoEmail(BREVO_KEY, {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email, name: technicianName }],
    subject,
    htmlContent,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    return { sent: false, error: errorText || response.statusText };
  }

  return { sent: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user?.id) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (callerError) {
      console.error("[set-job-preventive-resource] caller lookup failed", callerError);
      return jsonResponse({ error: "Failed to verify permissions" }, { status: 500 });
    }

    if (!callerProfile?.role || !ALLOWED_ROLES.has(callerProfile.role)) {
      return jsonResponse({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as RequestBody;
    if (!isUuid(body.jobId)) {
      return jsonResponse({ error: "Invalid jobId" }, { status: 400 });
    }

    const technicianId = normalizeNullableUuid(body.technicianId);
    if (technicianId === undefined) {
      return jsonResponse({ error: "Invalid technicianId" }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, title, start_time, end_time, timezone, job_type, preventive_resource_technician_id")
      .eq("id", body.jobId)
      .maybeSingle<JobRow>();

    if (jobError) {
      console.error("[set-job-preventive-resource] job lookup failed", jobError);
      return jsonResponse({ error: "Failed to load job" }, { status: 500 });
    }
    if (!job) {
      return jsonResponse({ error: "Job not found" }, { status: 404 });
    }
    if (job.job_type === "dryhire" && technicianId) {
      return jsonResponse({ error: "Dry hires cannot have a recurso preventivo" }, { status: 400 });
    }

    const previousTechnicianId = job.preventive_resource_technician_id;
    if (previousTechnicianId === technicianId) {
      return jsonResponse({
        success: true,
        job_id: job.id,
        technician_id: technicianId,
        previous_technician_id: previousTechnicianId,
        email_sent: false,
      });
    }

    let technician: TechnicianProfile | null = null;
    if (technicianId) {
      const [{ data: assignment, error: assignmentError }, { data: profile, error: profileError }] = await Promise.all([
        supabaseAdmin
          .from("job_assignments")
          .select("technician_id, status")
          .eq("job_id", job.id)
          .eq("technician_id", technicianId)
          .eq("status", "confirmed")
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, email, department")
          .eq("id", technicianId)
          .maybeSingle<TechnicianProfile>(),
      ]);

      if (assignmentError) {
        console.error("[set-job-preventive-resource] assignment lookup failed", assignmentError);
        return jsonResponse({ error: "Failed to verify assignment" }, { status: 500 });
      }
      if (!assignment) {
        return jsonResponse({ error: "Technician must be confirmed on this job" }, { status: 400 });
      }
      if (profileError) {
        console.error("[set-job-preventive-resource] technician lookup failed", profileError);
        return jsonResponse({ error: "Failed to load technician" }, { status: 500 });
      }
      if (!profile) {
        return jsonResponse({ error: "Technician not found" }, { status: 404 });
      }
      if (!profile.email?.trim()) {
        return jsonResponse({ error: "Selected technician has no email" }, { status: 400 });
      }
      technician = profile;
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("jobs")
      .update({
        preventive_resource_technician_id: technicianId,
        preventive_resource_assigned_at: technicianId ? now : null,
        preventive_resource_assigned_by: technicianId ? userData.user.id : null,
      })
      .eq("id", job.id);

    if (updateError) {
      console.error("[set-job-preventive-resource] update failed", updateError);
      return jsonResponse({ error: "Failed to update job" }, { status: 500 });
    }

    let emailResult: { sent: boolean; error?: string } = { sent: false };
    if (technician) {
      emailResult = await sendPreventiveResourceEmail({ technician, job });
      if (!emailResult.sent) {
        console.error("[set-job-preventive-resource] email failed", emailResult.error);
      }
    }

    return jsonResponse({
      success: true,
      job_id: job.id,
      technician_id: technicianId,
      previous_technician_id: previousTechnicianId,
      email_sent: emailResult.sent,
      email_error: emailResult.error,
    });
  } catch (error) {
    console.error("[set-job-preventive-resource] unexpected error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
});
