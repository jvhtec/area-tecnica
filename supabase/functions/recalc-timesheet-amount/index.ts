import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { 
        status: 405,
        headers: corsHeaders 
      });
    }

    const { timesheet_id } = await req.json();
    if (!timesheet_id) {
      return new Response("Missing timesheet_id", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('Recalculating timesheet amount for:', timesheet_id);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data, error } = await admin.rpc('compute_timesheet_amount_2025', { 
      _timesheet_id: timesheet_id, 
      _persist: true 
    });

    if (error) {
      console.error('Error calculating timesheet amount:', error);
      return new Response(error.message, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    console.log('Successfully calculated timesheet amount:', data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Error in recalc-timesheet-amount function:', error);
    return new Response("Server error", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});