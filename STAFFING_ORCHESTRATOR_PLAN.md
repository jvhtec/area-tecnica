# Agentized Staffing from Job Assignment Matrix
## Refined Implementation Plan (Department-Isolated, Manager-Gated, Fridge-Optional)

**Date**: January 2026
**Status**: Specification Ready for Implementation

---

## Objectives

1. **UI-initiated staffing campaigns** from Job Assignment Matrix—no "background chat waiting"
2. **Two modes**:
   - **Assisted**: System ranks + recommends; manager selects and triggers actions
   - **Auto**: System runs waves end-to-end with guardrails; manager monitors/overrides
3. **Improve candidate selection** using:
   - Proximity to Madrid HQ (40.22821°N, -3.84203°W)
   - Historic job & behavior signals (experience, response/accept rates, recency, fairness rotation)
4. **Department isolation**: Each department (Sound, Lights, Video, Backline, Stage, Logistics) runs independent campaigns
5. **Manager gating**: Only managers/admins for their own department can initiate campaigns
6. **Fridge as optional escalation**: Fridge techs are punished/low-trust; included only if manager explicitly enables during escalation

---

## Current System Integration Points

**Existing backend to preserve**:
- `send-staffing-email` (phase availability/offer, idempotency, daily caps)
- `staffing-click` (token validation, status update, offer YES auto-assign)
- `check_technician_conflicts()` RPC (hard vs soft)
- Unique constraints + assignment_date standardization
- Matrix data model and realtime patterns

**Existing UI to extend**:
- Job/tech listing, filtering, virtualization
- Outstanding-role detection
- Assign dialog conflict warnings

---

## Architecture Overview

### Components

1. **Staffing Campaign state (DB)**: Persistent campaign per `(job_id, department)` tracking progress and wave strategy
2. **Candidate ranking RPC (DB)**: Single source of truth for scoring techs (skills + proximity + history + conflicts)
3. **Staffing Orchestrator Edge Function**: Executes campaign "ticks" (send waves, expire stale requests, escalate)
4. **Matrix UI Staffing Panel**: Starts campaigns, monitors progress, controls Assisted/Auto behavior
5. **Continuation mechanism**: Campaigns advance via realtime-triggered wake-ups + periodic sweeper fallback

---

## Database Layer

### New Tables

#### 1. `staffing_campaigns`

Persistent campaign per job+department. Stores mode, policy, and lifecycle.

```sql
CREATE TABLE staffing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  department text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  mode text NOT NULL CHECK (mode IN ('assisted', 'auto')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped', 'completed', 'failed')),
  policy jsonb NOT NULL, -- {
                          --   weights: { skills: 0.5, proximity: 0.1, reliability: 0.2, fairness: 0.1, experience: 0.1 },
                          --   availability_ttl_hours: 24,
                          --   offer_ttl_hours: 4,
                          --   availability_multiplier: 4,
                          --   offer_buffer: 1,
                          --   exclude_fridge: true,
                          --   soft_conflict_policy: 'warn' | 'block' | 'allow',
                          --   tick_interval_seconds: 300,
                          --   escalation_steps: [ 'increase_wave', 'include_fridge', 'allow_soft_conflicts' ]
                          -- }
  offer_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_lock uuid,
  version int DEFAULT 1,

  UNIQUE(job_id, department),
  INDEX ON (status, next_run_at),
  INDEX ON (department, status)
);
```

**RLS Policy**:
```sql
CREATE POLICY "Users can manage campaigns for their department"
  ON staffing_campaigns
  USING (
    user_role IN ('super_admin', 'admin') OR
    (user_role IN ('jefe', 'manager') AND user_department = department)
  );
```

#### 2. `staffing_campaign_roles`

Per-role progress within a campaign. **Note**: `required_count` is NOT stored here; it's fetched from `job_required_roles` on each tick.

```sql
CREATE TABLE staffing_campaign_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES staffing_campaigns(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  -- required_count is fetched from job_required_roles per tick, not stored
  assigned_count int NOT NULL DEFAULT 0,
  pending_availability int NOT NULL DEFAULT 0,
  confirmed_availability int NOT NULL DEFAULT 0,
  pending_offers int NOT NULL DEFAULT 0,
  accepted_offers int NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'idle' CHECK (stage IN ('idle', 'availability', 'offer', 'filled', 'escalating')),
  wave_number int DEFAULT 0,
  last_wave_at timestamptz,
  availability_cutoff timestamptz,
  offer_cutoff timestamptz,
  updated_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, role_code),
  INDEX ON (campaign_id, stage)
);
```

