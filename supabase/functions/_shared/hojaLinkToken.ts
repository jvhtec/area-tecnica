const encoder = new TextEncoder();

export const DEFAULT_JOB_HOJA_LINK_TTL_SECONDS = 60 * 60 * 24 * 365;
const MAX_JOB_HOJA_LINK_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function normalizeJobId(jobId: string): string {
  return jobId.trim();
}

function payloadFor(jobId: string, expiresAt: number): string {
  return `${normalizeJobId(jobId)}.${Math.trunc(expiresAt)}`;
}

export function getJobHojaLinkSecret(getEnv: (name: string) => string | undefined): string {
  return (
    getEnv("JOB_HOJA_LINK_SECRET") ||
    getEnv("HOJA_DE_RUTA_LINK_SECRET") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

export function resolveJobHojaLinkTtlSeconds(
  getEnv: (name: string) => string | undefined,
  fallback = DEFAULT_JOB_HOJA_LINK_TTL_SECONDS,
): number {
  const raw = getEnv("JOB_HOJA_LINK_TTL_SECONDS");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const ttl = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(Math.max(60, ttl), MAX_JOB_HOJA_LINK_TTL_SECONDS);
}

export function computeJobHojaLinkExpiry(
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_JOB_HOJA_LINK_TTL_SECONDS,
): number {
  return Math.trunc(nowSeconds) + Math.trunc(ttlSeconds);
}

export async function signJobHojaLink(args: {
  jobId: string;
  expiresAt: number;
  secret: string;
}): Promise<string> {
  const jobId = normalizeJobId(args.jobId);
  const expiresAt = Math.trunc(args.expiresAt);

  if (!jobId || !Number.isFinite(expiresAt) || !args.secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(args.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadFor(jobId, expiresAt)));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyJobHojaLink(args: {
  jobId: string;
  expiresAt: number;
  token: string;
  secret: string;
  nowSeconds?: number;
}): Promise<boolean> {
  const jobId = normalizeJobId(args.jobId);
  const expiresAt = Math.trunc(args.expiresAt);
  const token = args.token.trim();
  const nowSeconds = Math.trunc(args.nowSeconds ?? Date.now() / 1000);

  if (!jobId || !token || !args.secret || !Number.isFinite(expiresAt)) {
    return false;
  }

  if (expiresAt <= nowSeconds) {
    return false;
  }

  const expected = await signJobHojaLink({
    jobId,
    expiresAt,
    secret: args.secret,
  });

  return expected ? timingSafeEqual(token, expected) : false;
}

export function buildJobHojaLinkUrl(args: {
  requestUrl: string;
  jobId: string;
  expiresAt: number;
  token: string;
}): string {
  const url = new URL(args.requestUrl);
  const pathParts = url.pathname.split("/");
  pathParts[pathParts.length - 1] = "job-hoja-de-ruta-link";
  url.pathname = pathParts.join("/") || "/job-hoja-de-ruta-link";
  url.search = "";
  url.hash = "";
  url.searchParams.set("job_id", normalizeJobId(args.jobId));
  url.searchParams.set("exp", String(Math.trunc(args.expiresAt)));
  url.searchParams.set("t", args.token);
  return url.toString();
}
