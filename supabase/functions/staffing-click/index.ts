import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_SECRET = Deno.env.get("STAFFING_TOKEN_SECRET")!;

function b64uToU8(b64u: string) {
  const b64 = b64u.replace(/-/g,'+').replace(/_/g,'/') + '=='.slice(0,(4-(b64u.length%4))%4);
  const bin = atob(b64);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const rid = url.searchParams.get("rid");
    const action = url.searchParams.get("a"); // 'confirm' | 'decline'
    const exp = url.searchParams.get("exp");
    const t = url.searchParams.get("t");
    
    if (!rid || !action || !exp || !t) {
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Invalid Link</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">Invalid Link</h2>
          <p>This link is malformed or missing parameters.</p>
        </body></html>
      `, { 
        status: 400, 
        headers: { "content-type": "text/html" } 
      });
    }
    
    if (new Date(exp).getTime() < Date.now()) {
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Link Expired</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #f59e0b;">Link Expired</h2>
          <p>This link has expired. Please contact your project manager for a new link.</p>
        </body></html>
      `, { 
        status: 410, 
        headers: { "content-type": "text/html" } 
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row } = await supabase.from("staffing_requests").select("*").eq("id", rid).maybeSingle();
    
    if (!row) {
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">Request Not Found</h2>
          <p>This staffing request could not be found.</p>
        </body></html>
      `, { 
        status: 404, 
        headers: { "content-type": "text/html" } 
      });
    }

    // Recompute expected token hash (HMAC over rid:phase:exp)
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
      new TextEncoder().encode(`${rid}:${row.phase}:${exp}`)));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
    const token_hash_expected = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');

    // Compare provided token too (defense-in-depth)
    const providedHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b64uToU8(t))))
      .map(x=>x.toString(16).padStart(2,'0')).join('');

    if (token_hash_expected !== row.token_hash && providedHash !== row.token_hash) {
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Invalid Token</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #ef4444;">Invalid Token</h2>
          <p>This link is not valid. Please use the original link from your email.</p>
        </body></html>
      `, { 
        status: 403, 
        headers: { "content-type": "text/html" } 
      });
    }

    // Check if already responded
    if (row.status !== 'pending') {
      const statusText = row.status === 'confirmed' ? 'confirmed' : 'declined';
      return new Response(`
        <!DOCTYPE html>
        <html><head><title>Already Responded</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #f59e0b;">Already Responded</h2>
          <p>You have already ${statusText} this ${row.phase} request.</p>
          <p>You can close this tab now.</p>
        </body></html>
      `, { 
        headers: { "content-type": "text/html" } 
      });
    }

    const newStatus = action === "confirm" ? "confirmed" : "declined";
    await supabase.from("staffing_requests").update({ status: newStatus }).eq("id", rid);
    await supabase.from("staffing_events").insert({ staffing_request_id: rid, event: `clicked_${action}` });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Response Recorded</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background-color: #f9fafb;">
        <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
          <div style="font-size: 48px; margin-bottom: 16px;">
            ${newStatus === "confirmed" ? "✅" : "❌"}
          </div>
          <h2 style="color: ${newStatus === "confirmed" ? "#10b981" : "#6b7280"}; margin: 0 0 16px 0;">
            ${newStatus === "confirmed" ? "Thanks — confirmed!" : "Response recorded"}
          </h2>
          <p style="color: #6b7280; margin: 0;">
            Your ${row.phase} response has been recorded.
          </p>
          <p style="color: #9ca3af; margin: 16px 0 0 0; font-size: 14px;">
            You can close this tab now.
          </p>
        </div>
      </body>
      </html>
    `;
    
    return new Response(html, { headers: { "content-type": "text/html" } });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(`
      <!DOCTYPE html>
      <html><head><title>Server Error</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #ef4444;">Server Error</h2>
        <p>An unexpected error occurred. Please try again later.</p>
      </body></html>
    `, { 
      status: 500, 
      headers: { "content-type": "text/html" } 
    });
  }
});