#### 3. `staffing_events` (Auditability)

Log why candidates are contacted.

```sql
CREATE TABLE staffing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES staffing_campaigns(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('availability', 'offer')),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  role_code text NOT NULL,
  wave_number int NOT NULL,
  final_score int,
  score_breakdown jsonb, -- { skills: 40, proximity: 8, reliability: 18, fairness: 12, experience: 10 }
  reasons jsonb, -- array of strings
  created_at timestamptz DEFAULT now(),

  INDEX ON (campaign_id, phase),
  INDEX ON (profile_id, created_at)
);
```

### House Tech Tracking (Using Existing Schema)

**Identification**: House techs identified by `role = 'house_tech'` on profiles table.

**Current Location**: Tracked via existing `availability_schedules` table:
- `source='warehouse'` + `status='unavailable'` → tech is at warehouse
- No entry or `source!='warehouse'` → tech is available or on gig (check `job_assignments`)

**Monthly Gig Count**: Computed on-demand from `job_assignments`:
```sql
SELECT COUNT(*) FROM job_assignments
WHERE profile_id = ? AND status = 'accepted'
AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())
AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM now())
```

**Warehouse Staffing Guarantee**: At least 1 house tech should have `availability_schedules` entry with `source='warehouse'` for today. This is a soft constraint (manager responsibility via personal page).

---

### SQL Functions

#### Distance Function (Haversine, no PostGIS)

