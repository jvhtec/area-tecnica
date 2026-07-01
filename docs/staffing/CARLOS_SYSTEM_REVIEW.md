# C.A.R.L.O.S. / Staffing Orchestrator — System Review

**Date:** 2026-07-01
**Scope:** Full sweep of the staffing orchestrator ("C.A.R.L.O.S. — Coordinador Automático de Recursos, Logística, Ofertas y Selección"):

- Edge functions: `staffing-orchestrator`, `staffing-click`, `staffing-sweeper`, `send-staffing-email`, `notify-staffing-cancellation`
- Ranking RPC: `rank_staffing_candidates` (base `20260519130000` + patch migrations `20260519165000`, `20260519170000`, `20260520110000`, `20260630100000`, `20260630120000`)
- Frontend: `src/features/staffing/*`, `src/components/matrix/Staffing*.tsx`
- Campaign schema: `20260112*` migrations, `get_campaigns_to_tick`, wake-up trigger, pg_cron sweeper schedule

The review has two parts: **(A) bugs**, ordered by severity, and **(B) improvement ideas** for the selection / auto-sorting / ranking system, focused on making CARLOS feel like a competent human coordinator you can delegate to.

---

## Part A — Bugs

### A1. CRITICAL — Email link scanners can confirm/decline on behalf of technicians

`supabase/functions/staffing-click/index.ts`

The click endpoint executes the state change (confirm/decline, auto-assignment, timesheet creation, Flex crew sync) on **any request method except HEAD** — the action is baked into the URL (`a=confirm` / `a=decline`) and processed immediately ("Process the action directly - no need for intermediate confirmation page", line ~404).

Corporate mail security scanners (Outlook SafeLinks, Mimecast, Gmail link prefetch) and messenger link-preview bots issue **GET** requests to every link in a message. Any of them can:

- falsely confirm an offer → technician silently booked, assignment + timesheets created, Flex updated;
- falsely decline → technician excluded from the campaign and penalized in future rankings (decline penalty, cross-job same-date hard exclusion from `20260630120000`).

The HEAD-only guard (line ~224) is not sufficient; most scanners GET.

**Fix direction:** serve a tiny confirmation page on GET (one button that POSTs, or a JS auto-submit with a challenge), and only mutate state on POST. Keep the token check as-is.

### A2. CRITICAL — TTLs are never enforced; one non-responder stalls a campaign forever

- `availability_ttl_hours` / `offer_ttl_hours` are configured in the UI (`StaffingCampaignPanel`), normalized into policy (`policyUtils.ts`), and then **never read again**. No job, trigger or sweeper marks pending `staffing_requests` as `expired` (the only writer of `status='expired'` is the manual cancel in `useStaffing.ts`).
- The click-token expiry in `send-staffing-email/index.ts` (~line 1177) is hardcoded to **48h**, independent of policy.
- In `tickCampaign` (`staffing-orchestrator/index.ts:856-877`), pending availability/offer requests count toward `pipelineCoverage`, so `availabilityShortfall` is 0 while anyone hasn't answered. Since pending never expires, **a single technician who ignores the message suppresses all further waves and offer handoffs indefinitely**. This is the classic "CARLOS just went quiet" failure mode.

**Fix direction:** sweeper pass (or `staffing-sweeper` extension) that expires pending requests older than the campaign's phase TTL, inserts a `request_expired` staffing_event, and wakes the campaign (`next_run_at = now()`). Token expiry should be derived from the same TTL.

### A3. HIGH — A crashed tick freezes the campaign; the sweeper can never recover it

- `tickCampaign` has stale-lock recovery (>15 min), but it only runs *inside* a tick.
- `get_campaigns_to_tick` (`20260112110600`) filters `run_lock IS NULL`, so the sweeper **never selects a locked campaign**, and the recovery path is unreachable from cron. If an edge invocation dies between acquiring the lock and clearing it (timeout, OOM, deploy), the campaign silently stops until a human presses "Next Tick Now" or Resume.

**Fix direction:** drop the `run_lock IS NULL` condition and instead select campaigns whose lock is null **or stale** (`last_run_at < now() - interval '15 min'`), letting the existing in-tick recovery do its job.

### A4. HIGH — `escalate` is broken twice

`staffing-orchestrator/index.ts:1179-1201`

