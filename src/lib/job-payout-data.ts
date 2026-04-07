import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobPayoutTotals } from '@/types/jobExtras';

export interface TechnicianProfileWithEmail {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
  department?: string | null;
}

export interface JobPayoutDocumentJobDetails {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  tour_id?: string | null;
  rates_approved?: boolean | null;
  job_type?: string | null;
  invoicing_company?: string | null;
}

export interface JobPayoutDataInput {
  jobId: string;
  supabase: SupabaseClient;
  payouts?: JobPayoutTotals[];
  profiles?: TechnicianProfileWithEmail[];
  lpoMap?: Map<string, string | null>;
  jobDetails?: JobPayoutDocumentJobDetails | null;
}

export interface JobPayoutDataResult {
  job: JobPayoutDocumentJobDetails;
  payouts: JobPayoutTotals[];
  profiles: TechnicianProfileWithEmail[];
  lpoMap: Map<string, string | null>;
}

async function fetchJobDetails(
  client: SupabaseClient,
  jobId: string,
  provided?: JobPayoutDocumentJobDetails | null
): Promise<JobPayoutDocumentJobDetails> {
  if (provided) return provided;

  const { data, error } = await client
    .from('jobs')
    .select('id, title, start_time, end_time, tour_id, rates_approved, invoicing_company, job_type')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !data) {
    throw error || new Error('Job not found');
  }

  return data as JobPayoutDocumentJobDetails;
}

async function fetchPayouts(
  client: SupabaseClient,
  jobId: string,
  provided?: JobPayoutTotals[]
): Promise<JobPayoutTotals[]> {
  if (provided !== undefined) return provided;

  const { data, error } = await client
    .from('v_job_tech_payout_2025')
    .select('*')
    .eq('job_id', jobId);

  if (error) throw error;

  return (data || []) as JobPayoutTotals[];
}

/**
 * `v_job_tech_payout_2025` already reflects the effective override total, but not the audit trail.
 * This enrichment adds override audit fields used by PDFs and email payloads.
 */
export async function attachOverrideMetadataToJobPayouts(
  client: SupabaseClient,
  jobId: string,
  payouts: JobPayoutTotals[]
): Promise<JobPayoutTotals[]> {
  const techIds = Array.from(new Set(payouts.map((payout) => payout.technician_id).filter(Boolean)));
  if (!jobId || techIds.length === 0) return payouts;

  const [{ data: overrides, error: overridesError }, { data: baseRows, error: baseRowsError }] = await Promise.all([
    client
      .from('job_technician_payout_overrides')
      .select('technician_id, override_amount_eur, set_by, set_at, updated_at')
      .eq('job_id', jobId)
      .in('technician_id', techIds),
    client
      .from('v_job_tech_payout_2025_base')
      .select('technician_id, total_eur')
      .eq('job_id', jobId)
      .in('technician_id', techIds),
  ]);

  if (overridesError) {
    console.warn('[attachOverrideMetadataToJobPayouts] override lookup failed', overridesError);
    return payouts;
  }

  if (baseRowsError) {
    console.warn('[attachOverrideMetadataToJobPayouts] base payout lookup failed', baseRowsError);
  }

  const baseTotalMap = new Map<string, number>();
  (baseRows || []).forEach((row: any) => {
    if (!row?.technician_id) return;
    baseTotalMap.set(row.technician_id, Number(row.total_eur ?? 0));
  });

  const overrideByTech = new Map<string, any>();
  const actorIds = new Set<string>();
  (overrides || []).forEach((row: any) => {
    if (!row?.technician_id) return;
    overrideByTech.set(row.technician_id, row);
    if (row.set_by) actorIds.add(row.set_by);
  });

  let actorMap = new Map<string, { name: string; email: string | null }>();
  if (actorIds.size > 0) {
    const { data: actors, error: actorError } = await client
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', Array.from(actorIds));

    if (actorError) {
      console.warn('[attachOverrideMetadataToJobPayouts] override actor lookup failed', actorError);
    } else {
      actorMap = new Map(
        (actors || []).map((actor: any) => [
          actor.id,
          {
            name: `${actor.first_name ?? ''} ${actor.last_name ?? ''}`.trim() || actor.id,
            email: actor.email ?? null,
          },
        ])
      );
    }
  }

  return payouts.map((payout) => {
    const override = overrideByTech.get(payout.technician_id);
    if (!override) return payout;

    const actor = override.set_by ? actorMap.get(override.set_by) : undefined;

    return {
      ...payout,
      has_override: true,
      override_amount_eur: Number(override.override_amount_eur),
      calculated_total_eur: baseTotalMap.get(payout.technician_id),
      override_set_at: override.set_at ?? override.updated_at ?? undefined,
      override_actor_name: actor?.name,
      override_actor_email: actor?.email ?? undefined,
    };
  });
}