```sql
CREATE OR REPLACE FUNCTION distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision AS $$
DECLARE
  R double precision := 6371; -- Earth radius in km
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  c := 2 * asin(sqrt(a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### `rank_staffing_candidates()` RPC

**Signature**:
```sql
CREATE OR REPLACE FUNCTION rank_staffing_candidates(
  p_job_id uuid,
  p_department text,
  p_role_code text,
  p_mode text,
  p_policy jsonb
) RETURNS TABLE (
  profile_id uuid,
  full_name text,
  department text,
  skills_score int,
  distance_to_madrid_km double precision,
  proximity_score int,
  experience_score int,
  reliability_score int,
  fairness_score int,
  soft_conflict boolean,
  hard_conflict boolean,
  final_score int,
  reasons jsonb
) AS $$
BEGIN
  RETURN QUERY
  candidates AS (
    -- Filter: primary + logistics (if production calls for it), exclude fridge unless policy allows
    SELECT
      p.id,
      p.full_name,
      p.department,
      p.role,
      COALESCE(ps.primary_skill = p_role_code, false) AS has_primary,
      COALESCE(ps.proficiency, 0) AS prof,
      COALESCE(p.home_lat, 0) AS home_lat,
      COALESCE(p.home_lng, 0) AS home_lng,
      (p.role = 'house_tech') AS is_house_tech
    FROM profiles p
    LEFT JOIN profile_skills ps ON p.id = ps.profile_id AND ps.skill = p_role_code
    WHERE
      p.department = p_department
      AND (NOT (p_policy->>'exclude_fridge')::boolean OR p.department != 'fridge')
      AND p.status = 'active'
      AND p.id NOT IN (
        SELECT profile_id FROM job_assignments
        WHERE job_id = p_job_id AND status IN ('accepted', 'confirmed')
      )
  ),
  with_distance AS (
    SELECT
      *,
      distance_km(home_lat, home_lng, 40.22821, -3.84203) AS km_to_madrid
    FROM candidates
  ),
  with_history AS (
    SELECT
      wd.*,
      (SELECT COUNT(*) FROM job_assignments ja
       WHERE ja.profile_id = wd.id AND ja.status = 'accepted') AS jobs_completed,
      (SELECT MAX(created_at) FROM job_assignments ja
       WHERE ja.profile_id = wd.id AND ja.status = 'accepted') AS last_job_date,
      (SELECT COUNT(*) FROM staffing_requests sr
       WHERE sr.profile_id = wd.id AND sr.phase = 'availability' AND sr.status = 'confirmed') as availability_yes_count,
      (SELECT COUNT(*) FROM staffing_requests sr
       WHERE sr.profile_id = wd.id AND sr.phase = 'availability') as availability_total_count,
      (SELECT COUNT(*) FROM staffing_requests sr
       WHERE sr.profile_id = wd.id AND sr.phase = 'offer' AND sr.status = 'confirmed') as offer_yes_count,
      (SELECT COUNT(*) FROM staffing_requests sr
       WHERE sr.profile_id = wd.id AND sr.phase = 'offer') as offer_total_count,
      -- House tech monthly gig count (current month)
      (CASE WHEN wd.is_house_tech THEN
        (SELECT COUNT(*) FROM job_assignments ja
         WHERE ja.profile_id = wd.id AND ja.status = 'accepted'
         AND EXTRACT(YEAR FROM ja.created_at) = EXTRACT(YEAR FROM now())
         AND EXTRACT(MONTH FROM ja.created_at) = EXTRACT(MONTH FROM now()))
      ELSE 0 END) AS house_tech_current_month_gigs
    FROM with_distance wd
  ),
  with_conflicts AS (
    SELECT
      *,
      (SELECT soft_conflict FROM check_technician_conflicts(id, p_job_id)) AS soft_conflict,
      (SELECT hard_conflict FROM check_technician_conflicts(id, p_job_id)) AS hard_conflict
    FROM with_history
  ),
  scored AS (
    SELECT
      profile_id,
      full_name,
      department,
      -- Skills score (0-50 points, weighted 0.5)
      CASE
        WHEN has_primary THEN 40 + (prof * 2)
        ELSE 10
      END AS skills_score,
      -- Proximity score (0-10 points, weighted 0.1)
      km_to_madrid,
      CASE
        WHEN km_to_madrid <= 10 THEN 10
        WHEN km_to_madrid <= 25 THEN 8
        WHEN km_to_madrid <= 50 THEN 5
        ELSE 0
      END AS proximity_score,
      -- Experience score (0-10 points, weighted 0.1)
      LEAST(jobs_completed / 5, 10) AS experience_score,
      -- Reliability score (0-20 points, weighted 0.2)
      CASE
        WHEN availability_total_count > 0 THEN
          ROUND((availability_yes_count::numeric / availability_total_count) * 10 +
                (offer_yes_count::numeric / NULLIF(offer_total_count, 0)) * 10)::int
        ELSE 5 -- default for new techs
      END AS reliability_score,
      -- Fairness score (0-10 points, weighted 0.1)
      -- For house techs: boost if below 4 gigs/month, reduce if above 15 to spread load
      CASE
        WHEN is_house_tech AND house_tech_current_month_gigs < 4 THEN 10
        WHEN is_house_tech AND house_tech_current_month_gigs >= 15 THEN 2
        WHEN is_house_tech AND house_tech_current_month_gigs >= 10 THEN 5
        WHEN last_job_date IS NULL THEN 10
        WHEN EXTRACT(DAY FROM NOW() - last_job_date) > 30 THEN 10
        WHEN EXTRACT(DAY FROM NOW() - last_job_date) > 14 THEN 7
        ELSE 3
      END AS fairness_score,
      soft_conflict,
      hard_conflict,
      -- Final score = weighted sum + house tech boost multiplier
      ROUND(
        (
          (CASE WHEN has_primary THEN 40 + (prof * 2) ELSE 10 END) * 0.5 +
          (CASE
            WHEN km_to_madrid <= 10 THEN 10
            WHEN km_to_madrid <= 25 THEN 8
            WHEN km_to_madrid <= 50 THEN 5
            ELSE 0
          END) * 0.1 +
          (CASE
            WHEN availability_total_count > 0 THEN
              ROUND((availability_yes_count::numeric / availability_total_count) * 10 +
                    (offer_yes_count::numeric / NULLIF(offer_total_count, 0)) * 10)::int
            ELSE 5
          END) * 0.2 +
          (CASE
            WHEN is_house_tech AND house_tech_current_month_gigs < 4 THEN 10
            WHEN is_house_tech AND house_tech_current_month_gigs >= 15 THEN 2
            WHEN is_house_tech AND house_tech_current_month_gigs >= 10 THEN 5
            WHEN last_job_date IS NULL THEN 10
            WHEN EXTRACT(DAY FROM NOW() - last_job_date) > 30 THEN 10
            WHEN EXTRACT(DAY FROM NOW() - last_job_date) > 14 THEN 7
            ELSE 3
          END) * 0.1 +
          (LEAST(jobs_completed / 5, 10)) * 0.1
        ) * (CASE WHEN is_house_tech THEN 1.3 ELSE 1.0 END)  -- 30% house tech boost
      )::int AS final_score
    FROM with_conflicts
    WHERE hard_conflict = false -- always exclude hard conflicts
  )
  SELECT
    s.profile_id,
    s.full_name,
    s.department,
    s.skills_score,
    s.km_to_madrid,
    s.proximity_score,
    s.experience_score,
    s.reliability_score,
    s.fairness_score,
    s.soft_conflict,
    s.hard_conflict,
    s.final_score,
    jsonb_build_array(
      'Skills: ' || s.skills_score || ' pts',
      'Proximity: ' || s.proximity_score || ' pts (' || ROUND(s.km_to_madrid::numeric, 1) || ' km)',
      'Reliability: ' || s.reliability_score || ' pts',
      'Fairness: ' || s.fairness_score || ' pts',
      'Experience: ' || s.experience_score || ' pts'
    ) || (CASE WHEN s.is_house_tech THEN jsonb_build_array('House tech (+30% boost, ' || s.house_tech_current_month_gigs || '/4 gigs)') ELSE '[]'::jsonb END)
      || (CASE WHEN s.soft_conflict THEN jsonb_build_array('⚠ Soft conflict') ELSE '[]'::jsonb END)
  FROM scored s
  ORDER BY final_score DESC, s.profile_id
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### Monthly Gig Count Computation

