import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrManagement } from "../_shared/auth.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";
import { escapeHtml } from "../_shared/corporateEmailTemplate.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
} from "../_shared/http.ts";
import { checkAndRecordWhatsappQuota } from "../_shared/whatsappQuota.ts";

type NotificationKind = "assigned" | "updated";
type RequestBody = { assignment_id?: string; kind?: NotificationKind };

type DeliveryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

const normalizeBase = (value: string) => {
  let base = value.trim();
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/+$/, "");
};

const normalizePhone = (raw: string, defaultCountry: string): string | null => {
  let digits = raw.trim().replace(/[\s\-()]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    if (/^[67]\d{8}$/.test(digits)) digits = `+34${digits}`;
    else digits = `${defaultCountry.startsWith("+") ? defaultCountry : `+${defaultCountry}`}${digits}`;
  }
  return /^\+\d{7,15}$/.test(digits) ? digits : null;
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const pickAppBase = () => {
  for (const value of [
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("PUBLIC_SITE_URL"),
    Deno.env.get("NEXT_PUBLIC_SITE_URL"),
    Deno.env.get("SITE_URL"),
    Deno.env.get("PUBLIC_CONFIRM_BASE"),
    "https://sector-pro.work",
  ]) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.trim());
      return `${url.protocol}//${url.host}`;
    } catch {
      // Continue to the next candidate.
    }
  }
  return "https://sector-pro.work";
};

