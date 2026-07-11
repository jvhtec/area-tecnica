import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readJsonObject,
  requireBearerToken,
  requireEnvValues,
} from "../_shared/http.ts";
import { normalizeBaseUrl } from "../_shared/waha.ts";

type Action = "get" | "save" | "status" | "start" | "restart" | "qr" | "endpoints";

type RequestBody = Record<string, unknown> & {
  action?: unknown;
  endpoint?: unknown;
};

type ProfileRow = {
  id: string;
  role: string | null;
  waha_endpoint: string | null;
};

type WahaConfigRow = {
  api_key?: string | null;
  session?: string | null;
};

type WahaSessionInfo = {
  name?: string;
  status?: string;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
};

type WahaEndpointOption = {
  label: string;
  value: string;
};

type WahaEndpointStatus = WahaEndpointOption & {
  session: string;
  status: string;
  me: WahaSessionInfo["me"];
  error?: string | null;
};

const DEFAULT_ENDPOINT_FAMILY_MAX = 6;
const MAX_ENDPOINT_FAMILY_MAX = 100;
const WAHA_ENDPOINT_ROOT_DOMAIN = "sector-pro.work";

const ACTIONS = ["get", "save", "status", "start", "restart", "qr", "endpoints"] as const;

function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function wahaEndpointForIndex(index: number) {
  return index === 1
    ? `https://waha.${WAHA_ENDPOINT_ROOT_DOMAIN}`
    : `https://waha${index}.${WAHA_ENDPOINT_ROOT_DOMAIN}`;
}

function getWahaEndpointLabel(endpoint: string) {
  try {
    const host = new URL(normalizeBaseUrl(endpoint)).hostname.toLowerCase();
    const match = host.match(/^waha(\d*)\.sector-pro\.work$/);
    if (match) {
      return `WAHA ${match[1] ? Number(match[1]) : 1}`;
    }

    return host;
  } catch {
    return endpoint;
  }
}

function pushEndpointOption(options: Map<string, WahaEndpointOption>, endpoint: string) {
  try {
    const normalized = normalizeEndpointForStorage(endpoint);
    if (!normalized) return;

    const host = new URL(normalized).host.toLowerCase();
    options.set(host, {
      label: getWahaEndpointLabel(normalized),
      value: normalized,
    });
  } catch {
    console.warn("Ignoring invalid WAHA endpoint option");
  }
}