1. **Step detection:** `currentStep` is inferred only from `exclude_fridge` and `soft_conflict_policy` flags. With the default step order `['increase_wave', 'include_fridge', 'allow_soft_conflicts']`, applying `increase_wave` changes neither flag, so every subsequent escalate call recomputes `currentStep = 0` and applies `increase_wave` again. **`include_fridge` and `allow_soft_conflicts` are unreachable** with default policy.
2. **`increase_wave` is a no-op:** it multiplies `availability_multiplier`, which nothing consumes — wave size in `tickCampaign` is `shortfall + waves.buffer` (or `fixed_size`). The escalation UI warns "this is irreversible" for an action that does nothing.

**Fix direction:** persist an explicit `escalation_level` int on the campaign (or in policy) and index into `escalation_steps`; make `increase_wave` bump `waves.buffer` (which is actually used).

### A5. HIGH — `max_waves` (and `escalate_after_wave`) are never enforced

`policy.waves.max_waves` is normalized, shown in the UI, used for a cosmetic label in `StaffingCandidateList`, and **never checked in `tickCampaign`** — `wave_number` increments unbounded and auto mode keeps contacting until the candidate pool is exhausted. `escalation.escalate_after_wave` is likewise dead: nothing auto-escalates or notifies the manager when the wave cap is passed.

### A6. HIGH — Advertised auto-close guarantees don't exist

The UI states: "Cierre automático activo: cierra roles completos, detiene futuras oleadas, **bloquea aceptaciones extra**, confirma el equipo reservado y **avisa a respuestas tardías o pendientes**."

- `staffing-click` performs **no capacity check** at confirmation time. It confirms the request, creates the assignment and timesheets regardless of whether the role is already filled. The orchestrator caps *outstanding offers* at capacity, but assisted-mode managers can over-offer freely, and offers outstanding when a role fills through another path (manual matrix assignment) can still be accepted. `block_extra_acceptances` is not implemented.
- No code notifies late responders or cancels pending requests when a role/campaign fills (`notify_late_responders`, `notify_pending_contacted`, `confirm_booked_crew` are written into policy and never read). Technicians who answered "available" and never hear back is exactly the un-humanlike behavior the flags promise to prevent.

**Fix direction:** on offer confirm in `staffing-click`, re-count assignments vs `job_required_roles` and return a friendly "role already filled" page when full (plus event + push to manager). On `stage='filled'` transition in `tickCampaign`, expire outstanding pending requests for that role and send a courteous "ya está cubierto" notification.

### A7. MEDIUM — Race in single-request click update

The batch path updates with `.eq('status', 'pending')`, but the single-row path (`staffing-click/index.ts:430-437`) updates by id only. The pending check happens on a stale read (STEP 6), so two concurrent clicks (scanner + human, or double-tap) can both pass the check; the second overwrites the first (`declined` → `confirmed` or vice versa) and both fire side effects. Add `.eq('status','pending')` and treat 0 rows as "already responded".

### A8. MEDIUM — `blast_all_eligible` doesn't blast all; `size_mode` is ignored

`tickCampaign` (index.ts:872-877) sizes the wave as `fixed_size || 50` when mode is `blast_all_eligible`, and `required + buffer` otherwise. The `waves.size_mode` field the frontend sets (`'all'` for blast, `'fixed'`, `'required_plus_buffer'`) is never read. "Contactar todos los elegibles" actually contacts up to 50, and a configured fixed size in controlled mode is ignored.

### A9. MEDIUM — Two of the advertised ranking weights are dead; displayed weights ≠ effective weights

`rank_staffing_candidates` consumes `skills`, `proximity`, `reliability`, `fairness`, `experience`/`role_progression`, `cost_efficiency`. It **never reads `house_tech_bonus` or `availability_confidence`**:

- The house-tech boost is a hardcoded ×1.3 multiplier (when `current_month_days < 4`), unrelated to the profile's `houseTechBonus` weight.
- `availability_confidence` — which the **emergency_fill** profile weights at **0.30**, its single biggest lever — is silently dropped, and the remaining weights are renormalized. The effective ranking for urgent jobs is very different from what the profile editor shows managers.

### A10. MEDIUM — Proximity is distance-to-Madrid, not distance-to-venue

