import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Run all health checks in parallel
    const [orphanedResult, doubleBookingResult, declinedResult] = await Promise.all([
      supabase.rpc('find_orphaned_timesheets'),
      supabase.rpc('find_double_bookings'),
      supabase.rpc('find_declined_with_active_timesheets')
    ]);

    // Check for errors
    const checks = {
      orphaned_timesheets: {
        status: orphanedResult.error ? 'error' : (orphanedResult.data?.length === 0 ? 'ok' : 'warning'),
        count: orphanedResult.data?.length || 0,
        error: orphanedResult.error?.message,
        sample: orphanedResult.data?.slice(0, 3) || []
      },
      double_bookings: {
        status: doubleBookingResult.error ? 'error' : (doubleBookingResult.data?.length === 0 ? 'ok' : 'critical'),
        count: doubleBookingResult.data?.length || 0,
        error: doubleBookingResult.error?.message,
        sample: doubleBookingResult.data?.slice(0, 3) || []
      },
      declined_with_active_timesheets: {
        status: declinedResult.error ? 'error' : (declinedResult.data?.length === 0 ? 'ok' : 'warning'),
        count: declinedResult.data?.length || 0,
        error: declinedResult.error?.message,
        sample: declinedResult.data?.slice(0, 3) || []
      }
    };

    // Overall health status
    const hasErrors = Object.values(checks).some(c => c.status === 'error');
    const hasCritical = Object.values(checks).some(c => c.status === 'critical');
    const hasWarnings = Object.values(checks).some(c => c.status === 'warning');

    const overallStatus = hasErrors ? 'error' : (hasCritical ? 'critical' : (hasWarnings ? 'warning' : 'ok'));
    const healthy = overallStatus === 'ok';

    return new Response(JSON.stringify({
      healthy,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    }), {
      status: healthy ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      healthy: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
