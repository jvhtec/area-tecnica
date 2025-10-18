# Rates & Extras Center Workflow Audit

## Overview
The application supports two pay-processing paths: **regular jobs** (single-day and festivals) and **tour dates**. Both flows revolve around the Rates & Extras Center but differ in how base rates, extras, and approvals interact. This document summarizes the actual workflow observed in the codebase, clarifies role responsibilities, enumerates operational states, and contrasts current behavior with the expected process.

## Roles & Responsibilities
- **Technicians / House Techs**
  - Review and edit their draft timesheets, then submit them for approval. 【F:src/components/timesheet/TimesheetView.tsx†L492-L558】
  - See rate breakdowns only after management exposes the visible breakdown fields that the backend RPC returns. 【F:src/hooks/useTimesheets.ts†L40-L58】【F:src/components/timesheet/TimesheetView.tsx†L709-L777】
  - View job totals on dashboards only when the job (or tour) has been marked as approved. 【F:src/components/timesheet/MyJobTotal.tsx†L70-L137】【F:src/components/dashboard/MyJobTotalsSection.tsx†L105-L215】

- **Management**
  - Auto-generate timesheets for assigned technicians, maintain time entries, and approve submitted timesheets. 【F:src/hooks/useTimesheets.ts†L87-L199】【F:src/components/timesheet/TimesheetView.tsx†L493-L582】
  - Manage job-level approval toggles that control technician visibility for both regular jobs and tour dates. 【F:src/components/jobs/JobDetailsDialog.tsx†L398-L443】【F:src/components/tours/TourRatesManagerDialog.tsx†L117-L166】
  - Configure extras quantities per technician and maintain the extras catalog and base rate tables. 【F:src/components/jobs/JobExtrasManagement.tsx†L25-L156】【F:src/components/jobs/JobExtrasEditor.tsx†L140-L215】【F:src/pages/RatesCenterPage.tsx†L31-L86】
  - Review aggregated payouts and rate approvals inside the Rates & Extras Center. 【F:src/features/rates/components/RatesApprovalsTable.tsx†L18-L141】【F:src/hooks/useJobPayoutTotals.ts†L5-L28】

## Regular Job Workflow (Single / Festival)

1. **Timesheet Creation & Drafting**
   - When jobs (except dry hire or tour dates) are scheduled, the `useTimesheets` hook auto-creates timesheets for each assigned technician across active job dates (travel/off dates are skipped). 【F:src/hooks/useTimesheets.ts†L87-L199】
   - Timesheets start as `draft`; technicians can edit their own drafts, while management can edit drafts for any technician. 【F:src/components/timesheet/TimesheetView.tsx†L492-L558】

2. **Submission & Approval**
   - Technicians submit drafts, transitioning the status to `submitted`. Management reviews these entries and either approves them (status becomes `approved`) or leaves them pending; there is no explicit “reject” action, only editing or deletion. Approval triggers an RPC recalculation (`compute_timesheet_amount_2025`) to persist the monetary breakdown. 【F:src/hooks/useTimesheets.ts†L334-L353】【F:src/components/timesheet/TimesheetView.tsx†L549-L570】
   - Rate calculations are only visible to technicians when the backend marks `amount_breakdown_visible`. Managers always see the full breakdown and can force a recalculation if needed. 【F:src/hooks/useTimesheets.ts†L40-L58】【F:src/components/timesheet/TimesheetView.tsx†L709-L777】

3. **Extras Management**
   - Management configures extras per technician via `JobExtrasManagement`, which wraps the `JobExtrasEditor`. Editors read and write directly to `job_rate_extras` with hard limits per extra type; technicians have read-only visibility. 【F:src/components/jobs/JobExtrasManagement.tsx†L25-L156】【F:src/components/jobs/JobExtrasEditor.tsx†L140-L215】【F:src/hooks/useJobExtras.ts†L6-L27】
   - Extras rely on the shared catalog managed in the Rates Center (travel half/full, day off). Amounts are immediately effective—there is no separate approval state for extras. 【F:src/components/jobs/JobExtrasEditor.tsx†L60-L109】【F:src/pages/RatesCenterPage.tsx†L31-L86】

4. **Job Approval & Visibility**
   - A management toggle (`rates_approved`) on each job governs when technicians can view totals and extras. Until it is set true, technicians see a “pending approval” notice in job totals, even if timesheets were approved. 【F:src/components/jobs/JobDetailsDialog.tsx†L398-L444】【F:src/components/timesheet/MyJobTotal.tsx†L70-L90】
   - Once approved, technicians can see their aggregated totals, which combine approved timesheet amounts and extras from the `v_job_tech_payout_2025` view. 【F:src/hooks/useJobPayoutTotals.ts†L5-L24】【F:src/components/timesheet/MyJobTotal.tsx†L94-L137】

5. **Aggregation & Dashboard Display**
   - The dashboard aggregates job totals across all approved jobs, separating pending and approved amounts. Multi-day jobs are rolled up automatically by the payout view, and managers can access detailed breakdowns in job management screens. 【F:src/components/dashboard/MyJobTotalsSection.tsx†L105-L215】【F:src/hooks/useJobTotals.ts†L5-L33】

## Tour Date Workflow

1. **Global Rate Setup**
   - Managers maintain the base tour rate catalog (`rate_cards_tour_2025`) and extras catalog via the Rates Center or directly inside the Tour Rates Manager dialog. 【F:src/pages/RatesCenterPage.tsx†L31-L86】【F:src/components/tours/TourRatesManagerDialog.tsx†L171-L327】
   - The Tour Rates Manager loads all tour dates and assignments, computing per-tech rate quotes through a manager-only RPC that bypasses RLS filters. 【F:src/components/tours/TourRatesManagerDialog.tsx†L29-L215】【F:src/hooks/useTourJobRateQuotesForManager.ts†L1-L79】