`20260125090000` originally scored home→venue distance; `20260125120000` switched to a fixed Madrid base as a workaround for a schema issue (`locations.venue_id` didn't exist). The surrounding-jobs migration (`20260630100000`) now successfully joins venue coordinates via `jobs.location_id → locations`, so the original intent is implementable. Today a Toledo-based tech outranks a Barcelona-based tech *for a Barcelona show* on proximity. The UI shows `distance_to_madrid_km` under the label "Proximidad" without saying it's Madrid-relative.

### A11. MEDIUM — `scope: 'outstanding'` is undone on the first tick/resume

`startCampaign` filters out already-covered roles when `scope='outstanding'`, but `syncCampaignRolesWithCurrentRequirements` (run on every tick and resume) re-inserts **every** required role missing from `staffing_campaign_roles`. The deliberately excluded roles reappear (as `filled`, so mostly cosmetic — but the scope choice is not persisted and the UI shows roles the manager excluded).

### A12. MEDIUM — Offer handoff ignores the ranking; one declined offer blacklists a tech for the whole job

In `tickCampaign`'s assisted-handoff block (index.ts:978-1064):

- Confirmed-available candidates are offered in `updated_at` ascending order (first to reply wins), **not by candidate score**. The ranking system CARLOS advertises is bypassed at the moment that matters most — who actually gets the job.
- `offerRequestProfilesForJob` includes `declined` offers job-wide, so a tech who declined an offer for role X is permanently excluded from handoff for **any other role** on the same job, even after confirming availability. Plausibly intentional for same-day roles, but it also blocks e.g. "declined the -E slot, would take the -T slot".

### A13. MEDIUM — Role attribution of availability requests depends on send-event metadata

Availability rows are job-scoped by design (`role_code = NULL`, `20260519165000`), and `tickCampaign` reconstructs role intent from the latest `email_sent`/`whatsapp_sent` event `meta.role`. Requests sent without a role (manual matrix sends, older rows, events that failed to insert) are invisible to campaign counters: they don't count as `pendingAvailability` for any role, so CARLOS may over-contact; and confirmed responses from them only surface via `confirmedAvailabilityRowsForJob` (unused for capacity). The mapping is fragile — a single missing event flips the pipeline math.

### A14. MEDIUM — Saving settings from the UI wipes escalation and any policy field not on the form

`StaffingCampaignPanel.updateMutation` rebuilds the **entire** policy object from form state (`buildCampaignPolicy`) and writes it straight to `staffing_campaigns` via the data layer, bypassing the orchestrator. Any state applied by `escalate` (fridge inclusion, soft-conflict changes, multiplier) or server-side normalization is silently reverted on "Save Settings".

### A15. LOW — Cross-department auto-assign writes the wrong role column

`staffing-click/index.ts:622-626` patches the role column based on the **technician's profile department**, not the campaign/request department. A production-department offer accepted by a tech whose profile says `sound` writes `sound_role = 'PROD-...'`. The orchestrator carries `department` end-to-end; the click handler should use the request's department (from send event meta or the campaign) instead.

### A16. LOW — Idempotency check fragility

`send-staffing-email` uses `.maybeSingle()` on `idempotency_key` within 24h; if duplicates ever exist the query errors and is treated as non-blocking → duplicate send. The key also embeds the channel (`...:auto:email` vs `...:auto:whatsapp`), so a channel switch mid-campaign re-contacts everyone on the new channel.

### A17. LOW — Timezone inconsistency in whole-span date expansion

`staffing-click` expands job spans using a Europe/Madrid formatter (correct); `send-staffing-email`'s timesheet conflict check expands the same span with `toISOString()` (UTC). Jobs starting 00:00–01:59 CET/CEST check a different first date than the one that will be written, so a real conflict can slip through (or a phantom one block a send).

### A18. LOW — Wave sending is serial and inline; startCampaign auto-tick can hit edge limits

`tickCampaign` sends each contact sequentially with a 30s timeout, inside a single invocation — and `startCampaign` with `mode='auto'` runs the first tick synchronously before responding. A large first wave (e.g. blast mode, 50 sends) risks the function wall-clock limit; a partially-sent wave still increments `wave_number` with no record of who was skipped.

### A19. Notes / nits

- `rank_staffing_candidates(p_mode)` is unused — assisted and auto rank identically.
- `reliability_stats` aggregates every `staffing_requests` row for every candidate with no time bound; will drift and slow as history grows.
- The surrounding-jobs guard hard-excludes candidates whose adjacent job has **no location data** — in a dataset with patchy lat/lng this silently shreds the candidate pool (conservative, but invisible to the manager; the reason string only appears for *allowed* candidates).
- `redirectResponse` in `staffing-click` HEAD-probes the result page on **every** response (~700ms budget) before redirecting — permanent latency tax on technicians' clicks.
- The wake-up trigger updates `next_run_at` for all active campaigns on the job (all departments) on any request status change — harmless but noisy.
- `soft_conflict_policy: 'manager_approval'` and `'ignore'` behave identically to `'warn'` everywhere; only `'block'` does anything in the RPC.
- Reasons strings from the RPC are English ("Primary skill: …", "Rate adjustment: …") while the entire UI is Spanish.
- `StaffingCampaignPanel` "History Weight" input min is 0.15 in the start dialog but 0 in the edit form.
- `useStaffing.useCancelStaffingRequest` re-uses `'expired'` as "cancelled by manager" — indistinguishable from a real timeout in analytics and in the decline-penalty logic (currently neither exists, but see A2).

---

## Part B — Making CARLOS feel like a human coordinator

The current engine is a solid *pipeline* (waves → availability → offer → assign) but it behaves like a batch job: deterministic ordering, no sense of time pressure, no memory of how people behave, silent stalls, and no courtesy messages. These are the changes, roughly in impact order, that would make delegation feel safe.

### B1. Patience with a deadline (fixes A2/A5 and is the single biggest win)

A human coordinator gives people a few hours, sends one polite nudge, then moves on. Concretely:

- Enforce phase TTLs (A2) with **one reminder at ~60% of TTL** before expiring ("Te escribimos por el bolo del sábado, ¿pudiste verlo?"). Reminders measurably outperform silent expiry.
- Make cadence **deadline-aware**: scale TTLs and wave wait with time-to-show. `hours_to_start > 14d` → relaxed (48h TTL); `< 72h` → aggressive (4h TTL, bigger buffer); `< 24h` → emergency behavior regardless of profile. The profile system already encodes this per-job; it should degrade continuously as the date approaches instead of being fixed at campaign start.

### B2. Offer to the best available person, not the fastest clicker (fixes A12)

When multiple techs confirm availability, rank the handoff by `final_score` (re-run the RPC or persist scores on the request at send time), tie-breaking by response speed. Persist the score + rank at offer time into `staffing_events` so the UI can explain: "Se ofreció a María (82 pts) antes que a Jorge (74 pts) por fiabilidad y experiencia en SND-PA."

### B3. Respect people's time-of-day

Queue non-urgent sends into a humane window (09:00–21:30 Europe/Madrid; configurable per campaign). A 03:12 WhatsApp from CARLOS is the fastest way to make the system feel robotic — and to get muted. `emergency_fill` bypasses the window. Implementation: `next_run_at` clamping + a `send_after` column on queued contacts.

### B4. Learn how each tech responds

Track per-profile: median response latency per channel, acceptance rate by job type/venue distance, last-minute reliability. Use it for:

- **Channel choice**: contact WhatsApp-responsive people by WhatsApp automatically (respecting stored preference).
- **`availability_confidence` as a real signal** (fixes A9's dead weight): probability of a *timely* answer, weighted heavily for `emergency_fill`. "Who will answer in the next hour" is exactly what a human dispatcher optimizes under pressure.
- **Wave sizing**: expected-yield model — if historical acceptance for this role/venue is ~30%, a shortfall of 2 needs ~7 contacts, not 3. Replaces the static buffer with something a seasoned coordinator does instinctively.

### B5. Decline reasons and proportionate memory

Add a one-tap reason to the decline page ("Ocupado esa fecha" / "No me interesa este rol" / "Tarifa" / "Otro"). Then:

- "Busy that date" → no penalty at all (currently every decline feeds the skill-score penalty in `20260519170000`).
- "Not this role" → cool-down for that role prefix only, decaying over ~90 days rather than counting forever.
- "Rate" → surface to the manager as a rate-negotiation flag instead of silently down-ranking.

Un-nuanced decline penalties read as grudges; time-decayed, reason-aware ones read as judgment.

### B6. Venue-aware geography, both as guard and as bonus (fixes A10)

- Score proximity home→**venue** (coordinates already joinable), fallback to Madrid base only when the job has no location.
- Turn the surrounding-jobs check into a **positive continuity signal** too: an adjacent-day job at the *same venue / same tour* should add points (the tech is already there; humans love that booking), not just avoid a block.
- When location data is missing, degrade to soft-conflict + reason ("No pudimos verificar la distancia del bolo adyacente") instead of hard exclusion, so the manager sees who was skipped and why.

### B7. Fair rotation among near-equals

Deterministic ordering means the same top-scored tech gets first shot at every job, starving the rest (the current fairness score only reacts after long gaps). Add small controlled jitter: within score bands of ±5 pts, rotate first contact by "offers received recently" so equally-good people share opportunities. This is what makes crews perceive the system as fair — and keeps the bench warm for when the favorite is unavailable.

### B8. Escalate to the human at the right moments (fixes A5/A6 silence)

CARLOS should never stall silently. Push/notify the campaign owner when:

- wave cap reached with unfilled roles ("3 oleadas enviadas, SND-RF sigue 0/1 — ¿amplío al grupo de nevera?") — making `escalate_after_wave` real and turning escalation into a *proposal* the manager approves with one tap (this is also the natural home for `manager_approval` soft-conflict handling, A19);
- candidate pool exhausted or shrunk below shortfall;
- `< 48h` to start with open roles;
- an offer expired unanswered for a critical role.

An agent you can delegate to is one that raises its hand when stuck, with a suggested next move.

### B9. Auto-book trusted regulars when urgent

Implement `minimum_auto_book_score` for real: in `emergency_fill`, allow skipping the availability round-trip and sending a direct offer (or even auto-assigning with instant notification + easy decline) to candidates above the threshold with clean calendars. Humans don't ask a trusted regular "are you free?" and then "do you want it?" two hours before doors — they call and book.

### B10. Team composition awareness

Score the *set*, not just individuals, when a role needs multiple slots or the job has multiple roles:

- `training_friendly`: pair at least one experienced tech with the trainees (cap the number of low-experience picks per role).
- `high_risk_critical`: prefer combinations that have worked together before (`job_assignments` co-occurrence is cheap to compute).
- Respect crew-chief affinities ("suele trabajar con X") as a mild bonus — the most human of all signals.

### B11. Narrative timeline + Spanish explanations

The `staffing_campaign_events` table exists but the story is scattered. Persist every decision (wave sent, candidate skipped + why, offer handoff order, expiry, escalation) as structured events and render a timeline in the Overview tab: "10:04 — Oleada 1: 5 contactados · 11:32 — María confirmó disponibilidad · 11:35 — Oferta enviada a María (mejor puntuación)…". Localize the RPC reason strings to Spanish. Managers trust what they can audit; the `audit.*` policy flags already promise exactly this.

### B12. Courtesy closes (part of A6)

When a role fills: immediately expire outstanding requests and send "gracias, ya está cubierto — te tendremos en cuenta para la próxima" to pending/late responders. Nothing marks a system as inhuman like ghosting the people who raised their hand. Also confirm to the booked crew with the job summary (date, venue, role, call time when available).

### B13. Ranking hygiene (smaller, cumulative)

- Time-decay reliability/experience aggregates (last 18 months) so the model reflects who people are *now*.
- Bound `reliability_stats` and `role_declines` to a window for performance (A19).
- Feed real outcomes back: log score-at-send vs accepted/declined per campaign, and show a per-profile hit-rate report so weights can be tuned from evidence instead of intuition (eventually: per-department logistic fit).
- Remove or wire the dead knobs (A9, `size_mode`, `p_mode`) so the settings UI is honest — an agent that ignores its own instructions erodes trust faster than one with fewer options.

---

## Suggested priority

| Order | Item | Why |
|-------|------|-----|
| 1 | A1 (GET-click mutation) | Data integrity + real-world false bookings |
| 2 | A2 + B1 (TTL enforcement, reminders, deadline pacing) | Unstalls auto mode; biggest UX change |
| 3 | A3 (sweeper lock recovery) | Auto mode reliability |
| 4 | A6 + B12 (capacity check on confirm, courtesy closes) | Prevents overbooking, stops ghosting |
| 5 | A4/A5 + B8 (escalation rework, human-in-the-loop alerts) | Makes the safety valves real |
| 6 | B2 + A12 (ranked handoff) | The ranking system finally decides who gets the job |
| 7 | A10 + B6 (venue proximity) | Correctness of a core score |
| 8 | A9 + B4 (real availability-confidence, dead weights) | Honest profiles, better urgent picks |
| 9 | B3/B5/B7 (quiet hours, decline reasons, rotation) | The "feels human" layer |
| 10 | B10/B11/B13 | Composition, auditability, learning loop |
