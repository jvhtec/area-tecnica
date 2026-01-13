# Staffing Orchestrator - Quick Start Guide

**TL;DR**: AI-driven crew staffing automation - managers recommend or let system auto-staff.

---

## 🚀 Deploy in 10 Minutes

### 1. Apply Migrations (1 min)
```bash
# Files: supabase/migrations/202601121100*
cd /home/javi/area-tecnica

# Local (supabase start): applies to local dev database
supabase migration up

# Remote (Supabase branch / production): applies to the linked project
supabase migration up --linked
```

Files applied:
- `staffing_campaigns` table
- `staffing_campaign_roles` table
- `staffing_campaign_events` audit log
- `distance_km()` function
- `rank_staffing_candidates()` RPC (the AI engine)
- `trigger_campaign_wake_up()` trigger
- `get_campaigns_to_tick()` function
- Realtime enabled for campaign tables

### 2. Deploy Edge Functions (2 min)
```bash
# Linked project (default)
supabase functions deploy staffing-orchestrator
supabase functions deploy staffing-sweeper

# Or target a specific Supabase project/branch without relinking:
# supabase functions deploy staffing-orchestrator --project-ref "$SUPABASE_PROJECT_REF"
# supabase functions deploy staffing-sweeper --project-ref "$SUPABASE_PROJECT_REF"
```

Functions deployed:
- `staffing-orchestrator` - Campaign management (start/pause/resume/stop/escalate/tick)
- `staffing-sweeper` - Periodic executor (finds + ticks ready campaigns)

### 3. Setup Cron Job (2 min)
In Supabase Dashboard → Database → Cron Jobs:
```
Schedule: * * * * * (every minute, or adjust)
Webhook: POST https://{PROJECT}.supabase.co/functions/v1/staffing-sweeper
Headers:
  Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
  apikey: {SUPABASE_SERVICE_ROLE_KEY}
```

### 4. Integrate UI (3 min)
In your Job Assignment Matrix / Job Detail panel:

```tsx
import { StaffingOrchestratorPanel } from '@/components/matrix/StaffingOrchestratorPanel'

// Add to your JSX:
<StaffingOrchestratorPanel
  jobId={jobId}
  department="sound"
  jobTitle="Festival Setup"
/>
```

### 5. Test (2 min)
```bash
# Create test campaign
curl -X POST https://{PROJECT}.supabase.co/functions/v1/staffing-orchestrator?action=start \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "{TEST_JOB_ID}",
    "department": "sound",
    "mode": "assisted",
    "scope": "outstanding",
    "policy": {
      "weights": {"skills": 0.5, "proximity": 0.1, "reliability": 0.2, "fairness": 0.1, "experience": 0.1},
      "availability_ttl_hours": 24,
      "offer_ttl_hours": 4,
      "availability_multiplier": 4,
      "offer_buffer": 1,
      "exclude_fridge": true,
      "soft_conflict_policy": "block",
      "tick_interval_seconds": 300,
      "escalation_steps": ["increase_wave", "include_fridge", "allow_soft_conflicts"]
    }
  }'
```

---

## 📖 Usage Patterns

### Pattern 1: Assisted Mode (Manager Selects)
```tsx
// 1. Manager starts campaign
<StaffingCampaignPanel /> // Shows start dialog

// 2. Manager sends availability to candidates
<StaffingCandidateList /> // Shows ranked candidates

// 3. Manager sends offers to those who said YES
<StaffingOfferList /> // Shows responses

// 4. First acceptor auto-assigns to job
```

**Best for**: Small rosters, manager trust, quality over speed

### Pattern 2: Auto Mode (System Drives)
```tsx
// 1. Manager starts campaign with mode="auto"
<StaffingCampaignPanel />

// 2. System automatically ticks every N seconds
// (Orchestrator + Sweeper do the work)

// 3. Manager monitors in dashboard
<StaffingAutoModePanel /> // Shows progress, controls

// 4. System escalates if needed
// (increase wave → include fridge → allow soft conflicts)
```

**Best for**: Large rosters, tight timelines, speed over customization

---

## 🎯 Key Concepts

### Campaign States
```
idle → active ← paused
         ↓
      tick (auto mode)
         ↓
      completed (all filled)
      OR stopped (manual)
      OR failed (error)
```

### Role Stages
```
idle → availability → offer → filled → escalating
   (waiting for responses)        (unfilled, escalating policy)
```

### Scoring (What Gets Ranked)
```
Final Score = (
    Skills (0-50)           × 0.5  // Primary skill match
  + Proximity (0-10)        × 0.1  // Distance to Madrid HQ
  + Reliability (0-20)      × 0.2  // Accept rate history
  + Fairness (0-10)         × 0.1  // Gig load (house techs) or days since job
  + Experience (0-10)       × 0.1  // Total jobs completed
) × House Tech Boost (1.3× if applicable, else 1.0×)
```

**House Tech Special Rules**:
- Below 4 gigs/month: +10 fairness pts (priority)
- 10-15 gigs/month: 5 pts (caution)
- 15+ gigs/month: 2 pts (burnout protection)
- Always shows "2/4 gigs" badge in UI

---

## 💡 Common Tasks

### Task: Send Availability to 3 Candidates
```tsx
// In StaffingCandidateList component:
1. Check 3 checkboxes
2. Click "Send Availability (3)"
3. System creates staffing_requests + sends emails
```