For house techs in `rank_staffing_candidates()`, gig count is computed inline:

```sql
-- Within rank_staffing_candidates() CTE
(CASE WHEN wd.is_house_tech THEN
  (SELECT COUNT(*) FROM job_assignments ja
   WHERE ja.profile_id = wd.id AND ja.status = 'accepted'
   AND EXTRACT(YEAR FROM ja.created_at) = EXTRACT(YEAR FROM now())
   AND EXTRACT(MONTH FROM ja.created_at) = EXTRACT(MONTH FROM now()))
ELSE 0 END) AS house_tech_current_month_gigs
```

No separate helper RPC needed—computed per-candidate during ranking to avoid extra queries.

#### Trigger: Wake up campaign on staffing_requests status change

```sql
CREATE OR REPLACE FUNCTION trigger_campaign_wake_up()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE staffing_campaigns
  SET next_run_at = now()
  WHERE job_id = NEW.job_id
    AND status = 'active'
    AND (NEW.status = 'confirmed' OR NEW.status = 'declined');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staffing_requests_status_change
AFTER UPDATE OF status ON staffing_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_campaign_wake_up();
```

---

## Backend: Staffing Orchestrator Edge Function

**Location**: `supabase/functions/staffing-orchestrator/index.ts`

### Endpoints

| Action | Purpose |
|--------|---------|
| `POST action=start` | Create new campaign with policy + message |
| `POST action=tick` | Execute one campaign cycle (available → offers) |
| `POST action=pause` | Pause active campaign |
| `POST action=resume` | Resume paused campaign |
| `POST action=stop` | Terminate campaign |
| `POST action=escalate` | Advance campaign to next escalation step |
| `POST action=nudge` | Manual immediate tick |

### Authentication & Authorization

**All endpoints require**:
- Valid JWT token (manager or admin)
- RLS enforcement: user can only manage campaigns for their department (or all if admin)
- Enforced via `canManageCampaign()` helper

```typescript
async function canManageCampaign(
  userId: string,
  department: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', userId)
    .single();

  return profile?.role IN ['super_admin', 'admin'] OR profile?.department === department;
}
```

### Campaign State Machine

```
[idle] --start--> [active]
         |
         v
[active] <--pause--> [paused]
         |
         +--tick--> [active] (updated counters + sends waves)
         |
         +--stop--> [stopped]
         |
         +--escalate--> [active] (next step)
         |
         v
[filled|failed]
```

### Tick Algorithm (Deterministic)

For each role in campaign (from `staffing_campaign_roles`):

