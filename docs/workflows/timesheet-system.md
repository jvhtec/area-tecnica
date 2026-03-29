# Timesheet System

> Time tracking with draft → submitted → approved workflow, server-side rate calculation, and PDF export.

## Overview

The timesheet system tracks technician hours per job per date. Timesheets are auto-created when assignments are made, follow a status workflow (draft → submitted → approved/rejected), and calculate payouts via server-side RPC functions.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/Timesheets.tsx` |
| **Main view** | `src/components/timesheet/TimesheetView.tsx` |
| **Edit form** | `src/components/timesheet/TimesheetEditForm.tsx` |
| **Signature** | `src/components/timesheet/TimesheetSignature.tsx` |
| **Reject dialog** | `src/components/timesheet/TimesheetRejectDialog.tsx` |
| **Job totals** | `src/components/timesheet/MyJobTotal.tsx`, `JobTotalAmounts.tsx` |
| **Core hook** | `src/hooks/useTimesheets.ts` (17.8KB) |
| **Approval hook** | `src/hooks/useTimesheetApproval.ts` |
| **Calculator** | `src/hooks/useShiftTimeCalculator.ts` (9.1KB) |
| **Recalc hook** | `src/hooks/useRecalcTimesheet.ts` |
| **PDF export** | `src/utils/timesheet-pdf.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `timesheets` | Main records (job_id, technician_id, date, start/end time, break, overtime, status, amounts) |
| `rate_cards_2025` | Base rate definitions by category |
| `job_date_types` | Date type overrides (off/travel days excluded) |
| `profiles` | Technician data |
| `public_holidays` | Madrid public holidays (affects rate calculations) |

### Timesheet Fields

```
id, job_id, technician_id, date
start_time, end_time, break_minutes, overtime_hours
ends_next_day (boolean for overnight shifts)
category: 'tecnico' | 'especialista' | 'responsable'
status: 'draft' | 'submitted' | 'approved' | 'rejected'
signature_data (Base64 PNG), signed_at
approved_by_manager, approved_by, approved_at
rejected_by, rejected_at, rejection_reason
amount_eur (calculated by RPC)
amount_breakdown (detailed rate breakdown JSON)
amount_eur_visible, amount_breakdown_visible (visibility-controlled)
```

## Workflow

### 1. Automatic Creation
When assignments are made (via matrix or tour), `autoCreateTimesheets()` creates draft timesheets:
- Iterates through all job dates (excluding 'off'/'travel' dates)
- Creates `(technician_id, date)` pairs in 'draft' status
- Only management users trigger auto-create

### 2. Draft (Technician Edits)
- Edit: start_time, end_time, break_minutes, overtime_hours, notes
- Hours auto-calculated by `useShiftTimeCalculator`
- Signature optional at this stage

### 3. Submission (Technician Action)
- `submitTimesheet()` → sets status to 'submitted'
- Optional signature capture
- Push notification sent to management (`timesheet.submitted` event)

### 4. Approval (Manager Action)
- Manager reviews in TimesheetView (filter by technician, department, date)
- `useTimesheetApproval.mutate()`:
  1. Sets `approved_by_manager = true`, `approved_by`, `approved_at`
  2. Calls `compute_timesheet_amount_2025` RPC with `_persist = true`
  3. RPC calculates: category-based rates, overtime, holiday multipliers, autonomo deductions
  4. Stores `amount_eur` and `amount_breakdown` on the timesheet
  5. Sends push notification to technician

### 5. Rejection (Manager Action)
- `rejectTimesheet(reason)` → status to 'rejected' with reason
- Technician must resubmit corrected version

## Rate Calculation (Server-Side)

The `compute_timesheet_amount_2025` RPC handles all payout math:
- **Category-based rates**: Different base rates for tecnico/especialista/responsable
- **Hour tiers**: Base (0-8h), mid-tier (10-12h), overtime (12h+)
- **Holiday rates**: Madrid public holidays from `public_holidays` table
- **Overnight shifts**: Handled via `ends_next_day` flag
- **Rehearsal flat rates**: When `is_rehearsal_flat_rate` is true
- **Autonomo deduction**: 30€/day for non-autonomo technicians
- **Job-specific overrides**: Custom rates per technician per job

## Visibility Rules

- Technicians only see amounts when `amount_breakdown_visible` is set
- Managers always see full breakdown
- Job-level `rates_approved` flag controls when technicians see totals on dashboards

## PDF Export

`downloadTimesheetPDF()` in `src/utils/timesheet-pdf.ts`:
- Corporate header with logos
- Table: Technician, Date, Start, End, Break, OT, Status, Amount
- Embedded signature images (base64 → image)
- Multi-page support
- Filename: `{jobTitle}_{date}.pdf`

## Integration Points

- **Assignment Matrix**: Assignments auto-create timesheets
- **Tour System**: Tour assignments cascade timesheets for all tour dates
- **Rates System**: Approved timesheets feed into payout totals
- **Activity Logging**: Submissions trigger `timesheet.submitted` activity events
- **Push Notifications**: Notifications on submit and approval