function getConfiguredEndpointOptions(extraEndpoints: Array<string | null | undefined> = []) {
  const familyMax = parsePositiveInt(
    Deno.env.get("WAHA_ENDPOINT_FAMILY_MAX"),
    DEFAULT_ENDPOINT_FAMILY_MAX,
    MAX_ENDPOINT_FAMILY_MAX,
  );
  const options = new Map<string, WahaEndpointOption>();

  for (let index = 1; index <= familyMax; index += 1) {
    pushEndpointOption(options, wahaEndpointForIndex(index));
  }

  for (const endpoint of (Deno.env.get("WAHA_ALLOWED_ENDPOINTS") || "").split(",")) {
    pushEndpointOption(options, endpoint);
  }

  for (const endpoint of extraEndpoints) {
    if (endpoint) pushEndpointOption(options, endpoint);
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}

function getAllowedEndpointHosts() {
  return new Set(
    getConfiguredEndpointOptions().map((endpoint) => new URL(endpoint.value).host.toLowerCase()),
  );
}

function normalizeEndpointForStorage(endpoint: unknown) {
  if (endpoint == null) return null;

  if (typeof endpoint !== "string") {
    throw new HttpError(400, "Invalid WAHA endpoint", { code: "invalid_endpoint" });
  }

  const trimmed = endpoint.trim();
  if (!trimmed) return null;

  const base = normalizeBaseUrl(trimmed);
  let parsed: URL;

  try {
    parsed = new URL(base);
  } catch {
    throw new HttpError(400, "Invalid WAHA endpoint", { code: "invalid_endpoint" });
  }

  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";

  if (parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }

  if (parsed.protocol !== "https:") {
    throw new HttpError(400, "WAHA endpoint must use HTTPS", { code: "invalid_endpoint_scheme" });
  }

  return parsed.toString().replace(/\/+$/, "");
}

function assertAllowedEndpoint(endpoint: string) {
  const host = new URL(endpoint).host.toLowerCase();
  const allowedHosts = getAllowedEndpointHosts();

  if (allowedHosts.has(host)) {
    return;
  }

  throw new HttpError(400, "WAHA endpoint is not allowed", {
    code: "endpoint_not_allowed",
  });
}

function headersFor(apiKey: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("timeout", "AbortError")), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readWahaJson<T>(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (/application\/json/i.test(contentType)) {
    return await res.json().catch(() => null) as T | null;
  }

  return null;
}

async function readWahaError(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (/application\/json/i.test(contentType)) {
    const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
    const message = typeof payload?.message === "string" ? payload.message : typeof payload?.error === "string" ? payload.error : null;
    return message || JSON.stringify(payload || {});
  }

  return (await res.text().catch(() => "")).slice(0, 500);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function parseQrJson(payload: Record<string, unknown>) {
  const mimetype = typeof payload.mimetype === "string" ? payload.mimetype : "image/png";
  const data = typeof payload.data === "string"
    ? payload.data
    : typeof payload.qrCode === "string"
      ? payload.qrCode
      : null;

  if (!data) return null;

  return data.startsWith("data:")
    ? { dataUrl: data, mimetype }
    : { dataUrl: `data:${mimetype};base64,${data}`, mimetype };
}

async function getWahaConfig(supabaseAdmin: ReturnType<typeof createClient>, endpoint: string) {
  const { data, error } = await supabaseAdmin.rpc("get_waha_config", { base_url: endpoint });
  if (error) {
    console.warn("get_waha_config RPC failed, falling back to env vars:", error.message);
  }

  const row = (data as WahaConfigRow[] | null)?.[0];

  return {
    apiKey: row?.api_key || Deno.env.get("WAHA_API_KEY") || "",
    session: row?.session || Deno.env.get("WAHA_SESSION") || "default",
  };
}

async function getSessionStatus(
  endpoint: string,
  session: string,
  apiKey: string,
  timeoutMs = Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000),
) {
  const url = `${endpoint}/api/sessions/${encodeURIComponent(session)}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: headersFor(apiKey),
  }, timeoutMs);

  if (res.status === 404) {
    return {
      endpoint,
      session,
      status: "NOT_CREATED",
      me: null,
    };
  }

  if (!res.ok) {
    throw new HttpError(502, "WAHA status request failed", {
      code: "waha_status_failed",
      details: { status: res.status, body: await readWahaError(res) },
      exposeDetails: true,
    });
  }

  const payload = await readWahaJson<WahaSessionInfo>(res);

  return {
    endpoint,
    session,
    status: payload?.status || "UNKNOWN",
    me: payload?.me || null,
  };
}

async function ensureSessionStarted(endpoint: string, session: string, apiKey: string) {
  const current = await getSessionStatus(endpoint, session, apiKey);
  const timeoutMs = Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000);

  if (current.status === "NOT_CREATED") {
    const createRes = await fetchWithTimeout(`${endpoint}/api/sessions`, {
      method: "POST",
      headers: headersFor(apiKey),
      body: JSON.stringify({ name: session }),
    }, timeoutMs);

    if (!createRes.ok && createRes.status !== 409) {
      throw new HttpError(502, "WAHA session create request failed", {
        code: "waha_session_create_failed",
        details: { status: createRes.status, body: await readWahaError(createRes) },
        exposeDetails: true,
      });
    }
  } else if (current.status === "STOPPED" || current.status === "FAILED") {
    const startRes = await fetchWithTimeout(`${endpoint}/api/sessions/${encodeURIComponent(session)}/start`, {
      method: "POST",
      headers: headersFor(apiKey),
      body: JSON.stringify({}),
    }, timeoutMs);

    if (!startRes.ok) {
      throw new HttpError(502, "WAHA session start request failed", {
        code: "waha_session_start_failed",
        details: { status: startRes.status, body: await readWahaError(startRes) },
        exposeDetails: true,
      });
    }
  }

  return getSessionStatus(endpoint, session, apiKey);
}

async function restartSession(endpoint: string, session: string, apiKey: string) {
  const current = await getSessionStatus(endpoint, session, apiKey);
  if (current.status === "NOT_CREATED") {
    return ensureSessionStarted(endpoint, session, apiKey);
  }

  const res = await fetchWithTimeout(`${endpoint}/api/sessions/${encodeURIComponent(session)}/restart`, {
    method: "POST",
    headers: headersFor(apiKey),
    body: JSON.stringify({}),
  }, Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000));

  if (!res.ok) {
    throw new HttpError(502, "WAHA session restart request failed", {
      code: "waha_session_restart_failed",
      details: { status: res.status, body: await readWahaError(res) },
      exposeDetails: true,
    });
  }

  return getSessionStatus(endpoint, session, apiKey);
}

function wahaEndpointErrorMessage(error: unknown) {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error) return error.message;
  return "WAHA status request failed";
}

async function getEndpointStatuses(
  supabaseAdmin: ReturnType<typeof createClient>,
  extraEndpoints: Array<string | null | undefined> = [],
) {
  const timeoutMs = Number(Deno.env.get("WAHA_ENDPOINT_STATUS_TIMEOUT_MS") || 2500);
  const options = getConfiguredEndpointOptions(extraEndpoints);

  return await Promise.all(options.map(async (option): Promise<WahaEndpointStatus> => {
    const { apiKey, session } = await getWahaConfig(supabaseAdmin, option.value);

    try {
      const status = await getSessionStatus(option.value, session, apiKey, timeoutMs);

      return {
        ...option,
        session: status.session,
        status: status.status,
        me: status.me,
        error: null,
      };
    } catch (error) {
      return {
        ...option,
        session,
        status: "UNREACHABLE",
        me: null,
        error: wahaEndpointErrorMessage(error),
      };
    }
  }));
}

async function getQr(endpoint: string, session: string, apiKey: string) {
  const res = await fetchWithTimeout(`${endpoint}/api/${encodeURIComponent(session)}/auth/qr`, {
    method: "GET",
    headers: {
      ...headersFor(apiKey),
      Accept: "image/png",
    },
  }, Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000));

  if (!res.ok) {
    throw new HttpError(502, "WAHA QR request failed", {
      code: "waha_qr_failed",
      details: { status: res.status, body: await readWahaError(res) },
      exposeDetails: true,
    });
  }

  const contentType = res.headers.get("content-type") || "";

  if (/application\/json/i.test(contentType)) {
    const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
    const parsed = payload ? parseQrJson(payload) : null;
    if (parsed) return parsed;
  }

  const mimetype = /image\/[a-z0-9.+-]+/i.test(contentType) ? contentType : "image/png";
  const data = arrayBufferToBase64(await res.arrayBuffer());

  return {
    dataUrl: `data:${mimetype};base64,${data}`,
    mimetype,
  };
}

async function loadActorProfile(supabaseAdmin: ReturnType<typeof createClient>, token: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const actorId = userData?.user?.id || null;

  if (userError || !actorId) {
    throw new HttpError(401, "Unauthorized", { code: "unauthorized" });
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, waha_endpoint")
    .eq("id", actorId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new HttpError(403, "Profile not found", { code: "profile_not_found" });

  const actorProfile = profile as ProfileRow;
  if (!["admin", "management"].includes((actorProfile.role || "").toLowerCase())) {
    throw new HttpError(403, "Forbidden", { code: "forbidden" });
  }

  return actorProfile;
}

async function loadEndpointContext(supabaseAdmin: ReturnType<typeof createClient>, profile: ProfileRow) {
  const endpoint = normalizeEndpointForStorage(profile.waha_endpoint);
  if (!endpoint) {
    return {
      endpoint: null,
      session: "default",
      apiKey: "",
    };
  }

  const config = await getWahaConfig(supabaseAdmin, endpoint);

  return {
    endpoint,
    ...config,
  };
}

async function handler(req: Request) {
  const env = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, Deno.env.get);
  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const token = requireBearerToken(req);
  const profile = await loadActorProfile(supabaseAdmin, token);
  const body = await readJsonObject<RequestBody>(req);
  const action = typeof body.action === "string" ? body.action : "get";

  if (!isAction(action)) {
    throw new HttpError(400, "Invalid WAHA action", { code: "invalid_action" });
  }

  if (action === "save") {
    const endpoint = normalizeEndpointForStorage(body.endpoint);
    if (endpoint) assertAllowedEndpoint(endpoint);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ waha_endpoint: endpoint })
      .eq("id", profile.id);

    if (error) throw error;

    return jsonResponse({
      endpoint,
      session: endpoint ? (await getWahaConfig(supabaseAdmin, endpoint)).session : "default",
      status: endpoint ? "UNKNOWN" : "NOT_CONFIGURED",
      me: null,
      endpoints: getConfiguredEndpointOptions([endpoint]),
    });
  }

  const context = await loadEndpointContext(supabaseAdmin, profile);

  if (!context.endpoint) {
    return jsonResponse({
      endpoint: null,
      session: context.session,
      status: "NOT_CONFIGURED",
      me: null,
      endpoints: action === "endpoints" ? await getEndpointStatuses(supabaseAdmin) : getConfiguredEndpointOptions(),
    });
  }

  if (action === "get") {
    return jsonResponse({
      endpoint: context.endpoint,
      session: context.session,
      status: "UNKNOWN",
      me: null,
      endpoints: getConfiguredEndpointOptions([context.endpoint]),
    });
  }

  if (action === "endpoints") {
    return jsonResponse({
      endpoint: context.endpoint,
      session: context.session,
      status: "UNKNOWN",
      me: null,
      endpoints: await getEndpointStatuses(supabaseAdmin, [context.endpoint]),
    });
  }

  if (action === "status") {
    return jsonResponse(await getSessionStatus(context.endpoint, context.session, context.apiKey));
  }

  if (action === "start") {
    return jsonResponse(await ensureSessionStarted(context.endpoint, context.session, context.apiKey));
  }

  if (action === "restart") {
    return jsonResponse(await restartSession(context.endpoint, context.session, context.apiKey));
  }

  const status = await ensureSessionStarted(context.endpoint, context.session, context.apiKey);
  const qr = await getQr(context.endpoint, context.session, context.apiKey);

  return jsonResponse({
    ...status,
    qr,
  });
}

serve(createHttpHandler(handler, {
  allowedMethods: ["POST"],
  onError: (error) => {
    console.error("waha-session failed", error);
  },
}));
