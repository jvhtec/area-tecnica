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

    // Check required environment variables
    console.log('🔧 CHECKING ENV VARIABLES:', {
      DAILY_CAP: { value: DAILY_CAP, exists: !!DAILY_CAP },
      TOKEN_SECRET: { exists: !!TOKEN_SECRET, length: TOKEN_SECRET?.length },
      CONFIRM_BASE: { exists: !!CONFIRM_BASE, value: CONFIRM_BASE },
      BREVO_KEY: { exists: !!BREVO_KEY, length: BREVO_KEY?.length },
      BREVO_FROM: { exists: !!BREVO_FROM, value: BREVO_FROM }
    });

    if (!TOKEN_SECRET || !CONFIRM_BASE || !BREVO_KEY || !BREVO_FROM) {
      const missingEnvs = [];
      if (!TOKEN_SECRET) missingEnvs.push('STAFFING_TOKEN_SECRET');
      if (!CONFIRM_BASE) missingEnvs.push('PUBLIC_CONFIRM_BASE');
      if (!BREVO_KEY) missingEnvs.push('BREVO_API_KEY');
      if (!BREVO_FROM) missingEnvs.push('BREVO_FROM');
      
      console.error('❌ MISSING ENV VARIABLES:', missingEnvs);
      return new Response(JSON.stringify({ 
        error: "Server configuration error", 
        details: { missing_env_vars: missingEnvs }
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Step 1: Check daily cap
      console.log('📊 CHECKING DAILY CAP...');
      const since = new Date(Date.now() - 24*60*60*1000).toISOString();
      const { count, error: capError } = await supabase.from("staffing_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .eq("event", "email_sent");
      
      if (capError) {
        console.error('❌ DAILY CAP CHECK ERROR:', capError);
        return new Response(JSON.stringify({ 
          error: "Database error checking daily cap", 
          details: capError 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('📊 DAILY CAP RESULT:', { count, limit: DAILY_CAP });
      if ((count ?? 0) >= DAILY_CAP) {
        console.log('⚠️ DAILY CAP REACHED');
        return new Response(JSON.stringify({ 
          error: "Daily email limit reached", 
          details: { current: count, limit: DAILY_CAP }
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Fetch job and profile data
      console.log('🔍 FETCHING JOB AND PROFILE DATA...');
      const [jobResult, techResult] = await Promise.all([
        supabase.from("jobs")
          .select(`
            id,
            title,
            start_time,
            end_time,
            locations!inner(formatted_address)
          `)
          .eq("id", job_id)
          .maybeSingle(),
        supabase.from("profiles").select("id,first_name,last_name,email").eq("id", profile_id).maybeSingle()
      ]);
      
      console.log('📋 JOB RESULT:', { data: jobResult.data, error: jobResult.error });
      console.log('👤 PROFILE RESULT:', { 
        data: techResult.data ? { ...techResult.data, email: techResult.data.email ? '***@***.***' : null } : null, 
        error: techResult.error 
      });

      if (jobResult.error) {
        console.error('❌ JOB FETCH ERROR:', jobResult.error);
        return new Response(JSON.stringify({ 
          error: "Error fetching job data", 
          details: jobResult.error 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (techResult.error) {
        console.error('❌ PROFILE FETCH ERROR:', techResult.error);
        return new Response(JSON.stringify({ 
          error: "Error fetching profile data", 
          details: techResult.error 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const job = jobResult.data;
      const tech = techResult.data;
      
      if (!job) {
        console.error('❌ JOB NOT FOUND:', job_id);
        return new Response(JSON.stringify({ 
          error: "Job not found", 
          details: { job_id }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!tech?.email) {
        console.error('❌ PROFILE NOT FOUND OR NO EMAIL:', { profile_id, has_email: !!tech?.email });
        return new Response(JSON.stringify({ 
          error: "Profile not found or no email address", 
          details: { profile_id, has_profile: !!tech, has_email: !!tech?.email }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
      console.log('👤 TECH INFO:', { fullName, email: '***@***.***' });

      // Step 3: Generate token
      console.log('🔐 GENERATING TOKEN...');
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
      console.log('🔐 TOKEN GENERATED:', { rid, expires: exp });

      // Step 4: Insert/update staffing request
      console.log('💾 SAVING STAFFING REQUEST...');
      let insertedId = rid;
      const insertRes = await supabase.from("staffing_requests").insert({
        id: rid, job_id, profile_id, phase, status: "pending",
        token_hash, token_expires_at: exp
      });
      
      console.log('💾 INSERT RESULT:', { error: insertRes.error });
      
      if (insertRes.error && insertRes.error.code === "23505") {
        console.log('🔄 DUPLICATE FOUND, UPDATING...');
        const upd = await supabase.from("staffing_requests")
          .update({ token_hash, token_expires_at: exp, updated_at: new Date().toISOString() })
          .eq("job_id", job_id).eq("profile_id", profile_id).eq("phase", phase).eq("status", "pending")
          .select("id").maybeSingle();
        
        console.log('🔄 UPDATE RESULT:', { data: upd.data, error: upd.error });
        if (upd.data?.id) insertedId = upd.data.id;
      } else if (insertRes.error) {
        console.error('❌ STAFFING REQUEST INSERT ERROR:', insertRes.error);
        return new Response(JSON.stringify({ 
          error: "Database error saving request", 
          details: insertRes.error 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 5: Build email content
      console.log('📧 BUILDING EMAIL CONTENT...');
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
        <p>Venue: ${job.locations?.formatted_address ?? "TBD"}<br/>Call: ${job.start_time ? new Date(job.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "TBD"}</p>
      `;

      // Step 6: Send email via Brevo
      console.log('📤 SENDING EMAIL VIA BREVO...');
      const emailPayload = {
        sender: { email: BREVO_FROM },
        to: [{ email: tech.email }],
        subject,
        htmlContent: html
      };
      
      console.log('📤 EMAIL PAYLOAD:', { 
        sender: emailPayload.sender, 
        to: [{ email: '***@***.***' }], 
        subject: emailPayload.subject 
      });

      const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload)
      });

      console.log('📤 BREVO RESPONSE:', { 
        status: sendRes.status, 
        statusText: sendRes.statusText,
        ok: sendRes.ok 
      });

      // Step 7: Log the email event
      console.log('📊 LOGGING EMAIL EVENT...');
      const eventRes = await supabase.from("staffing_events").insert({
        staffing_request_id: insertedId, 
        event: "email_sent", 
        meta: { phase, status: sendRes.status }
      });
      
      console.log('📊 EVENT LOG RESULT:', { error: eventRes.error });

      // Step 8: Return result
      if (sendRes.ok) {
        console.log('✅ EMAIL SENT SUCCESSFULLY');
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const errorText = await sendRes.text();
        console.error('❌ BREVO EMAIL ERROR:', errorText);
        return new Response(JSON.stringify({ 
          error: "Email delivery failed", 
          details: { status: sendRes.status, message: errorText }
        }), { 
          status: sendRes.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (operationError) {
      console.error('❌ OPERATION ERROR:', operationError);
      return new Response(JSON.stringify({ 
        error: "Internal server error", 
        details: { message: operationError.message, stack: operationError.stack }
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error("Server error:", error);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});