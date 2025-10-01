import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  message?: string;
  job_id?: string;
}

const WAREHOUSE_SOUND_GROUP = "120363042398076348@g.us"; // "Almacén sonido"

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const actorId = userData?.user?.id || null;
    if (!actorId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load actor profile to read role and WAHA endpoint
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, waha_endpoint')
      .eq('id', actorId)
      .maybeSingle();

    const role = (profile?.role || '').toLowerCase();
    if (!['admin', 'management'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!profile?.waha_endpoint) {
      return new Response(JSON.stringify({ error: 'Forbidden', reason: 'User not authorized for WhatsApp operations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = (await req.json().catch(() => ({}))) as SendRequest;
    let msg = (body.message || '').toString().trim();

    // Fallback: build a lightweight message from job context if provided
    if (!msg) {
      if (body.job_id) {
        const { data: job } = await supabaseAdmin
          .from('jobs')
          .select('title')
          .eq('id', body.job_id)
          .maybeSingle();
        const title = job?.title || 'trabajo';
        msg = `He hecho cambios en el PS del ${title} por favor echad un vistazo`;
      } else {
        msg = 'He hecho cambios en el PS, por favor echad un vistazo';
      }
    }

    const normalizeBase = (s: string) => {
      let b = (s || '').trim();
      if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
      return b.replace(/\/+$/, '');
    };

    const base = normalizeBase(profile.waha_endpoint);
    const session = Deno.env.get('WAHA_SESSION') || 'default';
    const apiKey = Deno.env.get('WAHA_API_KEY') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const sendUrl = `${base}/api/sendText`;
    const payload = { chatId: WAREHOUSE_SOUND_GROUP, text: msg, session, linkPreview: false } as const;
    const res = await fetch(sendUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'WAHA send failed', status: res.status, body: txt }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-warehouse-message error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
