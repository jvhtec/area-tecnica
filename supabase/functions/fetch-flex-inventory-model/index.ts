import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function extractUuid(input: string): string | null {
  const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
  const m = (input || '').match(uuidRe);
  return m?.[0] || null;
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
    const info = await res.json();

    // Map to our equipment fields
    const name = info?.preferredDisplayString || info?.name || '';
    const manufacturer = info?.manufacturer || '';
    const notes = info?.notes || '';
    const size = info?.size || '';
    const shortName = info?.shortName || '';
    const code = info?.code || '';
    const imageId = info?.imageThumbnailId || info?.imageId || '';

    return new Response(JSON.stringify({
      ok: true,
      model_id: modelId,
      mapped: { name, manufacturer, notes, size, shortName, code, imageId },
      raw: info
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
