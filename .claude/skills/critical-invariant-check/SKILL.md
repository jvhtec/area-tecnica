---
name: critical-invariant-check
description: Checks whether a proposed or already-written change respects this codebase's explicitly documented "don't bypass" invariants — tour/job assignment cascade, staffing campaign state machine, Flex folder hierarchy ordering, server-side timesheet calculation, and Edge Function exposure classification.
disable-model-invocation: true
context: fork
agent: Explore
---

You are checking a change against this codebase's known landmine invariants — patterns CLAUDE.md explicitly flags as "Critical" or "don't bypass," because breaking them causes data-integrity bugs that surface much later (orphaned timesheets, broken Flex folder trees, staffing campaigns stuck in an invalid state, silently misclassified public Edge Functions).

Task: $ARGUMENTS (describe the change, point to a diff/branch, or name specific files)

Read-only investigation — do not edit anything.

## What to check

Only evaluate the invariants actually touched by the change. Don't pad the report with irrelevant ones.

1. **Tour assignment cascade** (`job_assignments`/`tour_assignments`/`timesheets` tables, related hooks/services): removing a tour assignment must remove all related job assignments and timesheets. Flag any new deletion path that touches `tour_assignments` without going through the existing cascade logic — search for direct `.delete()` calls on these tables outside the established cascade service/RPC.

2. **Staffing campaign state machine** (`supabase/functions/staffing-orchestrator`, `staffing-click`, `staffing-sweeper`, `staffing_campaigns` + related tables, `src/features/staffing/`): status transitions must go through the established flow (create → rank candidates → send invitations → accept/decline via staffing-click → sweeper cleans up expired). Flag any direct status/column update on a campaign or invitation that bypasses this flow.

3. **Flex folder hierarchy** (`src/utils/flex-folders/`, `create-flex-folders` function, `flex_folders` table): the Tour/Festival → Date → Department → Dryhire (optional) hierarchy must exist before creating work elements or crew calls. Flag any new code path that creates a Flex work element/crew call/labor resource without first verifying or creating the parent folder chain.

4. **Server-side timesheet calculation** (`compute_timesheet_hours()` RPC, `public_holidays` table): regular/overtime/night-hour and holiday-rate math is computed server-side. Flag any new client-side reimplementation of hour/rate arithmetic that should instead call the RPC.

5. **Edge Function exposure classification** (only if the change adds/modifies a Supabase Edge Function): check not just whether `scripts/governance/edge-function-exposure.json` has an entry that will pass CI, but whether the *class* chosen (`public-token`/`authenticated-user`/`privileged-role`/`service-only`) actually matches what the function does — e.g. a function reading privileged data classified as `authenticated-user` instead of `privileged-role` would pass the governance gate while still being a real authorization gap.

## Output

For each of the 5 invariants: state whether it's relevant to this change. If relevant, give a verdict:
- **PASS** — respects the pattern, with the file/line showing why
- **FLAG** — potential bypass, with file:line and a one-sentence explanation of the failure scenario

If none of the 5 invariants are touched, say so plainly and stop — don't manufacture findings.