### Task: Auto-Escalate Campaign
```tsx
// In StaffingAutoModePanel component:
1. Click "Escalate" button
2. Confirm warning dialog
3. Next escalation step applied (e.g., include fridge)
4. Next orchestrator tick uses new policy
```

### Task: View Candidate Explanation
```tsx
// In StaffingCandidateList component:
1. Click "Show reasons" under candidate name
2. See: "Skills: 45 pts (RF specialist, prof 3) | Proximity: 8 pts (12 km) | ..."
```

### Task: Monitor Campaign Progress
```tsx
// In StaffingAutoModePanel component:
- Progress bar shows % filled
- Per-role grid shows: Assigned | Avail✓ | Offers⧐ | Accept✓
- Last wave timestamp + wave number
```

---

## 🔍 Debugging Checklist

### Campaign Not Advancing
- [ ] Is campaign.status = "active"?
- [ ] Is next_run_at set (not null)?
- [ ] Is run_lock null (not stuck)?
- [ ] Are candidates available? Check: `SELECT * FROM rank_staffing_candidates(...)`

### Candidates Not Showing
- [ ] Does job have job_required_roles entries?
- [ ] Are all candidates already assigned to the job?
- [ ] Are candidates marked as active (status='active')?
- [ ] Try: `SELECT * FROM rank_staffing_candidates(job_id, dept, role, 'assisted', policy)`

### Offers Not Sending
- [ ] Do you have staffing_requests with phase='availability' AND status='confirmed'?
- [ ] Click "Show reasons" to see if soft conflict is blocking
- [ ] Check `send-staffing-email` edge function logs

### Campaign Stuck in Lock
- [ ] Check: `SELECT run_lock, last_run_at FROM staffing_campaigns WHERE id = ?`
- [ ] If lock age > 15 minutes, sweeper will auto-recover
- [ ] Manually force: `UPDATE staffing_campaigns SET run_lock = NULL WHERE id = ?`

---

## 📚 Files You Need to Know

| File | Purpose |
|------|---------|
| `supabase/migrations/202601121100*.sql` | Database schema |
| `supabase/functions/staffing-orchestrator/` | Campaign engine |
| `supabase/functions/staffing-sweeper/` | Periodic executor |
| `src/components/matrix/StaffingOrchestratorPanel.tsx` | Main UI |
| `src/components/matrix/StaffingCandidateList.tsx` | Rank + select |
| `src/components/matrix/StaffingOfferList.tsx` | Manage responses |
| `src/components/matrix/StaffingAutoModePanel.tsx` | Monitor auto mode |
| `src/hooks/useStaffingCampaignRealtime.ts` | Realtime updates |

---

## ⚙️ Configuration (Default Policy)

```jsonb
{
  "weights": {
    "skills": 0.5,
    "proximity": 0.1,
    "reliability": 0.2,
    "fairness": 0.1,
    "experience": 0.1
  },
  "availability_ttl_hours": 24,        // How long to wait for YES/NO
  "offer_ttl_hours": 4,                // How long to wait for acceptance
  "availability_multiplier": 4,        // Contact 4× required for yes responses
  "offer_buffer": 1,                   // Contact 1 extra for offers
  "exclude_fridge": true,              // Don't use fridge unless escalated
  "soft_conflict_policy": "block",     // Exclude soft conflicts (until escalation)
  "tick_interval_seconds": 300,        // Auto mode: tick every 5 min
  "escalation_steps": [
    "increase_wave",                   // Step 1: 4× → 6× multiplier
    "include_fridge",                  // Step 2: Remove fridge exclusion
    "allow_soft_conflicts"             // Step 3: Include soft conflicts
  ]
}
```

**Customize** via Start Campaign dialog or API.

---

## 🎓 Example: Start a Sound Campaign

**Via UI**:
1. Open Job Assignment Matrix
2. Click outstanding "Sound FOH" role
3. Click "Start Campaign"
4. Dialog shows:
   - Mode: Assisted (default) / Auto
   - Scope: Outstanding roles only (default) / All
   - Weights sliders
   - Soft conflict policy dropdown
   - TTL settings
   - Offer message textarea
5. Click "Start Campaign"

**Via API**:
```bash
curl -X POST .../staffing-orchestrator?action=start \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "12345",
    "department": "sound",
    "mode": "assisted",
    "policy": { /* see above */ }
  }'
```

---

## 🚨 Common Gotchas

1. **Fridge techs always excluded by default** → Escalate to include
2. **Hard conflicts always filtered** → Check `check_technician_conflicts()`
3. **First offer acceptor auto-assigns** → No manual confirmation needed
4. **House techs get 30% boost** → They'll appear high in rankings
5. **Soft conflicts block by default** → Set policy to "allow" to override
6. **Sweeper runs every 60 seconds** → Adjust cron frequency if needed
7. **Realtime lags ~1 second** → UI may not instantly update

---

## 📞 Support

- **Full Guide**: `STAFFING_ORCHESTRATOR_IMPLEMENTATION.md`
- **Implementation Summary**: `STAFFING_ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md`
- **Original Plan**: `STAFFING_ORCHESTRATOR_PLAN.md`

---

**You're ready!** 🚀 Deploy, test, and enjoy automated crew staffing.
