export type Action =
  | "subscribe"
  | "unsubscribe"
  | "subscribe_native"
  | "unsubscribe_native"
  | "test"
  | "broadcast"
  | "check_scheduled";

export type SubscribeBody = {
  action: "subscribe";
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
};

export type UnsubscribeBody = {
  action: "unsubscribe";
  endpoint: string;
};

export type SubscribeNativeBody = {
  action: "subscribe_native";
  token: string;
  platform?: string;
  device_id?: string;
  device_name?: string;
};

export type UnsubscribeNativeBody = {
  action: "unsubscribe_native";
  token?: string;
  platform?: string;
};

export type TestBody = {
  action: "test";
  url?: string;
};

export type BroadcastBody = {
  action: "broadcast";
  type: string; // e.g., 'job.created', 'job.updated', 'document.uploaded', 'document.tech_visible.enabled', 'staffing.availability.sent', etc.
  job_id?: string;
  url?: string;
  // Optional targeting hints
  recipient_id?: string; // direct user to notify (e.g., technician)
  user_ids?: string[]; // explicit recipients
  // Optional meta for message composition
  doc_id?: string;
  file_name?: string;
  event_id?: string;
  event_type?: string;
  event_date?: string;
  event_time?: string;
  transport_type?: string;
  loading_bay?: string | null;
  title?: string | null;
  departments?: string[];
  auto_created_unload?: boolean;
  paired_event_type?: string;
  paired_event_date?: string;
  paired_event_time?: string;
  // SoundVision events should include either venue_name or enough identifiers to resolve it server-side
  file_id?: string;
  venue_id?: string;
  venue_name?: string;
  actor_name?: string;
  actor_id?: string;
  recipient_name?: string;
  artist_id?: string;
  artist_name?: string;
  artist_date?: string;
  channel?: 'email' | 'whatsapp';
  status?: string; // confirmed | cancelled | declined
  assignment_status?: string; // confirmed | invited (for direct assignments)
  changes?: Record<string, { from?: unknown; to?: unknown } | unknown> | Record<string, unknown>;
  message_preview?: string;
  message_id?: string;
  // Tour/Tourdate optional hints
  tour_id?: string;
  tour_date_id?: string;
  tour_name?: string;
  dates_count?: number;
  // Tour date type change hints
  location_name?: string;
  old_type?: string;
  new_type?: string;
};

export type CheckScheduledBody = {
  action: "check_scheduled";
  type: string; // e.g., 'daily.morning.summary'
  force?: boolean; // For testing: skip time check
};

export type RequestBody =
  | SubscribeBody
  | UnsubscribeBody
  | SubscribeNativeBody
  | UnsubscribeNativeBody
  | TestBody
  | BroadcastBody
  | CheckScheduledBody;

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

export type NativePushTokenRow = {
  user_id: string;
  device_token: string;
  platform: string;
};

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  type?: string;
  meta?: Record<string, unknown>;
};

export type PushSendResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; status: number };

export type PushNotificationRoute = {
  event_code: string;
  recipient_type: 'management_user' | 'department' | 'broadcast' | 'natural' | 'assigned_technicians';
  target_id: string | null;
  include_natural_recipients: boolean;
};

export type DepartmentRoleSummary = {
  department: string;
  total_required: number;
  roles: Array<{ role_code: string; quantity: number; notes?: string | null }>;
};