```
1. Fetch required_count from job_required_roles WHERE:
   - job_id = campaign.job_id
   - department = campaign.department
   - role_code = campaign_role.role_code
   => SUM(quantity) as required_count

2. Count current state:
   - assigned_count = COUNT(job_assignments
       WHERE job_id AND {sound_role|lights_role|...} = role_code AND status != 'declined')

   - pending_availability = COUNT(staffing_requests
       WHERE job_id AND phase='availability' AND status='pending')

   - confirmed_availability = COUNT(staffing_requests
       WHERE job_id AND phase='availability' AND status='confirmed')

   - pending_offers = COUNT(staffing_requests
       WHERE job_id AND phase='offer' AND status='pending')

   - accepted_offers = COUNT(staffing_requests
       WHERE job_id AND phase='offer' AND status='confirmed')

3. Update staffing_campaign_roles counters with above counts

4. Determine next action:
   if assigned_count >= required_count:
     role.stage = 'filled'
   elif confirmed_availability + accepted_offers >= required_count:
     role.stage = 'offer'
     (send offer wave if policy allows AND auto mode)
   elif confirmed_availability < required_count * policy.availability_multiplier:
     role.stage = 'availability'
     (send availability wave if auto mode)
   else:
     role.stage = 'idle'

5. Update next_run_at based on:
   - If all roles filled: set to NULL (campaign complete)
   - If waiting for responses: set to now() + policy.tick_interval_seconds
   - If stale pending: set to now() + 5min

6. Log staffing_events for each sent message with score breakdown + reasons
```

**Note**: Queries existing `job_required_roles` and `job_assignments` tables directly; no new aggregation views needed.

### House Tech Staffing Guarantee

**Warehouse minimum**: At least **1 house tech** should always have `availability_schedules` entry with `source='warehouse'` for today.

- Manager responsible for this via personal page (existing interface)
- When staffing campaigns are active, **prioritize offering gigs to house techs below 4 gigs/month** (UI will highlight candidates with "2/4 gigs" badge)
- Gig assignments are tracked via `job_assignments` (auto-counted in ranking)
- Warehouse presence tracked via `availability_schedules` with `source='warehouse'`
- Dashboard alert: "Warehouse understaffed" if no house techs in warehouse (optional feature)

**Burnout protection**: House techs ranked above 10 gigs/month get reduced fairness score to spread load fairly.

---

### Assisted Mode Behavior

- **Orchestrator does NOT auto-send** unless explicitly nudged
- **Tick serves as monitor**: updates counters, suggests next candidates via rank RPC
- **Manager drives sending**: via Matrix UI candidate selection
- Campaign transitions based on manager actions + response arrivals
- **House tech preference**: Candidate list ranks house techs higher (30% boost); UI highlights "Below 4 gigs" badge

### Auto Mode Behavior

- **Orchestrator auto-sends** according to policy and role stage
- **Respects policy caps**: wave_size, escalation steps
- **Escalates within bounds**: increase wave size → include fridge → allow soft conflicts
- **Manager can override**: pause, escalate manually, or stop

### Escalation Steps (Auto Mode)

Policy `escalation_steps` array (e.g., `['increase_wave', 'include_fridge', 'allow_soft_conflicts']`):

1. **increase_wave**: Bump wave_size from 4x to 6x multiplier
2. **include_fridge**: Toggle `exclude_fridge = false` in ranking query
3. **allow_soft_conflicts**: Set `soft_conflict_policy = 'allow'` in ranking query

Each step triggered if role still unfilled after TTL expiry.

### Idempotency Keys

```
availability:${job_id}:${profile_id}:${role_code}:${date_window_hash}
offer:${job_id}:${profile_id}:${role_code}:${target_date_or_window}
```

Prevents duplicate messages on orchestrator retries.

### Locking (Concurrent Tick Prevention)

```typescript
// Before tick, set run_lock + last_run_at
UPDATE staffing_campaigns
SET run_lock = gen_random_uuid(), last_run_at = now()
WHERE id = campaign_id AND run_lock IS NULL;

// After tick completes, clear lock
UPDATE staffing_campaigns SET run_lock = NULL WHERE id = campaign_id;

// If lock held > 15min, assume crashed process; allow retry
```

---

## Frontend: Matrix UI Staffing Panel

### Entry Points

1. **Outstanding Jobs Reminder** (existing dashboard):
   - Add "Auto Staff" button per unfilled job/department