2. **Tour-Level Approval**
   - Management must explicitly mark a tour’s rates as approved. The dialog shows approval status and provides “Approve” / “Revoke” actions that write to `tours.rates_approved`. 【F:src/components/tours/TourRatesManagerDialog.tsx†L117-L166】

3. **Per-Date Extras & Issue Resolution**
   - For each tour date job, managers can adjust extras per technician using the same `JobExtrasEditor`. The dialog also surfaces calculation issues (missing category, missing base rate) with inline fixers. 【F:src/components/tours/TourRatesManagerDialog.tsx†L215-L309】
   - Extras are stored per job/technician and immediately affect the computed quote returned by the view `v_tour_job_rate_quotes_2025`. 【F:src/hooks/useTourJobRateQuotes.ts†L5-L27】

4. **Technician Visibility**
   - Technicians see weekly tour pay in the dashboard only when the tour itself is approved. If extras exist on a tour date, that job must also be individually marked `rates_approved` before the totals surface. Pending quotes remain hidden with informational alerts. 【F:src/components/dashboard/TechnicianTourRates.tsx†L103-L206】【F:src/components/dashboard/MyJobTotalsSection.tsx†L51-L225】

## Operational States

| Area | State | Trigger / Owner | Visibility Impact |
| --- | --- | --- | --- |
| Timesheet | `draft` | Auto-created or edited; technician/manager | Visible to assigned tech and management; no pay calculation yet. |
| Timesheet | `submitted` | Technician submits | Managers can approve; technicians still see but cannot edit. |
| Timesheet | `approved` | Manager approves (and recomputes amounts) | Rate breakdown visible to managers; technicians see breakdown once `amount_breakdown_visible` is populated. 【F:src/hooks/useTimesheets.ts†L40-L58】【F:src/components/timesheet/TimesheetView.tsx†L709-L777】 |
| Job Extras | Numeric quantity per type | Manager edits via Rates Center or job dialogs | Immediately included in payout totals; no pending/approved status. 【F:src/components/jobs/JobExtrasEditor.tsx†L60-L215】 |
| Job Approval | `rates_approved` flag on `jobs` | Manager toggles in Job Details | Controls technician access to totals for that job (regular or tour date). 【F:src/components/jobs/JobDetailsDialog.tsx†L398-L444】【F:src/components/timesheet/MyJobTotal.tsx†L70-L90】 |
| Tour Approval | `rates_approved` flag on `tours` | Manager toggles in Tour Rates Manager | Required for any tour pay to appear on technician dashboards; extras with totals additionally require the job-level flag. 【F:src/components/tours/TourRatesManagerDialog.tsx†L117-L166】【F:src/components/dashboard/TechnicianTourRates.tsx†L103-L206】 |

## Differences from Expected Workflow

1. **No explicit rejection path for hours** – Timesheets can be edited or deleted but lack a “reject” status; managers approve or revert to draft by editing, which differs from the expected “approve or reject” step. 【F:src/components/timesheet/TimesheetView.tsx†L492-L582】
2. **Extras do not require approval** – Extras become active immediately upon edit; there is no workflow step to “approve extras,” even though the expected process calls for management approval. 【F:src/components/jobs/JobExtrasEditor.tsx†L60-L215】
3. **Job approval is manual and decoupled from hours review** – Managers can toggle `rates_approved` regardless of timesheet status (the UI shows issues but does not enforce them). This means totals could be revealed before every timesheet is approved. 【F:src/components/jobs/JobDetailsDialog.tsx†L398-L444】【F:src/features/rates/components/RatesApprovalsTable.tsx†L74-L139】
4. **Job extras tab visibility depends on prior approval** – Inside `JobDetailsDialog`, the Extras tab only appears when the job is already approved and extras exist, preventing managers from adding the first extra from that screen. They must use other management views instead. 【F:src/components/jobs/JobDetailsDialog.tsx†L102-L121】【F:src/components/jobs/JobExtrasManagement.tsx†L25-L156】
5. **Technician totals gating differs by job type** – Regular job totals hide until the job flag is approved, but tour totals require both tour approval and (if extras exist) per-date job approval. This matches the expected gating but relies on manual toggles rather than automated completion checks. 【F:src/components/dashboard/MyJobTotalsSection.tsx†L51-L215】【F:src/components/dashboard/TechnicianTourRates.tsx†L103-L206】

## Process Alignment Recommendations (Non-Technical)

- **Adopt an approval checklist**: Require managers to verify submitted timesheets, extras entries, and assignments before toggling `rates_approved` for a job or tour. Document this checklist alongside the Rates & Extras Center SOP.
- **Define an extras review step**: Even without code changes, managers can treat extras edits as “pending” until reviewed in the Rates Center approvals table. Establishing a naming convention or notes field in operational practice can help track this.
- **Clarify rejection workflow**: Introduce operational guidance for how managers should handle incorrect submissions (e.g., revert to draft and notify the technician) since there is no dedicated reject action.
- **Specify entry points for adding first extras**: In training materials, highlight that managers must use the Rates Center or Unified Job Management view to add initial extras before the job is approved, due to the Job Details dialog constraint.

This documentation can be used for onboarding managers and technicians, ensuring consistent handling of rates, extras, and approvals within the current application behavior.
