import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_SECRET = Deno.env.get("STAFFING_TOKEN_SECRET")!;
const CONFIRM_BASE = Deno.env.get("PUBLIC_CONFIRM_BASE")!;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_FROM = Deno.env.get("BREVO_FROM")!;
const DAILY_CAP = parseInt(Deno.env.get("STAFFING_DAILY_CAP") ?? "100", 10);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64url(u8: Uint8Array) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();
    console.log('📥 RECEIVED PAYLOAD:', JSON.stringify(body, null, 2));
    
    const { job_id, profile_id, phase } = body;
    
    // Enhanced validation logging
    console.log('🔍 VALIDATING FIELDS:', {
      job_id: { value: job_id, type: typeof job_id, isValid: !!job_id },
      profile_id: { value: profile_id, type: typeof profile_id, isValid: !!profile_id },
      phase: { value: phase, type: typeof phase, isValidPhase: ["availability","offer"].includes(phase) }
    });
    
    if (!job_id || !profile_id || !["availability","offer"].includes(phase)) {
      const errorDetails = {
        missing_job_id: !job_id,
        missing_profile_id: !profile_id,
        invalid_phase: !["availability","offer"].includes(phase),
        received: { job_id, profile_id, phase }
      };
      console.error('❌ VALIDATION FAILED:', errorDetails);
      return new Response(JSON.stringify({ error: "Bad Request", details: errorDetails }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ VALIDATION PASSED - Proceeding with email send...');

    // Simple daily cap against events table
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { count } = await supabase.from("staffing_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("event", "email_sent");
    if ((count ?? 0) >= DAILY_CAP) return new Response("Daily cap reached", { status: 429, headers: corsHeaders });

    // Fetch job + tech email
    const [{ data: job }, { data: tech }] = await Promise.all([
      supabase.from("jobs").select("id,title,venue_address,call_time").eq("id", job_id).maybeSingle(),
      supabase.from("profiles").select("id,first_name,last_name,email").eq("id", profile_id).maybeSingle()
    ]);
    
    if (!job || !tech?.email) return new Response("Invalid job/profile", { status: 400, headers: corsHeaders });

    const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();

    // Build token (48h)
    const rid = crypto.randomUUID();
    const exp = new Date(Date.now() + 1000*60*60*48).toISOString();
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
      new TextEncoder().encode(`${rid}:${phase}:${exp}`)));
    const token = b64url(sig);

    // Store only hash of token bytes
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
    const token_hash = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');

    // Insert or update the single PENDING row for this (job, profile, phase)
    let insertedId = rid;
    const insertRes = await supabase.from("staffing_requests").insert({
      id: rid, job_id, profile_id, phase, status: "pending",
      token_hash, token_expires_at: exp
    });
    
    if (insertRes.error && insertRes.error.code === "23505") {
      const upd = await supabase.from("staffing_requests")
        .update({ token_hash, token_expires_at: exp, updated_at: new Date().toISOString() })
        .eq("job_id", job_id).eq("profile_id", profile_id).eq("phase", phase).eq("status", "pending")
        .select("id").maybeSingle();
      if (upd.data?.id) insertedId = upd.data.id;
    } else if (insertRes.error) {
      console.error("DB error:", insertRes.error);
      return new Response("DB error", { status: 500, headers: corsHeaders });
    }

    const confirmUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=confirm&exp=${encodeURIComponent(exp)}&t=${token}`;
    const declineUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=decline&exp=${encodeURIComponent(exp)}&t=${token}`;

    const subject = phase === "availability"
      ? `Are you available for ${job.title}?`
      : `Offer: ${job.title} — please confirm`;

    const html = `
      <p>Hi ${fullName || ""},</p>
      
      <p>${phase === "availability"
        ? `Please confirm your availability for <b>${job.title}</b>.`
        : `You have an offer for <b>${job.title}</b>. Please confirm:`}</p>
      <p>
        <a href="${confirmUrl}" style="color: #10b981; text-decoration: none;">✅ ${phase === "availability" ? "I am available" : "I accept the offer"}</a><br/>
        <a href="${declineUrl}" style="color: #ef4444; text-decoration: none;">❌ ${phase === "availability" ? "Not available" : "I decline"}</a>
      </p>
      <p>Venue: ${job.venue_address ?? ""}<br/>Call: ${job.call_time ?? ""}</p>
    `;

    const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: BREVO_FROM },
        to: [{ email: tech.email }],
        subject,
        htmlContent: html
      })
    });

    await supabase.from("staffing_events").insert({
      staffing_request_id: insertedId, event: "email_sent", meta: { phase, status: sendRes.status }
    });

    const result = sendRes.ok ? { success: true } : { error: await sendRes.text() };
    return new Response(JSON.stringify(result), { 
      status: sendRes.status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Server error:", error);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});