2. **Job Detail Panel**:
   - New "Staffing" tab showing campaign status + controls

### Start Campaign Dialog

**Fields**:
- **Mode**: Assisted (default) / Auto
- **Department**: Pre-selected (read-only if manager; all if admin)
- **Scope**: "Outstanding roles only" (default) / "All required roles"
- **Proximity weight**: Low / Medium / High (maps to policy weight: 0.05 / 0.1 / 0.15)
- **History weight**: Low / Medium / High (maps to reliability + fairness: 0.15+0.05 / 0.2+0.1 / 0.25+0.15)
- **Soft conflict policy**: "Warn" (assisted) / "Block" (auto, default) / "Allow" (escalation only)
- **Exclude fridge**: Checked (default); uncheck to include in pool
- **Availability TTL**: 24h (default, adjustable)
- **Offer TTL**: 4h (default, adjustable)
- **Offer message**: Textarea for personalized note
- **Tick interval** (auto only): 300s (default)

**On submit**: Call `staffing-orchestrator action=start` with policy + message.

**Initialization Flow** (orchestrator `action=start`):
1. Manager selects scope: "Outstanding roles only" or "All required roles"
2. Orchestrator fetches `job_required_roles` for the job + department
3. If "Outstanding roles only": filter to roles where `assigned_count < required_count`
4. Create one `staffing_campaign_roles` row per selected role with:
   - `required_count` from `job_required_roles.quantity`
   - `stage = 'idle'`
   - `assigned_count, pending_availability, confirmed_availability, etc. = 0` (will be populated by first tick)

### Assisted Mode: Candidate Selection & Sending

**Screen 1: Per-Role Recommendation List**

For each role:
- Show top 10–15 candidates via `rank_staffing_candidates()` RPC
- Display per candidate:
  - Name, department
  - **House tech badge** (if applicable) with current month gigs "2/4 gigs" to show staffing need
  - Distance to Madrid HQ
  - Skill match (primary + proficiency badges)
  - Reliability (% accept rate, last 90d)
  - Last worked (days ago)
  - Soft conflict flag (⚠ with tooltip)
- **Sort**: House techs below 4 gigs/month appear at top (ranked higher by RPC)

**Controls**:
- Checkboxes to select candidates
- "Send availability to selected" button
- After replies: "Send offers to YES" button (auto-sends to all who said YES)

### Auto Mode: Monitoring Panel

**Status panel**:
- Per role:
  - Required / Assigned / Pending Availability / Confirmed Availability / Pending Offers / Accepted Offers
  - Stage: idle | availability | offer | filled | escalating
  - Last wave sent: timestamp + count + top reasons snippet

**Controls**:
- "Pause" / "Resume"
- "Escalate" (trigger next step)
- "Send next wave now" (nudge)
- "Stop campaign"
- Audit trail (last 10 events)

### Realtime Updates

**Subscriptions** (filtered by user department):
```typescript
useEffect(() => {
  const unsubscribe = supabase
    .from('staffing_campaigns')
    .on('*', (payload) => {
      if (payload.new.department === userDepartment || isAdmin) {
        setcampaign(payload.new);
      }
    })
    .subscribe();

  return () => unsubscribe?.unsubscribe();
}, [userDepartment, isAdmin]);

// Similar for staffing_campaign_roles
```

---

## Auditability & Explainability

### Staffing Events Logging

When orchestrator or manager sends message:
1. Compute rank RPC result for candidate
2. Log to `staffing_events`:
   - campaign_id, phase, profile_id, role_code, wave_number
   - final_score, score_breakdown (skills/proximity/reliability/fairness/experience)
   - reasons array (human-readable strings)

### UI: "Why This Tech?"

In Assisted candidate list + Auto wave history:
- Show reasons array as tooltip or expandable detail
- Example: "Primary skill RF (prof 4), 12 km from Madrid, 68% offer accept rate (last 90d), No hard conflicts"

---

## Performance Strategy

### Phase 1: Ship Correctness & Explainability
- Per-candidate conflict check via `check_technician_conflicts()` RPC
- Cap candidate pool to 50 per role per RPC call
- Wave sizes small (4x multiplier, max 12 per wave)
- No materialized views yet

