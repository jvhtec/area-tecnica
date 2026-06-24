import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminOrManagement } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";

interface FetchFlexContactBody extends Record<string, unknown> {
  contact_id?: unknown;
  url?: unknown;
}

function extractUuid(input: string): string | null {
  const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
  const m = (input || '').match(uuidRe);
  return m?.[0] || null;
}

serve(createHttpHandler(async (req: Request) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));
  const flexAuthToken =
    Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";

  if (!flexAuthToken) {
    throw new HttpError(503, "Flex auth not configured", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await requireAdminOrManagement(supabase, req, {
    logContext: "fetch-flex-contact-info",
  });

  const body = await readBoundedJsonObject<FetchFlexContactBody>(req, { maxBytes: 16 * 1024 });

  // Parse contact id
  const contactInput = typeof body.contact_id === "string" ? body.contact_id : "";
  const urlInput = typeof body.url === "string" ? body.url : "";
  const cid = extractUuid(contactInput) || extractUuid(urlInput);
  if (!cid) {
    throw new HttpError(400, "Missing contact_id or url", {
      code: "missing_flex_contact_id",
    });
  }

  // Call Flex key-info
  const qs = new URLSearchParams();
  qs.set('_dc', String(Date.now()));
  const url = `https://sectorpro.flexrentalsolutions.com/f5/api/contact/${encodeURIComponent(cid)}/key-info/?${qs.toString()}`;
  const res = await fetchWithRetry(url, { headers: { 'X-Auth-Token': flexAuthToken, 'apikey': flexAuthToken, 'X-Requested-With': 'XMLHttpRequest' } });
  if (!res.ok) {
    throw new HttpError(502, `Flex error ${res.status}`, {
      code: "flex_upstream_error",
    });
  }
  const info = await res.json();

  // Map to our profile fields
  const firstName = info?.firstName || '';
  const lastName = info?.lastName || '';
  const email = info?.defaultEmail?.url || '';
  const dial = info?.defaultPhone?.dialNumber || '';
  const cc = info?.defaultPhone?.countryCode || '';
  const phone = [cc ? `+${cc}` : '', dial].filter(Boolean).join(' ');
  const residencia = info?.homeBaseLocation?.preferredDisplayString || info?.homeBaseLocation?.name || '';
  const dni = info?.assignedNumber || '';
  const contactTypeName = Array.isArray(info?.contactTypes) && info.contactTypes.length ? String(info.contactTypes[0]?.name || '') : '';
  const dept = (() => {
    const s = contactTypeName.toLowerCase();
    if (/sonido|sound/.test(s)) return 'sound';
    if (/luz|luces|light/.test(s)) return 'lights';
    if (/video/.test(s)) return 'video';
    return null;
  })();

  return jsonResponse({
    ok: true,
    contact_id: cid,
    mapped: { firstName, lastName, email, phone, residencia, dni, department: dept },
  });
}, {
  allowedMethods: ["POST"],
}));
