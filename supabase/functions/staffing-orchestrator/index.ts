import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignPolicy {
  weights: {
    skills: number;
    proximity: number;
    reliability: number;
    fairness: number;
    experience: number;
  };
  availability_ttl_hours: number;
  offer_ttl_hours: number;
  availability_multiplier: number;
  offer_buffer: number;
  exclude_fridge: boolean;
  soft_conflict_policy: 'warn' | 'block' | 'allow';
  tick_interval_seconds: number;
  escalation_steps: string[];
}

function assignmentRoleColumnForDepartment(department: string): string | null {
  switch ((department || '').toLowerCase()) {
    case 'sound':
      return 'sound_role';
    case 'lights':
      return 'lights_role';
    case 'video':
      return 'video_role';
    case 'production':
      return 'production_role';
    default:
      return null;
  }
}

// Resolve user from Authorization header
async function resolveUser(supabase: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, department')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { user_id: user.id, role: null, department: null };
    }

    return { user_id: user.id, ...profile };
  } catch (err) {
    console.error('[staffing-orchestrator] Error resolving user:', err);
    return null;
  }
}

// Check if user can manage campaign for department
async function canManageCampaign(
  user: any,
  department: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  if (user?.role === 'admin' || user?.role === 'logistics') {
    return true;
  }
  if (user?.role === 'management') {
    if (!user.department) return true;
    if (department === 'production' && user.department === 'logistics') return true;
    return user.department === department;
  }
  return false;
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const apikey = req.headers.get('apikey') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  return token === SERVICE_ROLE || apikey === SERVICE_ROLE;
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function badRequestResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function serverErrorResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function methodNotAllowedResponse() {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function okResponse(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function parseJsonBody(req: Request): Promise<any> {
  return req.json().catch(() => null);
}

// Check if user can manage campaign for department
async function canManageCampaignOrThrow(
  user: any,
  department: string,
  supabase: ReturnType<typeof createClient>
) {
  const ok = await canManageCampaign(user, department, supabase);
  if (!ok) {
    throw new Error('Not authorized to manage campaigns for this department');
  }
  return true;
}

// START action: Create new campaign
async function startCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { job_id, department, mode, policy, offer_message, scope } = body;

  if (!job_id || !department || !mode || !policy) {
    return {
      status: 400,
      body: { error: 'Missing required fields: job_id, department, mode, policy' }
    };
  }

  if (!(await canManageCampaign(user, department, supabase))) {
    return {
      status: 403,
      body: { error: 'Not authorized to manage campaigns for this department' }
    };
  }

  try {
    // Get job details
    const { data: job } = await supabase
      .from('jobs')
      .select('id, job_date, title')
      .eq('id', job_id)
      .single();

    if (!job) {
      return { status: 404, body: { error: 'Job not found' } };
    }

    // Create campaign
    const { data: campaign, error: createError } = await supabase
      .from('staffing_campaigns')
      .insert({
        job_id,
        department,
        created_by: user.user_id,
        mode,
        status: 'active',
        policy,
        offer_message,
        next_run_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      return { status: 400, body: { error: createError.message } };
    }

    // Get required roles for this job+department
    const { data: requiredRoles } = await supabase
      .from('job_required_roles')
      .select('role_code, quantity')
      .eq('job_id', job_id)
      .eq('department', department);

    // Filter to outstanding roles only if scope='outstanding'
    let rolesToCreate = requiredRoles || [];
    if (scope === 'outstanding') {
      const assignmentColumn = assignmentRoleColumnForDepartment(department);
      if (!assignmentColumn) {
        return { status: 400, body: { error: `Unsupported department: ${department}` } };
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select(`status, ${assignmentColumn}`)
        .eq('job_id', job_id);

      if (assignmentsError) {
        return { status: 400, body: { error: assignmentsError.message } };
      }

      const assignedCounts = new Map<string, number>();
      (assignments || []).forEach((row: any) => {
        const status = String(row.status || '').toLowerCase();
        if (status === 'declined') return;
        const roleCode = (row as any)[assignmentColumn];
        if (!roleCode) return;
        const key = String(roleCode).trim();
        if (!key) return;
        assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1);
      });

      rolesToCreate = (requiredRoles || []).filter((r: any) => {
        const required = Number(r.quantity || 0);
        const assigned = assignedCounts.get(String(r.role_code).trim()) || 0;
        return assigned < required;
      });
    }

    // Create campaign roles
    const campaignRoles = rolesToCreate.map((role: any) => ({
      campaign_id: campaign.id,
      role_code: role.role_code,
      stage: 'idle',
      wave_number: 0,
      assigned_count: 0,
      pending_availability: 0,
      confirmed_availability: 0,
      pending_offers: 0,
      accepted_offers: 0
    }));

    if (campaignRoles.length > 0) {
      const { error: roleError } = await supabase
        .from('staffing_campaign_roles')
        .insert(campaignRoles);

      if (roleError) {
        return { status: 400, body: { error: roleError.message } };
      }
    }

    return {
      status: 200,
      body: { campaign, roles_created: campaignRoles.length }
    };
  } catch (err) {
    console.error('[staffing-orchestrator] Start campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// PAUSE action: Pause active campaign
async function pauseCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { campaign_id } = body;

  if (!campaign_id) {
    return { status: 400, body: { error: 'Missing campaign_id' } };
  }

  try {
    // Check authorization
    const { data: campaign } = await supabase
      .from('staffing_campaigns')
      .select('id, department, status')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    if (campaign.status !== 'active') {
      return { status: 400, body: { error: 'Campaign must be active to pause' } };
    }

    const { data: updated } = await supabase
      .from('staffing_campaigns')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', campaign_id)
      .select()
      .single();

    return { status: 200, body: updated };
  } catch (err) {
    console.error('[staffing-orchestrator] Pause campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// RESUME action: Resume paused campaign
async function resumeCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { campaign_id } = body;

  if (!campaign_id) {
    return { status: 400, body: { error: 'Missing campaign_id' } };
  }

  try {
    // Check authorization
    const { data: campaign } = await supabase
      .from('staffing_campaigns')
      .select('id, department, status')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    if (campaign.status !== 'paused') {
      return { status: 400, body: { error: 'Campaign must be paused to resume' } };
    }

    const { data: updated } = await supabase
      .from('staffing_campaigns')
      .update({
        status: 'active',
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single();

    return { status: 200, body: updated };
  } catch (err) {
    console.error('[staffing-orchestrator] Resume campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// STOP action: Terminate campaign
async function stopCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { campaign_id } = body;

  if (!campaign_id) {
    return { status: 400, body: { error: 'Missing campaign_id' } };
  }

  try {
    // Check authorization
    const { data: campaign } = await supabase
      .from('staffing_campaigns')
      .select('id, department')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    const { data: updated } = await supabase
      .from('staffing_campaigns')
      .update({ status: 'stopped', updated_at: new Date().toISOString() })
      .eq('id', campaign_id)
      .select()
      .single();

    return { status: 200, body: updated };
  } catch (err) {
    console.error('[staffing-orchestrator] Stop campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// NUDGE action: Trigger immediate tick
async function nudgeCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { campaign_id } = body;

  if (!campaign_id) {
    return { status: 400, body: { error: 'Missing campaign_id' } };
  }

  try {
    // Check authorization
    const { data: campaign } = await supabase
      .from('staffing_campaigns')
      .select('id, department, status')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (campaign.status !== 'active' && campaign.status !== 'paused') {
      return { status: 400, body: { error: 'Campaign must be active or paused' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    // Set to immediate tick
    const { data: updated } = await supabase
      .from('staffing_campaigns')
      .update({
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single();

    return { status: 200, body: { message: 'Campaign nudged', campaign: updated } };
  } catch (err) {
    console.error('[staffing-orchestrator] Nudge campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

// TICK action: Execute one campaign cycle
async function tickCampaign(
  supabase: ReturnType<typeof createClient>,
  campaign_id: string
) {
  const lockId = crypto.randomUUID();
  const now = new Date();
  let lockAcquired = false;

  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('staffing_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .maybeSingle();

    if (campaignError) {
      return { status: 500, body: { error: campaignError.message } };
    }

    if (!campaign || campaign.status !== 'active') {
      return { status: 400, body: { error: 'Campaign not active' } };
    }

    // Check if already locked (crash recovery: >15min assumed dead)
    if (campaign.run_lock && campaign.last_run_at) {
      const lockAgeMin =
        (now.getTime() - new Date(campaign.last_run_at).getTime()) / 1000 / 60;
      if (lockAgeMin < 15) {
        return { status: 429, body: { error: 'Campaign already running, please wait' } };
      }
      console.warn(
        `[staffing-orchestrator] Recovering from stale lock on ${campaign_id}, lockAge=${lockAgeMin}min`,
      );
    }

    // Acquire lock (compare-and-swap)
    let lockQuery = supabase
      .from('staffing_campaigns')
      .update({
        run_lock: lockId,
        last_run_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', campaign_id);

    if (campaign.run_lock) {
      lockQuery = lockQuery.eq('run_lock', campaign.run_lock);
    } else {
      lockQuery = lockQuery.is('run_lock', null);
    }

    const { data: locked, error: lockError } = await lockQuery
      .select('id')
      .maybeSingle();

    if (lockError || !locked) {
      return { status: 429, body: { error: 'Could not acquire lock' } };
    }
    lockAcquired = true;

    const assignmentColumn = assignmentRoleColumnForDepartment(campaign.department);
    if (!assignmentColumn) {
      return { status: 400, body: { error: `Unsupported department: ${campaign.department}` } };
    }

    // Fetch base data
    const [
      { data: campaignRoles, error: rolesError },
      { data: requiredRoles, error: requiredError },
      { data: assignments, error: assignmentsError },
      { data: requests, error: requestsError },
    ] = await Promise.all([
      supabase
        .from('staffing_campaign_roles')
        .select('*')
        .eq('campaign_id', campaign_id),
      supabase
        .from('job_required_roles')
        .select('role_code, quantity')
        .eq('job_id', campaign.job_id)
        .eq('department', campaign.department),
      supabase
        .from('job_assignments')
        .select(`status, ${assignmentColumn}`)
        .eq('job_id', campaign.job_id),
      supabase
        .from('staffing_requests')
        .select('id, profile_id, phase, status, batch_id')
        .eq('job_id', campaign.job_id)
        .in('phase', ['availability', 'offer']),
    ]);

    if (rolesError) return { status: 500, body: { error: rolesError.message } };
    if (requiredError) return { status: 500, body: { error: requiredError.message } };
    if (assignmentsError) return { status: 500, body: { error: assignmentsError.message } };
    if (requestsError) return { status: 500, body: { error: requestsError.message } };

    const requiredByRole = new Map<string, number>();
    (requiredRoles || []).forEach((r: any) => {
      requiredByRole.set(String(r.role_code).trim(), Number(r.quantity || 0));
    });

    // Assigned counts (matches JobAssignmentMatrix logic)
    const assignedCounts = new Map<string, number>();
    (assignments || []).forEach((row: any) => {
      const status = String(row.status || '').toLowerCase();
      if (status === 'declined') return;
      const roleCode = (row as any)[assignmentColumn];
      if (!roleCode) return;
      const key = String(roleCode).trim();
      if (!key) return;
      assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1);
    });

    // Resolve role_code per staffing_request via the latest send event (email/whatsapp)
    const requestRows = (requests || []) as any[];
    const requestIds = requestRows.map((r) => r.id).filter(Boolean) as string[];
    const requestIdToRole = new Map<string, string>();

    if (requestIds.length > 0) {
      const { data: sendEvents, error: sendEventsError } = await supabase
        .from('staffing_events')
        .select('staffing_request_id, meta, created_at, event')
        .in('staffing_request_id', requestIds)
        .in('event', ['email_sent', 'whatsapp_sent'])
        .order('created_at', { ascending: true });

      if (sendEventsError) {
        return { status: 500, body: { error: sendEventsError.message } };
      }

      (sendEvents || []).forEach((evt: any) => {
        const role = (evt?.meta as any)?.role;
        if (!evt?.staffing_request_id || !role) return;
        requestIdToRole.set(String(evt.staffing_request_id), String(role));
      });
    }

    const campaignRoleCodes = new Set<string>(
      (campaignRoles || []).map((r: any) => String(r.role_code).trim()).filter(Boolean),
    );

    type PhaseCounts = {
      pending: Set<string>;
      confirmed: Set<string>;
    };

    const countsByRole: Record<string, Record<'availability' | 'offer', PhaseCounts>> = {};
    for (const code of campaignRoleCodes) {
      countsByRole[code] = {
        availability: { pending: new Set(), confirmed: new Set() },
        offer: { pending: new Set(), confirmed: new Set() },
      };
    }

    for (const r of requestRows) {
      const roleCode = requestIdToRole.get(String(r.id));
      if (!roleCode || !campaignRoleCodes.has(roleCode)) continue;
      const phase = String(r.phase || '') as 'availability' | 'offer';
      if (phase !== 'availability' && phase !== 'offer') continue;

      const status = String(r.status || '').toLowerCase();
      const profileId = String(r.profile_id || '');
      if (!profileId) continue;

      if (status === 'pending') countsByRole[roleCode][phase].pending.add(profileId);
      if (status === 'confirmed') countsByRole[roleCode][phase].confirmed.add(profileId);
    }

    const updates = [];
    let allFilled = true;

    for (const role of (campaignRoles || []) as any[]) {
      const roleCode = String(role.role_code).trim();
      const required = requiredByRole.get(roleCode) || 0;
      const assigned = assignedCounts.get(roleCode) || 0;
      const pendingAvailability = countsByRole[roleCode]?.availability.pending.size || 0;
      const confirmedAvailability = countsByRole[roleCode]?.availability.confirmed.size || 0;
      const pendingOffers = countsByRole[roleCode]?.offer.pending.size || 0;
      const acceptedOffers = countsByRole[roleCode]?.offer.confirmed.size || 0;

      let stage = 'idle';
      if (required <= 0 || assigned >= required) {
        stage = 'filled';
      } else if (pendingOffers > 0 || acceptedOffers > 0 || confirmedAvailability >= required) {
        stage = 'offer';
      } else {
        stage = 'availability';
      }

      if (stage !== 'filled') allFilled = false;

      updates.push({
        id: role.id,
        assigned_count: assigned,
        pending_availability: pendingAvailability,
        confirmed_availability: confirmedAvailability,
        pending_offers: pendingOffers,
        accepted_offers: acceptedOffers,
        stage,
        updated_at: now.toISOString(),
      });
    }

    // Apply updates
    for (const update of updates) {
      const { error: roleUpdateError } = await supabase
        .from('staffing_campaign_roles')
        .update({
          assigned_count: update.assigned_count,
          pending_availability: update.pending_availability,
          confirmed_availability: update.confirmed_availability,
          pending_offers: update.pending_offers,
          accepted_offers: update.accepted_offers,
          stage: update.stage,
          updated_at: update.updated_at,
        })
        .eq('id', update.id);

      if (roleUpdateError) {
        return { status: 500, body: { error: roleUpdateError.message } };
      }
    }

    const tickIntervalSeconds = Number(campaign.policy?.tick_interval_seconds || 300);
    const nextRun = allFilled ? null : new Date(now.getTime() + tickIntervalSeconds * 1000);

    const { error: campaignUpdateError } = await supabase
      .from('staffing_campaigns')
      .update({
        run_lock: null,
        next_run_at: nextRun?.toISOString() || null,
        status: allFilled ? 'completed' : 'active',
        updated_at: now.toISOString(),
      })
      .eq('id', campaign_id)
      .eq('run_lock', lockId);

    lockAcquired = false;

    if (campaignUpdateError) {
      return { status: 500, body: { error: campaignUpdateError.message } };
    }

    return {
      status: 200,
      body: {
        campaign_id,
        tick_completed: true,
        roles_processed: updates.length,
        all_filled: allFilled,
        next_run_at: nextRun?.toISOString() || null,
      },
    };
  } catch (err) {
    console.error('[staffing-orchestrator] Tick campaign error:', err);
    if (lockAcquired) {
      await supabase
        .from('staffing_campaigns')
        .update({ run_lock: null, updated_at: now.toISOString() })
        .eq('id', campaign_id)
        .eq('run_lock', lockId);
    }
    return { status: 500, body: { error: 'Tick failed' } };
  }
}

// ESCALATE action: Advance to next escalation step
async function escalateCampaign(
  supabase: ReturnType<typeof createClient>,
  user: any,
  body: any
) {
  const { campaign_id } = body;

  if (!campaign_id) {
    return { status: 400, body: { error: 'Missing campaign_id' } };
  }

  try {
    // Check authorization
    const { data: campaign } = await supabase
      .from('staffing_campaigns')
      .select('id, department, status, policy')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    const policy = campaign.policy || {};
    const escalationSteps = policy.escalation_steps || [];

    // Find which steps have been executed
    let currentStep = 0;
    if (!policy.exclude_fridge) currentStep += 1;
    if (policy.soft_conflict_policy === 'allow') currentStep += 1;

    if (currentStep >= escalationSteps.length) {
      return { status: 400, body: { error: 'No more escalation steps available' } };
    }

    // Apply next step
    const nextStep = escalationSteps[currentStep];
    const updatedPolicy = { ...policy };

    if (nextStep === 'increase_wave') {
      updatedPolicy.availability_multiplier = (updatedPolicy.availability_multiplier || 4) * 1.5;
    } else if (nextStep === 'include_fridge') {
      updatedPolicy.exclude_fridge = false;
    } else if (nextStep === 'allow_soft_conflicts') {
      updatedPolicy.soft_conflict_policy = 'allow';
    }

    const { data: updated } = await supabase
      .from('staffing_campaigns')
      .update({
        policy: updatedPolicy,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single();

    return {
      status: 200,
      body: {
        message: `Escalated to: ${nextStep}`,
        campaign: updated
      }
    };
  } catch (err) {
    console.error('[staffing-orchestrator] Escalate campaign error:', err);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'start';
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Service-only endpoint (called by staffing-sweeper cron)
  if (action === 'tick') {
    if (req.method !== 'POST') return methodNotAllowedResponse();
    if (!isServiceRoleRequest(req)) return unauthorizedResponse();

    const body = await parseJsonBody(req);
    if (!body?.campaign_id) return badRequestResponse('Missing campaign_id');

    const result = await tickCampaign(supabase, body.campaign_id);
    return okResponse(result.body, result.status);
  }

  if (req.method !== 'POST') return methodNotAllowedResponse();

  const user = await resolveUser(supabase, req);
  if (!user) return unauthorizedResponse();

  try {
    const body = (await parseJsonBody(req)) || {};

    let result = { status: 404, body: { error: 'Unknown action' } };

    switch (action) {
      case 'start':
        result = await startCampaign(supabase, user, body);
        break;
      case 'pause':
        result = await pauseCampaign(supabase, user, body);
        break;
      case 'resume':
        result = await resumeCampaign(supabase, user, body);
        break;
      case 'stop':
        result = await stopCampaign(supabase, user, body);
        break;
      case 'nudge':
        result = await nudgeCampaign(supabase, user, body);
        break;
      case 'escalate':
        result = await escalateCampaign(supabase, user, body);
        break;
    }

    return okResponse(result.body, result.status);
  } catch (err) {
    console.error('[staffing-orchestrator] Unexpected error:', err);
    return serverErrorResponse('Internal server error');
  }
});