const formatWhen = (iso: string, timezone: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

serve(createHttpHandler(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new HttpError(503, "Backend no configurado");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = await requireAdminOrManagement(supabase, req, {
    logContext: "send-driver-assignment-notification",
  });
  const body = await readBoundedJsonObject<RequestBody>(req, { maxBytes: 8 * 1024 });
  const assignmentId = typeof body.assignment_id === "string" ? body.assignment_id.trim() : "";
  const kind: NotificationKind = body.kind === "updated" ? "updated" : "assigned";
  if (!assignmentId) throw new HttpError(400, "Falta assignment_id");

  const { data: assignment, error: assignmentError } = await supabase
    .from("transport_driver_assignments")
    .select("id, driver_id, vehicle_id, logistics_event_id, starts_at, ends_at, status, notes, updated_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment?.driver_id || assignment.status === "declined") {
    throw new HttpError(404, "Asignación de conductor no disponible");
  }

  const [{ data: driver }, { data: event }, { data: actor }] = await Promise.all([
    supabase.from("profiles")
      .select("id, first_name, last_name, email, phone")
      .eq("id", assignment.driver_id)
      .maybeSingle(),
    supabase.from("logistics_events")
      .select("id, event_type, title, timezone, job_id, transport_request_id, loading_bay")
      .eq("id", assignment.logistics_event_id)
      .maybeSingle(),
    supabase.from("profiles")
      .select("id, waha_endpoint")
      .eq("id", caller.userId)
      .maybeSingle(),
  ]);
  if (!driver || !event) throw new HttpError(404, "No se pudieron resolver los datos del transporte");

  const [{ data: vehicle }, { data: job }, { data: request }] = await Promise.all([
    assignment.vehicle_id
      ? supabase.from("fleet_vehicles")
          .select("id, name, license_plate")
          .eq("id", assignment.vehicle_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    event.job_id
      ? supabase.from("jobs").select("id, title").eq("id", event.job_id).maybeSingle()
      : Promise.resolve({ data: null }),
    event.transport_request_id
      ? supabase.from("transport_requests")
          .select("id, origin, destination")
          .eq("id", event.transport_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const timezone = event.timezone?.trim() || "Europe/Madrid";
  const when = formatWhen(assignment.starts_at, timezone);
  const driverName = [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim() || "Conductor";
  const transportName = event.title?.trim() || job?.title?.trim() || (event.event_type === "unload" ? "Descarga" : "Carga");
  const route = request?.origin || request?.destination
    ? `${request?.origin || "—"} → ${request?.destination || "—"}`
    : null;
  const vehicleLabel = vehicle
    ? [vehicle.name, vehicle.license_plate].filter(Boolean).join(" · ")
    : null;
  const conductorUrl = `${pickAppBase()}/conductor`;
  const actionText = kind === "updated" ? "Tu transporte ha cambiado" : "Tienes un transporte asignado";

  const alreadySent = async (channel: "email" | "whatsapp") => {
    const { data } = await supabase
      .from("driver_assignment_delivery_log")
      .select("id")
      .eq("assignment_id", assignment.id)
      .eq("assignment_updated_at", assignment.updated_at)
      .eq("channel", channel)
      .maybeSingle();
    return Boolean(data?.id);
  };

  const recordSent = async (channel: "email" | "whatsapp", recipient: string) => {
    const { error } = await supabase.from("driver_assignment_delivery_log").insert({
      assignment_id: assignment.id,
      assignment_updated_at: assignment.updated_at,
      channel,
      notification_kind: kind,
      recipient,
    });
    if (error && error.code !== "23505") throw error;
  };

  let email: DeliveryResult = { status: "skipped", reason: "no_email" };
  if (driver.email && !(await alreadySent("email"))) {
    const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
    const from = Deno.env.get("BREVO_FROM") ?? "";
    if (!apiKey || !from) {
      email = { status: "skipped", reason: "email_not_configured" };
    } else {
      const safeName = escapeHtml(driverName);
      const safeTransport = escapeHtml(transportName);
      const safeWhen = escapeHtml(when);
      const safeRoute = route ? escapeHtml(route) : "";
      const safeVehicle = vehicleLabel ? escapeHtml(vehicleLabel) : "";
      const safeNotes = assignment.notes ? escapeHtml(assignment.notes) : "";
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#111827">
        <div style="max-width:620px;margin:auto;background:#fff;border-radius:10px;padding:24px">
          <h2 style="margin-top:0">${escapeHtml(actionText)}</h2>
          <p>Hola ${safeName},</p>
          <p>${kind === "updated" ? "Se ha actualizado una asignación de transporte." : "Se te ha asignado un transporte."}</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px">
            <p><b>${safeTransport}</b></p>
            <p><b>Inicio:</b> ${safeWhen}</p>
            ${safeRoute ? `<p><b>Ruta:</b> ${safeRoute}</p>` : ""}
            ${safeVehicle ? `<p><b>Vehículo:</b> ${safeVehicle}</p>` : ""}
            ${safeNotes ? `<p><b>Indicaciones:</b> ${safeNotes}</p>` : ""}
          </div>
          <p style="margin-top:20px"><a href="${escapeHtml(conductorUrl)}" style="background:#111827;color:#fff;padding:11px 16px;border-radius:7px;text-decoration:none;font-weight:600">Revisar y confirmar</a></p>
          <p style="font-size:12px;color:#6b7280">La asignación es trabajo planificado. No es una solicitud de disponibilidad.</p>
        </div></body></html>`;
      try {
        const response = await sendBrevoEmail(apiKey, {
          sender: { email: from },
          to: [{ email: driver.email, name: driverName }],
          subject: `${actionText} · ${transportName}`,
          htmlContent: html,
        });
        if (!response.ok) {
          email = { status: "failed", reason: `http_${response.status}` };
        } else {
          await recordSent("email", driver.email);
          email = { status: "sent" };
        }
      } catch (error) {
        email = { status: "failed", reason: error instanceof Error ? error.message : "send_failed" };
      }
    }
  } else if (driver.email) {
    email = { status: "skipped", reason: "already_sent" };
  }

  let whatsapp: DeliveryResult = { status: "skipped", reason: "no_phone" };
  if (driver.phone && !(await alreadySent("whatsapp"))) {
    const wahaEndpoint = actor?.waha_endpoint?.trim() || "";
    const phone = normalizePhone(driver.phone, Deno.env.get("WA_DEFAULT_COUNTRY_CODE") || "+34");
    if (!wahaEndpoint) {
      whatsapp = { status: "skipped", reason: "actor_has_no_waha" };
    } else if (!phone) {
      whatsapp = { status: "skipped", reason: "invalid_phone" };
    } else {
      const quota = await checkAndRecordWhatsappQuota({
        supabase,
        actorId: caller.userId,
        kind: "driver_assignment",
        recipientCount: 1,
        jobId: event.job_id || null,
        dailyLimit: Number(Deno.env.get("WA_DAILY_RECIPIENT_LIMIT") || 500),
      });
      if (!quota.allowed) {
        whatsapp = { status: "failed", reason: "daily_quota_exceeded" };
      } else {
        const base = normalizeBase(wahaEndpoint);
        const { data: config } = await supabase.rpc("get_waha_config", { base_url: base });
        const row = Array.isArray(config) ? config[0] : null;
        const session = row?.session || Deno.env.get("WAHA_SESSION") || "default";
        const apiKey = row?.api_key || Deno.env.get("WAHA_API_KEY") || "";
        const chatId = `${phone.replace(/^\+/, "")}@c.us`;
        const message = [
          `🚚 *${actionText}*`,
          `*Transporte:* ${transportName}`,
          `*Inicio:* ${when}`,
          route ? `*Ruta:* ${route}` : null,
          vehicleLabel ? `*Vehículo:* ${vehicleLabel}` : null,
          assignment.notes ? `*Indicaciones:* ${assignment.notes}` : null,
          "",
          `Revisa y confirma aquí: ${conductorUrl}`,
        ].filter((line): line is string => line !== null).join("\n");

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["X-API-Key"] = apiKey;
        const attempts = [
          { url: `${base}/api/${encodeURIComponent(session)}/sendText`, body: { chatId, text: message, linkPreview: false } },
          { url: `${base}/api/sendText`, body: { chatId, text: message, session, linkPreview: false } },
        ];
        let sent = false;
        let lastReason = "send_failed";
        for (const attempt of attempts) {
          try {
            const response = await fetchWithTimeout(attempt.url, {
              method: "POST",
              headers,
              body: JSON.stringify(attempt.body),
            }, Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000));
            if (response.ok) {
              sent = true;
              break;
            }
            lastReason = `http_${response.status}`;
          } catch (error) {
            lastReason = error instanceof Error ? error.message : "send_failed";
          }
        }
        if (sent) {
          await recordSent("whatsapp", phone);
          whatsapp = { status: "sent" };
        } else {
          whatsapp = { status: "failed", reason: lastReason };
        }
      }
    }
  } else if (driver.phone) {
    whatsapp = { status: "skipped", reason: "already_sent" };
  }

  return jsonResponse({ assignment_id: assignment.id, kind, email, whatsapp });
}, {
  allowedMethods: ["POST"],
  methodNotAllowedStatus: 404,
  methodNotAllowedBody: { error: "Not found" },
}));
