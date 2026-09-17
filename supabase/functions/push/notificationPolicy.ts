import type { SupabaseClient } from "./deps.ts";
import type { BroadcastBody, PushPayload } from "./types.ts";
import { logEvent } from "../_shared/structuredLogger.ts";

export type NotificationCategory =
  | "jobs"
  | "staffing"
  | "timesheets"
  | "tasks"
  | "messages"
  | "documents"
  | "logistics"
  | "tours"
  | "festival"
  | "system";

export type NotificationUrgency = "low" | "normal" | "high" | "urgent";

export type RecipientPreference = {
  accountEnabled: boolean;
  categoryEnabled: boolean;
  quietNow: boolean;
  muted: boolean;
};

type PreferenceRow = {
  user_id: string;
  account_enabled: boolean;
  category_preferences: Record<string, unknown> | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  urgent_bypass: boolean;
  muted_entities: unknown;
};

export function categoryForEvent(type: string): NotificationCategory {
  if (type.startsWith("staffing.") || type.startsWith("job.assignment") || type === "assignment.removed") return "staffing";
  if (type.startsWith("timesheet.")) return "timesheets";
  if (type.startsWith("task.")) return "tasks";
  if (type.startsWith("message.")) return "messages";
  if (type.startsWith("document.") || type.startsWith("hoja.")) return "documents";
  if (type.startsWith("logistics.")) return "logistics";
  if (type.startsWith("tourdate.")) return "tours";
  if (type.startsWith("festival.") || type.includes("feed")) return "festival";
  if (type.startsWith("job.") || type.startsWith("jobdate.")) return "jobs";
  return "system";
}

export function urgencyForEvent(type: string): NotificationUrgency {
  if (
    type.includes("cancelled")
    || type === "assignment.removed"
    || type === "incident.report.uploaded"
    || type === "timesheet.rejected"
  ) return "urgent";
  if (
    type.includes("assignment")
    || type.includes("calltime")
    || type.startsWith("staffing.offer.")
    || type === "timesheet.approved"
  ) return "high";
  if (
    type.startsWith("document.")
    || type.startsWith("flex.")
    || type === "changelog.updated"
  ) return "low";
  return "normal";
}

export function ttlSecondsForUrgency(urgency: NotificationUrgency): number {
  if (urgency === "urgent") return 15 * 60;
  if (urgency === "high") return 60 * 60;
  if (urgency === "low") return 24 * 60 * 60;
  return 6 * 60 * 60;
}

function entityKey(body: BroadcastBody): string | null {
  const pairs = [
    ["job", body.job_id],
    ["tour", body.tour_id],
    ["task", body.task_id],
    ["message", body.message_id],
    ["request", body.request_id || body.staffing_request_id],
    ["document", body.doc_id || body.file_id],
    ["event", body.event_id],
  ] as const;
  const match = pairs.find(([, value]) => typeof value === "string" && value.length > 0);
  return match ? `${match[0]}:${match[1]}` : null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

async function shortHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 12)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildEventKey(body: BroadcastBody, now = Date.now()): Promise<string> {
  if (body.event_id) return `${body.type}:${body.event_id}`;
  const identity = {
    type: body.type,
    entity: entityKey(body),
    recipient: body.recipient_id,
    status: body.status || body.assignment_status,
    targetDate: body.target_date,
    changes: body.changes,
    fiveMinuteWindow: Math.floor(now / (5 * 60 * 1000)),
  };
  return `${body.type}:${await shortHash(identity)}`;
}

export function groupingTag(type: string, body: BroadcastBody): string {
  const entity = entityKey(body) ?? "general";
  return `${categoryForEvent(type)}:${entity}`.slice(0, 120);
}

function localMinutes(timeZone: string, now: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    return null;
  }
}

function timeMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

export function isWithinQuietHours(
  start: string,
  end: string,
  timeZone: string,
  now = new Date(),
): boolean {
  const current = localMinutes(timeZone, now);
  const startMinutes = timeMinutes(start);
  const endMinutes = timeMinutes(end);
  if (current === null || startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  return startMinutes < endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}

function isEntityMuted(mutedEntities: unknown, body: BroadcastBody): boolean {
  if (!Array.isArray(mutedEntities)) return false;
  const current = entityKey(body);
  return Boolean(current && mutedEntities.some((entry) => entry === current));
}

export async function loadRecipientPreferences(
  client: SupabaseClient,
  userIds: string[],
  body: BroadcastBody,
  urgency: NotificationUrgency,
  now = new Date(),
): Promise<Map<string, RecipientPreference>> {
  const result = new Map<string, RecipientPreference>();
  if (userIds.length === 0) return result;
  const category = categoryForEvent(body.type);
  const { data, error } = await client
    .from("notification_preferences")
    .select("user_id, account_enabled, category_preferences, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, urgent_bypass, muted_entities")
    .in("user_id", userIds)
    .returns<PreferenceRow[]>();
  if (error) {
    logEvent("error", "push_preference_lookup_failed", {
      errorCode: error.code ?? "unknown",
    });
    // Fail closed: a transient lookup error must not fall through to the
    // default (fully enabled) preference and override a stored opt-out.
    throw error;
  }
  const byUser = new Map((data ?? []).map((row) => [row.user_id, row]));
  for (const userId of userIds) {
    const row = byUser.get(userId);
    const urgentAllowed = urgency === "urgent" && (row?.urgent_bypass ?? true);
    result.set(userId, {
      accountEnabled: row?.account_enabled ?? true,
      categoryEnabled: row?.category_preferences?.[category] !== false,
      quietNow: Boolean(
        row?.quiet_hours_enabled
        && !urgentAllowed
        && isWithinQuietHours(
          row.quiet_hours_start,
          row.quiet_hours_end,
          row.quiet_hours_timezone,
          now,
        )
      ),
      muted: isEntityMuted(row?.muted_entities, body) && !urgentAllowed,
    });
  }
  return result;
}

export function decoratePayloadPolicy(
  payload: PushPayload,
  body: BroadcastBody,
  eventKey: string,
  urgency: NotificationUrgency,
): PushPayload {
  return {
    ...payload,
    eventKey,
    urgency,
    ttlSeconds: ttlSecondsForUrgency(urgency),
    meta: {
      ...(payload.meta ?? {}),
      eventKey,
      category: categoryForEvent(body.type),
      urgency,
      tag: groupingTag(body.type, body),
      renotify: urgency === "urgent" || urgency === "high",
    },
  };
}
