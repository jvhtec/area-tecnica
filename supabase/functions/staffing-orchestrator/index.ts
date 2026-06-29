import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assignmentRoleColumnForDepartment,
  canManageCampaign,
  normalizeCampaignPolicy,
  type CampaignPolicy,
} from "./policyUtils.ts";
import {
  buildMissingCampaignRoleInserts,
  buildRequiredRoleQuantityMap,
  canResumeCampaignStatus,
} from "./orchestrationUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_STAFFING_EMAIL_URL = Deno.env.get("SEND_STAFFING_EMAIL_URL") ||
  `${SUPABASE_URL}/functions/v1/send-staffing-email`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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

async function syncCampaignRolesWithCurrentRequirements(
  supabase: ReturnType<typeof createClient>,
  campaign: { id: string; job_id: string; department: string },
  requiredRoles?: any[] | null,
  campaignRoles?: any[] | null,
) {
  let resolvedRequiredRoles = requiredRoles || null;
  let resolvedCampaignRoles = campaignRoles || null;

  if (!resolvedRequiredRoles) {
    const { data, error } = await supabase
      .from('job_required_roles')
      .select('role_code, quantity')
      .eq('job_id', campaign.job_id)
      .eq('department', campaign.department);

    if (error) return { error };
    resolvedRequiredRoles = data || [];
  }

  if (!resolvedCampaignRoles) {
    const { data, error } = await supabase
      .from('staffing_campaign_roles')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (error) return { error };
    resolvedCampaignRoles = data || [];
  }

  const missingRoleRows = buildMissingCampaignRoleInserts(
    campaign.id,
    resolvedRequiredRoles,
    resolvedCampaignRoles,
  );

  if (missingRoleRows.length === 0) {
    return { campaignRoles: resolvedCampaignRoles, insertedCount: 0 };
  }

  const { data: insertedRoles, error } = await supabase
    .from('staffing_campaign_roles')
    .upsert(missingRoleRows, {
      onConflict: 'campaign_id,role_code',
      ignoreDuplicates: true,
    })
    .select('*');

  if (error) return { error };

  return {
    campaignRoles: [...resolvedCampaignRoles, ...((insertedRoles || []) as any[])],
    insertedCount: insertedRoles?.length || 0,
  };
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
    console.log('[staffing-orchestrator] Fetching job:', job_id);
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, start_time, end_time, title, job_type')
      .eq('id', job_id)
      .single();

    console.log('[staffing-orchestrator] Job query result:', { job, jobError });

    if (!job) {
      console.log('[staffing-orchestrator] Job not found:', job_id);
      return { status: 404, body: { error: 'Job not found', job_id, jobError: jobError?.message || null, debug: { received_body: body } } };
    }

    // Get required roles for this job+department
    const { data: requiredRoles, error: requiredRolesError } = await supabase
      .from('job_required_roles')
      .select('role_code, quantity')
      .eq('job_id', job_id)
      .eq('department', department);

    if (requiredRolesError) {
      return { status: 400, body: { error: requiredRolesError.message } };
    }

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

    const normalizedMode = mode === 'auto' ? 'auto' : 'assisted';
    const normalizedPolicy = normalizeCampaignPolicy(policy, job, rolesToCreate, normalizedMode);

    // Create campaign
    const { data: campaign, error: createError } = await supabase
      .from('staffing_campaigns')
      .insert({
        job_id,
        department,
        created_by: user.user_id,
        mode: normalizedMode,
        status: 'active',
        policy: normalizedPolicy,
        offer_message,
        next_run_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      return { status: 400, body: { error: createError.message } };
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

    let initialTickResult: Awaited<ReturnType<typeof tickCampaign>> | null = null;
    if (normalizedMode === 'auto' && campaignRoles.length > 0) {
      initialTickResult = await tickCampaign(supabase, campaign.id);
    }

    return {
      status: 200,
      body: {
        campaign,
        roles_created: campaignRoles.length,
        auto_tick: initialTickResult?.body || null,
      }
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

// RESUME action: Resume paused, stopped, or completed campaign
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
      .select('id, job_id, department, status')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!(await canManageCampaign(user, campaign.department, supabase))) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    if (!canResumeCampaignStatus(campaign.status)) {
      return { status: 400, body: { error: 'Campaign must be paused, stopped, or completed to resume' } };
    }

    const syncResult = await syncCampaignRolesWithCurrentRequirements(supabase, campaign);
    if (syncResult.error) {
      return { status: 500, body: { error: syncResult.error.message } };
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

    const tickResult = await tickCampaign(supabase, campaign_id);
    const { data: refreshed } = await supabase
      .from('staffing_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .maybeSingle();

    return {
      status: 200,
      body: {
        ...(refreshed || updated),
        tick_result: tickResult.body,
        tick_warning: tickResult.status < 200 || tickResult.status >= 300 ? tickResult.body : null,
      },
    };
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

    if (campaign.status !== 'active') {
      return { status: 200, body: { message: 'Campaign nudged', campaign: updated } };
    }

    const tickResult = await tickCampaign(supabase, campaign_id);
    return {
      status: tickResult.status,
      body: {
        message: tickResult.status >= 200 && tickResult.status < 300
          ? 'Campaign ticked'
          : 'Campaign tick failed',
        campaign: updated,
        tick_result: tickResult.body,
      },
    };
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
        .select(`status, technician_id, ${assignmentColumn}`)
        .eq('job_id', campaign.job_id),
      supabase
        .from('staffing_requests')
        .select('id, profile_id, phase, status, batch_id, role_code, updated_at')
        .eq('job_id', campaign.job_id)
        .in('phase', ['availability', 'offer']),
    ]);

    if (rolesError) return { status: 500, body: { error: rolesError.message } };
    if (requiredError) return { status: 500, body: { error: requiredError.message } };
    if (assignmentsError) return { status: 500, body: { error: assignmentsError.message } };
    if (requestsError) return { status: 500, body: { error: requestsError.message } };

    const syncResult = await syncCampaignRolesWithCurrentRequirements(
      supabase,
      campaign,
      requiredRoles || [],
      campaignRoles || [],
    );
    if (syncResult.error) {
      return { status: 500, body: { error: syncResult.error.message } };
    }

    const syncedCampaignRoles = syncResult.campaignRoles || [];
    const requiredByRole = buildRequiredRoleQuantityMap(requiredRoles || []);

    // Assigned counts (matches JobAssignmentMatrix logic)
    const assignedCounts = new Map<string, number>();
    const assignedProfilesByRole = new Map<string, Set<string>>();
    const anonymousAssignedCountsByRole = new Map<string, number>();
    const refreshAssignedCount = (roleCode: string) => {
      assignedCounts.set(
        roleCode,
        (assignedProfilesByRole.get(roleCode)?.size || 0) +
          (anonymousAssignedCountsByRole.get(roleCode) || 0),
      );
    };
    (assignments || []).forEach((row: any) => {
      const status = String(row.status || '').toLowerCase();
      if (status === 'declined') return;
      const roleCode = (row as any)[assignmentColumn];
      if (!roleCode) return;
      const key = String(roleCode).trim();
      if (!key) return;
      const profileId = String(row.technician_id || '');
      if (profileId) {
        const profiles = assignedProfilesByRole.get(key) || new Set<string>();
        profiles.add(profileId);
        assignedProfilesByRole.set(key, profiles);
        refreshAssignedCount(key);
      } else {
        anonymousAssignedCountsByRole.set(key, (anonymousAssignedCountsByRole.get(key) || 0) + 1);
        refreshAssignedCount(key);
      }
    });

    // Resolve role_code per staffing_request via the latest send event (email/whatsapp)
    const requestRows = (requests || []) as any[];
    const requestIds = requestRows.map((r) => r.id).filter(Boolean) as string[];
    const requestIdToRole = new Map<string, string>();
    requestRows.forEach((request) => {
      const directRole = typeof request.role_code === 'string' ? request.role_code.trim() : '';
      if (request.id && request.phase !== 'availability' && directRole) {
        requestIdToRole.set(String(request.id), directRole);
      }
    });

    if (requestIds.length > 0) {
      const { data: sendEvents, error: sendEventsError } = await supabase
        .from('staffing_events')
        .select('staffing_request_id, meta, created_at, event')
        .in('staffing_request_id', requestIds)
        .in('event', ['email_sent', 'whatsapp_sent'])
        .order('created_at', { ascending: false });

      if (sendEventsError) {
        return { status: 500, body: { error: sendEventsError.message } };
      }

      (sendEvents || []).forEach((evt: any) => {
        const role = (evt?.meta as any)?.role;
        if (!evt?.staffing_request_id || !role) return;
        if (requestIdToRole.has(String(evt.staffing_request_id))) return;
        requestIdToRole.set(String(evt.staffing_request_id), String(role));
      });
    }

    const campaignRoleCodes = new Set<string>(
      syncedCampaignRoles.map((r: any) => String(r.role_code).trim()).filter(Boolean),
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

    const confirmedAvailabilityRowsForJob: any[] = [];
    const confirmedAvailabilityByRequestedRole = new Map<string, any[]>();
    const contactedProfilesByRole = new Map<string, Set<string>>();
    const offerRequestProfilesByRole = new Map<string, Set<string>>();
    const offerRequestProfilesForJob = new Set<string>();
    const activeOfferProfilesForJob = new Set<string>();

    for (const r of requestRows) {
      const roleCode = requestIdToRole.get(String(r.id));
      const phase = String(r.phase || '') as 'availability' | 'offer';
      if (phase !== 'availability' && phase !== 'offer') continue;

      const status = String(r.status || '').toLowerCase();
      const profileId = String(r.profile_id || '');
      if (!profileId) continue;

      if (phase === 'offer' && ['pending', 'confirmed', 'declined'].includes(status)) {
        offerRequestProfilesForJob.add(profileId);
      }
      if (phase === 'offer' && ['pending', 'confirmed'].includes(status)) {
        activeOfferProfilesForJob.add(profileId);
      }

      if (phase === 'availability') {
        const availabilityRow = { ...r, requested_role_code: roleCode || null };
        if (roleCode && campaignRoleCodes.has(roleCode) && ['pending', 'confirmed'].includes(status)) {
          const contactedProfiles = contactedProfilesByRole.get(roleCode) || new Set<string>();
          contactedProfiles.add(profileId);
          contactedProfilesByRole.set(roleCode, contactedProfiles);
        }
        if (status === 'confirmed') {
          confirmedAvailabilityRowsForJob.push(availabilityRow);
          if (roleCode && campaignRoleCodes.has(roleCode)) {
            const rows = confirmedAvailabilityByRequestedRole.get(roleCode) || [];
            rows.push(availabilityRow);
            confirmedAvailabilityByRequestedRole.set(roleCode, rows);
          }
        }
        if (roleCode && campaignRoleCodes.has(roleCode) && status === 'pending') {
          countsByRole[roleCode].availability.pending.add(profileId);
        }
        continue;
      }

      if (!campaignRoleCodes.has(roleCode)) continue;

      const contactedProfiles = contactedProfilesByRole.get(roleCode) || new Set<string>();
      contactedProfiles.add(profileId);
      contactedProfilesByRole.set(roleCode, contactedProfiles);

      if (status === 'pending') countsByRole[roleCode][phase].pending.add(profileId);
      if (status === 'confirmed') countsByRole[roleCode][phase].confirmed.add(profileId);

      if (phase === 'offer' && ['pending', 'confirmed', 'declined'].includes(status)) {
        const profiles = offerRequestProfilesByRole.get(roleCode) || new Set<string>();
        profiles.add(profileId);
        offerRequestProfilesByRole.set(roleCode, profiles);
      }
    }

    const updates = [];
    const autoActions: Array<{ role_code: string; profile_id: string; phase: string; channel: string; status: string; error?: string }> = [];
    let allFilled = true;
    const policy = (campaign.policy || {}) as CampaignPolicy;
    const autoChannel = policy.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const shouldPrioritizeAssistedHandoff = campaign.mode === 'auto' && policy.assisted_handoff_priority !== false;

    for (const role of syncedCampaignRoles as any[]) {
      const roleCode = String(role.role_code).trim();
      const required = requiredByRole.get(roleCode) || 0;
      const assignedProfiles = assignedProfilesByRole.get(roleCode) || new Set<string>();
      const assigned = assignedCounts.get(roleCode) || 0;
      const pendingAvailabilityProfiles = countsByRole[roleCode]?.availability.pending || new Set<string>();
      const pendingOfferProfiles = countsByRole[roleCode]?.offer.pending || new Set<string>();
      const acceptedOfferProfiles = countsByRole[roleCode]?.offer.confirmed || new Set<string>();
      let pendingAvailability = pendingAvailabilityProfiles.size;
      const matchingRequestedRole = confirmedAvailabilityByRequestedRole.get(roleCode) || [];
      const confirmedAvailability = new Set(
        matchingRequestedRole
          .map((request: any) => String(request.profile_id || ''))
          .filter(Boolean),
      ).size;
      let pendingOffers = pendingOfferProfiles.size;
      const acceptedOffers = acceptedOfferProfiles.size;
      const acceptedOffersNotAssigned = Array.from(acceptedOfferProfiles)
        .filter((profileId) => !assignedProfiles.has(profileId))
        .length;
      const pendingOffersForCapacity = Array.from(pendingOfferProfiles)
        .filter((profileId) => !assignedProfiles.has(profileId) && !acceptedOfferProfiles.has(profileId))
        .length;
      const pendingAvailabilityForCapacity = Array.from(pendingAvailabilityProfiles)
        .filter((profileId) =>
          !assignedProfiles.has(profileId) &&
          !acceptedOfferProfiles.has(profileId) &&
          !pendingOfferProfiles.has(profileId) &&
          !activeOfferProfilesForJob.has(profileId)
        )
        .length;
      const hasConfirmedAvailabilityForRole = matchingRequestedRole.some((request: any) => {
        const profileId = String(request.profile_id || '');
        return profileId && !assignedProfiles.has(profileId) && !offerRequestProfilesForJob.has(profileId);
      });
      const confirmedAvailabilityReadyCount = new Set(
        matchingRequestedRole
          .map((request: any) => String(request.profile_id || ''))
          .filter((profileId) =>
            profileId &&
            !assignedProfiles.has(profileId) &&
            !offerRequestProfilesForJob.has(profileId)
          ),
      ).size;

      let stage = 'idle';
      if (required <= 0 || assigned >= required) {
        stage = 'filled';
      } else if (pendingOffersForCapacity > 0 || acceptedOffersNotAssigned > 0 || hasConfirmedAvailabilityForRole) {
        stage = 'offer';
      } else {
        stage = 'availability';
      }

      if (stage !== 'filled') allFilled = false;

      let nextWaveNumber = Number(role.wave_number || 0);
      let nextLastWaveAt = role.last_wave_at || null;
      const pipelineCoverage = assigned +
        acceptedOffersNotAssigned +
        pendingOffersForCapacity +
        confirmedAvailabilityReadyCount +
        pendingAvailabilityForCapacity;
      const availabilityShortfall = Math.max(0, required - pipelineCoverage);

      if (
        campaign.mode === 'auto' &&
        stage !== 'filled' &&
        (policy.waves?.auto_send_next_wave ?? true) &&
        availabilityShortfall > 0
      ) {
        const alreadyContacted = contactedProfilesByRole.get(roleCode) || new Set<string>();
        const waveMode = policy.waves?.mode || 'controlled_waves';
        const waveBuffer = Number(policy.waves?.buffer ?? policy.offer_buffer ?? 1);
        const fixedWaveSize = Math.max(1, Number(policy.waves?.fixed_size || 50));
        const waveSize = waveMode === 'blast_all_eligible'
          ? fixedWaveSize
          : Math.max(1, availabilityShortfall + waveBuffer);

        const { data: rankedCandidates, error: rankError } = await supabase.rpc('rank_staffing_candidates', {
          p_job_id: campaign.job_id,
          p_department: campaign.department,
          p_role_code: roleCode,
          p_mode: 'auto',
          p_policy: policy,
        });

        if (rankError) {
          autoActions.push({
            role_code: roleCode,
            profile_id: '',
            phase: 'availability',
            channel: autoChannel,
            status: 'failed',
            error: rankError.message,
          });
        } else {
          const candidatesToContact = ((rankedCandidates || []) as any[])
            .filter((candidate) => {
              const profileId = String(candidate.profile_id || '');
              return profileId && !alreadyContacted.has(profileId);
            })
            .slice(0, waveSize);

          let sentInWave = 0;
          for (const candidate of candidatesToContact) {
            const profileId = String(candidate.profile_id || '');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30_000);

            try {
              const response = await fetch(SEND_STAFFING_EMAIL_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SERVICE_ROLE}`,
                  'apikey': SERVICE_ROLE,
                },
                body: JSON.stringify({
                  job_id: campaign.job_id,
                  profile_id: profileId,
                  phase: 'availability',
                  role: roleCode,
                  department: campaign.department,
                  channel: autoChannel,
                  require_no_conflicts: true,
                  actor_id: campaign.created_by || null,
                  request_origin: 'auto_staffing',
                  campaign_id,
                  idempotency_key: `campaign:${campaign_id}:${roleCode}:${profileId}:availability:auto:${autoChannel}`,
                }),
                signal: controller.signal,
              });

              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                autoActions.push({
                  role_code: roleCode,
                  profile_id: profileId,
                  phase: 'availability',
                  channel: autoChannel,
                  status: 'failed',
                  error: payload?.error || `HTTP ${response.status}`,
                });
                continue;
              }

              alreadyContacted.add(profileId);
              sentInWave += 1;
              pendingAvailability += 1;
              autoActions.push({
                role_code: roleCode,
                profile_id: profileId,
                phase: 'availability',
                channel: autoChannel,
                status: 'sent',
              });
            } catch (err) {
              autoActions.push({
                role_code: roleCode,
                profile_id: profileId,
                phase: 'availability',
                channel: autoChannel,
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              });
            } finally {
              clearTimeout(timeoutId);
            }
          }

          if (sentInWave > 0) {
            nextWaveNumber += 1;
            nextLastWaveAt = now.toISOString();
          }
        }
      }

      if (shouldPrioritizeAssistedHandoff && stage === 'offer') {
        const capacity = Math.max(0, required - assigned - acceptedOffersNotAssigned - pendingOffersForCapacity);
        const profilesWithOffer = offerRequestProfilesByRole.get(roleCode) || new Set<string>();
        const confirmedAvailabilityRows = matchingRequestedRole
          .filter((request: any) => {
            const profileId = String(request.profile_id || '');
            return profileId && !assignedProfiles.has(profileId) && !profilesWithOffer.has(profileId) && !offerRequestProfilesForJob.has(profileId);
          })
          .sort((a: any, b: any) => {
            const aTime = new Date(a.updated_at || 0).getTime();
            const bTime = new Date(b.updated_at || 0).getTime();
            return aTime - bTime;
          })
          .filter((request: any, index: number, rows: any[]) => {
            const profileId = String(request.profile_id || '');
            return rows.findIndex((row: any) => String(row.profile_id || '') === profileId) === index;
          })
          .slice(0, capacity);

        for (const request of confirmedAvailabilityRows) {
          const profileId = String(request.profile_id || '');
          if (!profileId) continue;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30_000);

          try {
            const response = await fetch(SEND_STAFFING_EMAIL_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE}`,
                'apikey': SERVICE_ROLE,
              },
              body: JSON.stringify({
                job_id: campaign.job_id,
                profile_id: profileId,
                phase: 'offer',
                role: roleCode,
                department: campaign.department,
                message: campaign.offer_message || null,
                channel: autoChannel,
                require_no_conflicts: true,
                actor_id: campaign.created_by || null,
                request_origin: 'auto_staffing',
                campaign_id,
                idempotency_key: `campaign:${campaign_id}:${roleCode}:${profileId}:offer:auto:${autoChannel}`,
              }),
              signal: controller.signal,
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              autoActions.push({
                role_code: roleCode,
                profile_id: profileId,
                phase: 'offer',
                channel: autoChannel,
                status: 'failed',
                error: payload?.error || `HTTP ${response.status}`,
              });
              continue;
            }

            profilesWithOffer.add(profileId);
            offerRequestProfilesForJob.add(profileId);
            pendingOffers += 1;
            autoActions.push({
              role_code: roleCode,
              profile_id: profileId,
              phase: 'offer',
              channel: autoChannel,
              status: 'sent',
            });
          } catch (err) {
            autoActions.push({
              role_code: roleCode,
              profile_id: profileId,
              phase: 'offer',
              channel: autoChannel,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            });
          } finally {
            clearTimeout(timeoutId);
          }
        }
      }

      updates.push({
        id: role.id,
        assigned_count: assigned,
        pending_availability: pendingAvailability,
        confirmed_availability: confirmedAvailability,
        pending_offers: pendingOffers,
        accepted_offers: acceptedOffers,
        stage,
        wave_number: nextWaveNumber,
        last_wave_at: nextLastWaveAt,
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
          wave_number: update.wave_number,
          last_wave_at: update.last_wave_at,
          updated_at: update.updated_at,
        })
        .eq('id', update.id);

      if (roleUpdateError) {
        return { status: 500, body: { error: roleUpdateError.message } };
      }
    }

    const tickIntervalSeconds = Number(campaign.policy?.tick_interval_seconds || 300);
    const waveWaitSeconds = Number(campaign.policy?.waves?.wait_minutes || 0) * 60;
    const runIntervalSeconds = campaign.mode === 'auto' && waveWaitSeconds > 0
      ? waveWaitSeconds
      : tickIntervalSeconds;
    const nextRun = allFilled ? null : new Date(now.getTime() + runIntervalSeconds * 1000);

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
        auto_actions: autoActions,
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
