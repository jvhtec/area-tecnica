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
    const body = await req.json() as { contact_id?: string; url?: string };
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

    // Parse contact id
    const cid = body.contact_id || (body.url ? extractUuid(body.url) : null);
    if (!cid) return new Response(JSON.stringify({ error: 'Missing contact_id or url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    // Call Flex key-info
    const qs = new URLSearchParams();
    qs.set('_dc', String(Date.now()));
    const url = `https://sectorpro.flexrentalsolutions.com/f5/api/contact/${encodeURIComponent(cid)}/key-info/?${qs.toString()}`;
    const res = await fetch(url, { headers: { 'X-Auth-Token': flexAuthToken, 'apikey': flexAuthToken, 'X-Requested-With': 'XMLHttpRequest' } });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Flex error ${res.status}`, details: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    return new Response(JSON.stringify({
      ok: true,
      contact_id: cid,
      mapped: { firstName, lastName, email, phone, residencia, dni, department: dept },
      raw: info
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

