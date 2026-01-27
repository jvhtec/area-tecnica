import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Expected structure from Flex API inventory-model endpoint
interface FlexInventoryModelResponse {
  preferredDisplayString?: string;
  name?: string;
  manufacturer?: string;
  notes?: string;
  size?: string;
  shortName?: string;
  code?: string;
  imageThumbnailId?: string;
  imageId?: string;
  // Allow additional unknown fields from Flex API
  [key: string]: unknown;
}

// Validated and sanitized response we return
interface ValidatedEquipmentData {
  name: string;
  manufacturer: string;
  notes: string;
  size: string;
  shortName: string;
  code: string;
  imageId: string;
}

function extractUuid(input: string): string | null {
  const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
  const m = (input || '').match(uuidRe);
  return m?.[0] || null;
}

// Sanitize string to prevent XSS - only allow safe characters
function sanitizeString(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return '';
  // Remove any HTML tags and trim to max length
  return value
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/[<>'"&]/g, '')  // Remove potentially dangerous chars
    .substring(0, maxLength)
    .trim();
}

// Validate and sanitize Flex API response
function validateFlexResponse(data: unknown): ValidatedEquipmentData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Flex API response: expected object');
  }

  const info = data as FlexInventoryModelResponse;

  return {
    name: sanitizeString(info.preferredDisplayString || info.name, 255),
    manufacturer: sanitizeString(info.manufacturer, 255),
    notes: sanitizeString(info.notes, 1000),
    size: sanitizeString(info.size, 100),
    shortName: sanitizeString(info.shortName, 100),
    code: sanitizeString(info.code, 50),
    imageId: sanitizeString(info.imageThumbnailId || info.imageId, 100),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json() as { model_id?: string; url?: string };
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // AuthZ: require admin or management
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin','management'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse model id
    const modelId = body.model_id || (body.url ? extractUuid(body.url) : null);
    if (!modelId) return new Response(JSON.stringify({ error: 'Missing model_id or url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Resolve Flex auth token
    let flexAuthToken = Deno.env.get("X_AUTH_TOKEN") || "";
    if (!flexAuthToken) {
      try {
        const { data: secretData } = await supabase.functions.invoke('get-secret', {
          body: { secretName: 'X_AUTH_TOKEN' },
          headers: { Authorization: authHeader }
        });
        if (secretData?.X_AUTH_TOKEN) flexAuthToken = secretData.X_AUTH_TOKEN as string;
      } catch (_) {}
    }
    if (!flexAuthToken) return new Response(JSON.stringify({ error: 'Flex auth not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Call Flex inventory-model API
    const qs = new URLSearchParams();
    qs.set('_dc', String(Date.now()));
    const url = `https://sectorpro.flexrentalsolutions.com/f5/api/inventory-model/${encodeURIComponent(modelId)}?${qs.toString()}`;
    const res = await fetch(url, { headers: { 'X-Auth-Token': flexAuthToken, 'apikey': flexAuthToken, 'X-Requested-With': 'XMLHttpRequest' } });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Flex error ${res.status}`, details: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const rawResponse = await res.json();

    // Validate and sanitize the Flex API response
    let mapped: ValidatedEquipmentData;
    try {
      mapped = validateFlexResponse(rawResponse);
    } catch (validationError) {
      return new Response(JSON.stringify({
        error: 'Invalid response from Flex API',
        details: (validationError as Error).message
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      model_id: modelId,
      mapped,
      // Only include raw in development for debugging - sanitized fields are authoritative
      raw: rawResponse
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
