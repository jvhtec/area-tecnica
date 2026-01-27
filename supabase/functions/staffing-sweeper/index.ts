import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORCHESTRATOR_URL = Deno.env.get("ORCHESTRATOR_URL") ||
  `${SUPABASE_URL}/functions/v1/staffing-orchestrator`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Campaign {
  id: string;
  job_id: string;
  department: string;
  mode: string;
  status: string;
  policy: any;
  next_run_at: string;
}

async function tickCampaigns() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  console.log('[staffing-sweeper] Starting campaign sweep...');

  try {
    // Get campaigns ready for tick
    const { data: campaigns, error } = await supabase.rpc('get_campaigns_to_tick', {
      p_limit: 50
    });

    if (error) {
      console.error('[staffing-sweeper] Error fetching campaigns:', error);
      return {
        status: 500,
        body: { error: 'Failed to fetch campaigns', details: error.message }
      };
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[staffing-sweeper] No campaigns to tick');
      return {
        status: 200,
        body: { message: 'No campaigns to tick', ticked: 0 }
      };
    }

    console.log(`[staffing-sweeper] Found ${campaigns.length} campaigns to tick`);

    // Tick each campaign
    const results = [];
    for (const campaign of campaigns) {
      try {
        console.log(`[staffing-sweeper] Ticking campaign ${campaign.id}`);

        const response = await fetch(`${ORCHESTRATOR_URL}?action=tick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE}`,
            'apikey': SERVICE_ROLE
          },
          body: JSON.stringify({
            campaign_id: campaign.id
          })
        });

        const result = await response.json();

        if (response.ok) {
          results.push({
            campaign_id: campaign.id,
            status: 'success',
            message: result?.message || 'Tick completed'
          });
          console.log(`[staffing-sweeper] Successfully ticked ${campaign.id}`);
        } else {
          results.push({
            campaign_id: campaign.id,
            status: 'failed',
            error: result.error
          });
          console.warn(`[staffing-sweeper] Failed to tick ${campaign.id}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[staffing-sweeper] Exception ticking ${campaign.id}:`, err);
        results.push({
          campaign_id: campaign.id,
          status: 'error',
          error: String(err)
        });
      }
    }

    const successful = results.filter((r: any) => r.status === 'success').length;
    const failed = results.filter((r: any) => r.status !== 'success').length;

    console.log(
      `[staffing-sweeper] Sweep complete: ${successful} successful, ${failed} failed`
    );

    return {
      status: 200,
      body: {
        message: 'Campaign sweep completed',
        ticked: successful,
        failed: failed,
        results: results
      }
    };
  } catch (err) {
    console.error('[staffing-sweeper] Unexpected error:', err);
    return {
      status: 500,
      body: { error: 'Sweep failed', details: String(err) }
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require service role key (cron / internal only)
  const authHeader = req.headers.get('Authorization') || '';
  const apikey = req.headers.get('apikey') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (token !== SERVICE_ROLE && apikey !== SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const result = await tickCampaigns();

  return new Response(
    JSON.stringify(result.body),
    {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});