### Phase 2: Optimize (Only if Needed)
- Add materialized view `mv_technician_staffing_stats` (refreshed hourly)
- Batch conflict checks per wave
- Job location geocoding + proximity scoring to job location (not just Madrid HQ)

---

## Implementation Roadmap

### Milestone 1: Campaign Scaffolding
- [ ] Create `staffing_campaigns` migration
- [ ] Create `staffing_campaign_roles` migration
- [ ] Create `staffing_events` migration (audit logging)
- [ ] Basic `staffing-orchestrator` edge function (start/pause/resume/stop endpoints)
- [ ] UI panel: start campaign dialog + status display (no sending yet)
- [ ] RLS policies on campaigns table

### Milestone 2: Ranking with Proximity + History + House Tech
- [ ] `distance_km()` SQL function
- [ ] `rank_staffing_candidates()` RPC with:
  - Skills + proximity + history + **house tech boost** (30% multiplier)
  - House tech fairness scoring (below 4 gigs/month boost, above 10 gigs/month reduction)
  - Inline gig count computation from `job_assignments`
- [ ] Assisted mode: candidate recommendation list with house tech badges "2/4 gigs" (read-only, no sending)
- [ ] Conflict gating via `check_technician_conflicts()`

### Milestone 3: Assisted Sending
- [ ] Assisted mode: "Send availability" button per selected candidates
- [ ] Assisted mode: "Send offers to YES" after replies
- [ ] Integration with existing `send-staffing-email` edge function
- [ ] Idempotency key handling

### Milestone 4: Auto Mode Waves
- [ ] Orchestrator `tick` endpoint with wave-sending logic
- [ ] Candidate selection + auto-sending via `send-staffing-email`
- [ ] Wave TTL + expiry handling
- [ ] UI auto mode controls (pause/resume)

### Milestone 5: Continuation + Escalation
- [ ] Trigger-based wake-up on `staffing_requests` status change
- [ ] Cron sweeper fallback (every 5–10 min)
- [ ] Escalation ladder (increase wave, include fridge, allow soft conflicts)
- [ ] `staffing_events` logging for auditability

### Milestone 6: Hardening & Polish
- [ ] Realtime subscriptions in UI (realtime updates)
- [ ] Audit trail in UI
- [ ] Manager auth enforcement per department
- [ ] QA scenarios + rollout gates
- [ ] Documentation + runbook

---

## QA & Validation Scenarios

### Scenario 1: Assisted Mode – Manager-Controlled Flow
1. Manager starts campaign (mode=assisted, role=RF, exclude_fridge=true)
2. System shows top 10 RF candidates with distance + reliability
3. Manager selects 4 candidates → "Send availability"
4. System sends via `send-staffing-email` phase=availability
5. Candidates reply YES → shown in UI
6. Manager selects 3 YES → "Send offers"
7. System sends offers → first offer YES auto-assigns job

**Acceptance**: No duplicates, all statuses correct, manager retains control

### Scenario 2: Auto Mode – System-Driven Waves
1. Manager starts campaign (mode=auto, role=RF, policy: 4x multiplier, escalate after 8h)
2. Orchestrator tick sends availability wave to top 4 RF candidates
3. Replies come in → trigger-based wake-up → next tick
4. Tick moves to offer phase → sends offers to top 3 YES
5. Offer YES auto-assigns first acceptor → role filled

**Acceptance**: Waves sent on schedule, escalation not triggered (filled), no manual intervention

### Scenario 3: Escalation – Fridge Inclusion
1. Auto campaign unfilled after 8h availability phase
2. Manager clicks "Escalate" → orchestrator includes fridge in next ranking
3. Next wave includes fridge candidates ranked alongside primary department
4. Fridge tech accepts → auto-assigned (same as any tech)

**Acceptance**: Fridge only in pool if explicitly escalated/enabled

### Scenario 4: Conflict Handling
1. Candidate has soft conflict (pending invite to overlapping event)
2. Assisted mode: shown with ⚠ flag, manager can still select
3. Auto mode with soft_conflict_policy=block: excluded from ranking
4. Auto mode with soft_conflict_policy=allow (after escalation): included with ⚠ reason in log

**Acceptance**: Conflicts respected per policy, explainable

### Scenario 5: Idempotency & Duplicates
1. Orchestrator tick sends availability to candidate A
2. Tick crashes mid-logging
3. Sweeper retries tick (same campaign_id, wave_number)
4. Idempotency key matched → no duplicate message, counters correct