async function fetchProfiles(
  client: SupabaseClient,
  techIds: string[],
  provided?: TechnicianProfileWithEmail[]
): Promise<TechnicianProfileWithEmail[]> {
  const providedProfiles = (provided || []).filter((profile) => techIds.includes(profile.id));
  if (providedProfiles.length > 0) {
    const hasEmailField = providedProfiles.every((profile) => Object.prototype.hasOwnProperty.call(profile, 'email'));
    const hasAutonomoField = providedProfiles.every((profile) => Object.prototype.hasOwnProperty.call(profile, 'autonomo'));
    const hasHouseTechField = providedProfiles.every((profile) => Object.prototype.hasOwnProperty.call(profile, 'is_house_tech'));
    const providedProfileIds = new Set(providedProfiles.map((profile) => profile.id));
    const coversAllTechIds = techIds.every((techId) => providedProfileIds.has(techId));

    if (hasEmailField && hasAutonomoField && hasHouseTechField && coversAllTechIds) {
      return providedProfiles;
    }
  }

  if (!techIds.length) return providedProfiles;

  const { data, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, email, autonomo')
    .in('id', techIds);

  if (error) {
    console.warn('[prepareJobPayoutData] profile lookup failed; using provided profile fallback', error);
    return providedProfiles;
  }

  const profileMap = new Map<string, TechnicianProfileWithEmail>();
  providedProfiles.forEach((profile) => {
    profileMap.set(profile.id, { ...profile, is_house_tech: profile.is_house_tech ?? false });
  });

  const profiles = (data || []) as TechnicianProfileWithEmail[];
  const mergedProfiles = await Promise.all(
    profiles.map(async (profile) => {
      const mergedProfile: TechnicianProfileWithEmail = {
        ...profileMap.get(profile.id),
        ...profile,
      };

      try {
        const { data: isHouseTech } = await client.rpc('is_house_tech', { _profile_id: profile.id });
        mergedProfile.is_house_tech = isHouseTech ?? false;
      } catch {
        mergedProfile.is_house_tech = mergedProfile.is_house_tech ?? false;
      }

      return mergedProfile;
    })
  );

  mergedProfiles.forEach((profile) => {
    profileMap.set(profile.id, profile);
  });

  return techIds
    .map((techId) => profileMap.get(techId))
    .filter((profile): profile is TechnicianProfileWithEmail => Boolean(profile));
}

async function fetchLpoMap(
  client: SupabaseClient,
  jobId: string,
  technicianIds: string[],
  provided?: Map<string, string | null>
): Promise<Map<string, string | null>> {
  if (provided) return provided;
  if (!technicianIds.length) return new Map();

  const { data, error } = await client
    .from('flex_work_orders')
    .select('technician_id, lpo_number')
    .eq('job_id', jobId)
    .in('technician_id', technicianIds);

  if (error) throw error;

  return new Map((data || []).map((row: any) => [row.technician_id, row.lpo_number || null]));
}

export async function prepareJobPayoutData(input: JobPayoutDataInput): Promise<JobPayoutDataResult> {
  const { jobId, supabase, jobDetails: providedJob, payouts: providedPayouts, profiles: providedProfiles, lpoMap: providedLpoMap } =
    input;

  const job = await fetchJobDetails(supabase, jobId, providedJob);
  const payoutsRaw = await fetchPayouts(supabase, jobId, providedPayouts);
  const payouts = await attachOverrideMetadataToJobPayouts(supabase, jobId, payoutsRaw);
  const technicianIds = Array.from(new Set(payouts.map((payout) => payout.technician_id).filter(Boolean)));
  const profiles = await fetchProfiles(supabase, technicianIds, providedProfiles);
  const lpoMap = await fetchLpoMap(supabase, jobId, technicianIds, providedLpoMap);

  return {
    job,
    payouts,
    profiles,
    lpoMap,
  };
}
