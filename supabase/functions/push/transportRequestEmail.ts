import type { SupabaseClient } from "./deps.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";
import {
  formatTransportRequestEmail,
  type TransportEmailItem,
  type TransportEmailJob,
  type TransportEmailProfile,
  type TransportEmailRequest,
} from "./transportRequestEmailFormat.ts";

type SkipReason = "invalid_request_id" | "request_not_found" | "request_closed" |
  "request_not_fresh" | "forbidden" | "data_unavailable" | "no_recipients" |
  "not_configured" | "unexpected_error" | "unsupported_source";

export interface TransportRequestEmailResult {
  status: "sent" | "partial" | "failed" | "skipped";
  sent: number;
  failed: number;
  skipped: number;
  reason?: SkipReason;
}

const SERVICE_CALLER = "00000000-0000-0000-0000-000000000000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONCURRENCY = 4;
const PAGE_SIZE = 500;
const MAX_AGE_MS = 15 * 60 * 1000;

const skip = (reason: SkipReason): TransportRequestEmailResult => ({
  status: "skipped", sent: 0, failed: 0, skipped: 0, reason,
});

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  // Reject display-name syntax, controls, and malformed address/domain labels.
  if (email.length > 254 || /[\s<>(),;:[\]\\"]/.test(email) ||
    Array.from(email).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || parts[0].length > 64 ||
    parts[0].startsWith(".") || parts[0].endsWith(".") || parts[0].includes("..")) return null;
  const domain = parts[1].split(".");
  if (domain.length < 2 || domain.some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) return null;
  return email;
}

async function idempotencyKey(requestId: string, email: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(`transport-request-email:v1:${requestId.toLowerCase()}:${email}`),
  ));
  // UUIDv8 carries deterministic SHA-256-derived bytes with UUID version/variant bits.
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function isDuplicate(response: Response): Promise<boolean> {
  if (response.status !== 400) return false;
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object") return false;
  const error = body as { code?: unknown; message?: unknown };
  return error.code === "duplicate_parameter" && typeof error.message === "string" &&
    /idempotenc/i.test(error.message);
}

/**
 * Best-effort creation notification, using only authoritative request data.
 * The caller ID must come from resolveCaller, never from the broadcast body.
 * A conservative 15-minute creation window blocks later replay without an outbox.
 * Brevo's deterministic per-recipient key covers retries within that window:
 * https://developers.brevo.com/docs/heterogenous-versions-batch-emails
 * This deliberately does not promise durable retries or exactly-once delivery.
 */
export async function sendTransportRequestEmail(
  client: SupabaseClient,
  userId: string,
  requestId: string | undefined,
): Promise<TransportRequestEmailResult> {
  try {
    if (typeof requestId !== "string" || !UUID.test(requestId)) return skip("invalid_request_id");
    const { data, error } = await client.from("transport_requests")
      .select("id,job_id,created_by,created_at,status,planning_status,department,description,note,needed_at,origin,destination,movement_type,priority,source_type,transport_type")
      .eq("id", requestId).maybeSingle();
    if (error) return skip("data_unavailable");
    if (!data) return skip("request_not_found");
    const request = data as TransportEmailRequest;
    if (request.status !== "requested" || ["completed", "cancelled"].includes(request.planning_status)) return skip("request_closed");
    if (!["manual", "subrental"].includes(request.source_type)) return skip("unsupported_source");
    const age = Date.now() - new Date(request.created_at).getTime();
    if (!Number.isFinite(age) || age < -60_000 || age > MAX_AGE_MS) return skip("request_not_fresh");
    if (userId !== SERVICE_CALLER) {
      if (request.created_by !== userId) return skip("forbidden");
      const { data: caller, error: callerError } = await client.from("profiles")
        .select("role").eq("id", userId).maybeSingle();
      if (callerError) return skip("data_unavailable");
      if (!caller || !["admin", "management"].includes(caller.role)) return skip("forbidden");
    }
    if (!request.created_by) return skip("data_unavailable");
    const [jobResult, requesterResult, itemsResult] = await Promise.all([
      client.from("jobs").select("title,start_time,end_time,timezone").eq("id", request.job_id).maybeSingle(),
      client.from("profiles").select("first_name,last_name,email").eq("id", request.created_by).maybeSingle(),
      client.from("transport_request_items").select("transport_type,leftover_space_meters")
        .eq("request_id", request.id).order("created_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    if (jobResult.error || requesterResult.error || itemsResult.error ||
      !jobResult.data || !requesterResult.data || !Array.isArray(itemsResult.data)) return skip("data_unavailable");

    const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
    const from = normalizeEmail(Deno.env.get("BREVO_FROM"));
    if (!apiKey || !from) return skip("not_configured");
    const recipients = new Set<string>();
    // Pagination avoids silently dropping logistics profiles beyond the API row cap.
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: profiles, error: profilesError } = await client.from("profiles")
        .select("email").eq("department", "logistics").order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (profilesError || !Array.isArray(profiles)) return skip("data_unavailable");
      for (const profile of profiles) {
        const email = normalizeEmail(profile.email);
        if (email) recipients.add(email);
      }
      if (profiles.length < PAGE_SIZE) break;
    }
    if (!recipients.size) return skip("no_recipients");
    const requester = requesterResult.data as TransportEmailProfile;
    const content = formatTransportRequestEmail(request, jobResult.data as TransportEmailJob,
      requester, itemsResult.data as TransportEmailItem[]);
    // Logistics replies land with the requester, not the unattended corporate sender.
    const replyToEmail = normalizeEmail(requester.email);
    const replyToName = [requester.first_name, requester.last_name].filter(Boolean).join(" ")
      // Profile names are user-editable; never let control characters reach the header.
      .replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
    const replyTo = replyToEmail
      ? { replyTo: { email: replyToEmail, ...(replyToName ? { name: replyToName } : {}) } }
      : {};
    const result: TransportRequestEmailResult = { status: "sent", sent: 0, failed: 0, skipped: 0 };
    const emails = Array.from(recipients);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, emails.length) }, async () => {
      while (next < emails.length) {
        const email = emails[next++];
        try {
          const response = await sendBrevoEmail(apiKey, {
            sender: { email: from, name: "Área Técnica | Sector Pro" },
            to: [{ email }],
            ...replyTo,
            ...content,
            headers: { idempotencyKey: await idempotencyKey(request.id, email) },
          }, { timeoutMs: 10_000 });
          if (response.ok) result.sent++;
          else if (await isDuplicate(response)) result.skipped++;
          else result.failed++;
        } catch { result.failed++; }
      }
    }));
    result.status = result.failed ? (result.sent || result.skipped ? "partial" : "failed")
      : result.sent ? "sent" : "skipped";
    return result;
  } catch {
    // Never expose provider response bodies, addresses, or request content to push logs.
    return skip("unexpected_error");
  }
}