**Acceptance**: No duplicate staffing_requests rows

### Scenario 6: Department Isolation
1. Sound manager starts campaign for Sound role
2. Lights manager independently starts campaign for Lights role
3. Both campaigns send waves to overlapping candidate pool simultaneously
4. No caps or coordination between departments
5. Candidates receive 2 separate emails (one per campaign) same day

**Acceptance**: Campaigns run independently, no cross-department contention

### Scenario 7: Manager Authorization
1. Sound manager tries to start campaign for Lights department
2. Request rejected with auth error
3. Admin can start campaigns for any department

**Acceptance**: Only rightful department owners can initiate

---

## Minimal Configuration Defaults

```jsonb
{
  "weights": {
    "skills": 0.5,
    "proximity": 0.1,
    "reliability": 0.2,
    "fairness": 0.1,
    "experience": 0.1
  },
  "availability_ttl_hours": 24,
  "offer_ttl_hours": 4,
  "availability_multiplier": 4,
  "offer_buffer": 1,
  "exclude_fridge": true,
  "soft_conflict_policy": "block",
  "tick_interval_seconds": 300,
  "escalation_steps": [
    "increase_wave",
    "include_fridge",
    "allow_soft_conflicts"
  ]
}
```

---

## Madrid HQ Reference

**Coordinates**: 40.22821°N, -3.84203°W

Used in `distance_km()` function for proximity scoring.

---

## Data Model Diagram (Using Existing Schema)

```
jobs
  ├── staffing_campaigns (job_id, department) [NEW]
  │     ├── staffing_campaign_roles (role_code, stage, counters) [NEW]
  │     └── staffing_events (audit log) [NEW]
  └── job_assignments (existing)

profiles (role='house_tech' identifies house techs)
  ├── staffing_requests (existing, triggers campaign wake-up)
  ├── profile_skills (existing, skill proficiency matrix)
  ├── job_assignments (existing, used for gig count computation)
  ├── timesheets (existing, used to verify tech assignments)
  └── availability_schedules (existing, tracks 'source=warehouse' for warehouse status)
```

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Ranking feels unfair | Expose reasons + fairness component in scoring; log decisions; house techs show gig count (2/4) transparently |
| House techs below 4 gigs/month not prioritized | Fairness scoring boosts below-4-gig house techs to top of ranking; UI badge highlights need |
| Warehouse left empty | Soft constraint enforced via manager dashboard alert; personal page tracking |
| Per-tech conflict checks slow | Cap pool to 50, cache results per tick, add MV later if needed |
| Over-contacting techs | Strict wave caps, idempotency keys, daily email caps, escalation requires policy enable |
| Concurrent orchestrator ticks | Locking via run_lock field + timestamp; max 15min before auto-retry |
| Realtime trigger misfire | Cron sweeper fallback every 5–10min |
| Fridge escalation unexpected | Explicit UI toggle + warning; admin audit trail |

---

## Rollout Gates

1. **Assisted mode only** for first deployment
2. **Sound department** pilot (largest, most data)
3. **Auto mode** behind feature flag for admin preview
4. **Auto mode** enabled per department after 2 weeks of assisted success
5. **Escalation steps** (especially fridge) behind explicit manager approval + dialog warning

---

## Success Metrics

- **Assisted mode**: Campaign completion time <30 min, manager satisfaction survey >4/5
- **Auto mode**: Role filled before job date in 90%+ of cases
- **House tech fairness**: Average house tech gigs/month = 4 ± 1 (within target range)
- **Warehouse coverage**: Always ≥1 house tech in warehouse (weekly audit)
- **No duplicates**: 0 duplicate assignments from orchestrator
- **Fairness**: Log analysis shows no systematic bias (Gini coefficient <0.3)
- **Responsiveness**: Candidate ranking RPC <500ms p95

---

## Documentation & Runbooks (To Be Created)

- **Manager Quick Start**: How to start a campaign + monitor
- **Admin Escalation Playbook**: When to escalate, what each step does
- **Troubleshooting**: Campaign stuck? Orchestrator locked? Candidates not showing?
- **Audit Trail Reading**: Interpreting staffing_events logs

---

**End of Plan**

Next: Await approval to begin implementation.
