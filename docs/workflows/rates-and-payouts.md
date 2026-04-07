# Rates & Payout Management

> Rate catalog, approval workflows, payout calculation, overrides, and PDF export.

## Overview

The rates system manages technician compensation: base rates by category, extras (travel, day off), job/tour-level approval workflows, payout overrides, and PDF export of rate summaries.

## Key Files

| Category | Path |
|----------|------|
| **Feature module** | `src/features/rates/` |
| **Page** | `src/pages/RatesCenterPage.tsx` (4 tabs) |
| **Approvals table** | `src/features/rates/components/RatesApprovalsTable.tsx` (14.8KB) |
| **Catalog editors** | `src/features/rates/components/CatalogEditors.tsx` |
| **House tech overrides** | `src/features/rates/components/HouseTechOverridesPanel.tsx` |
| **Approval hooks** | `src/hooks/useJobRatesApproval.ts`, `useTourRatesApproval.ts` |
| **Payout hooks** | `src/hooks/useJobPayoutTotals.ts`, `useJobPayoutOverride.ts` |
| **Extras hooks** | `src/hooks/useJobExtras.ts`, `useRateExtrasCatalog.ts` |
| **House tech rates** | `src/hooks/useHouseTechRates.ts` |
| **Payout data** | `src/components/jobs/payout-totals/useJobPayoutData.ts` |
| **PDF export** | `src/utils/rates-pdf-export.ts` (47.8KB) |
| **Services** | `src/services/ratesService.ts`, `tourRatesExport.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `jobs` / `tours` | `rates_approved`, `rates_approved_at`, `rates_approved_by` fields |
| `rate_extras_2025` | Extra types catalog (travel_half, travel_full, day_off) with amounts |
| `rate_cards_tour_2025` | Base rates by category (tecnico, especialista, responsable) |
| `custom_tech_rates` | Profile-specific overrides for base/overtime/travel rates |
| `job_rate_extras` | Per-technician extras (job_id, technician_id, extra_type, quantity, amount_override, status) |
| `job_technician_payout_overrides` | Manual payout overrides (override_amount_eur, set_by, set_at) |
| `v_job_tech_payout_2025` | Materialized view: job_id, technician_id, totals (timesheets, extras, expenses) |

## Rates Center Page (4 Tabs)

1. **Catálogo de tarifas** — Base rate catalog and extras definitions
2. **Tarifas internas** — House tech-specific rate overrides
3. **Aprobaciones** — Pending approval queue for tours/jobs
4. **Partes de horas** — Timesheet overview

## Workflows

### Approval Workflow

```text
1. TOURS/JOBS default to rates_approved = false
2. MANAGEMENT reviews in RatesApprovalsTable
3. STATUS CHECKS:
   - "Approval required" (rates_approved = false)
   - "No tour jobs" / "No assignments"
   - "No timesheets" / "Timesheets pending" / "Timesheets rejected"
   - "Extras pending" / "Extras rejected"
4. APPROVE → sets rates_approved = true, timestamp, user
5. TECHNICIANS can now see payout totals on dashboards
```

### Payout Calculation

```text
1. FETCH base amounts from v_job_tech_payout_2025 view
   - timesheets_total (from approved timesheets)
   - extras_total (from approved extras)
   - expenses_total (from expense records)
2. FOR TOUR DATES: per-day rate × scheduled days + extras + expenses
3. APPLY non-autonomo deduction (30€/day) if applicable
4. IF override exists: use override_amount_eur instead
5. SUM all technicians for grand total
```

### Payout Override

```text
1. MANAGER sets override via useJobPayoutOverride
2. CALLS set_technician_payout_override RPC
3. STORES in job_technician_payout_overrides
4. TRIGGERS email notification to technician
5. OVERRIDE replaces calculated total in payout views
```

### Extras Management

```text
1. MANAGEMENT configures extras per technician in JobExtrasEditor
2. TYPES: travel_half, travel_full, day_off (from rate_extras_2025)
3. QUANTITY and optional amount_override per extra
4. STATUS workflow: pending → approved
5. READ-ONLY for technicians
```

### Travel Rate Resolution

Travel day rates follow a priority chain:

```text
1. Per-technician custom rate (custom_tech_rates.travel_half_day_eur / travel_full_day_eur)
2. House tech / assignable management fixed rate (€20)
3. Catalog default (rate_extras_2025)
```

Custom travel rates are set per-technician in Settings > Users > Edit User Profile > "Tarifas internas" section (management/admin only). The `extras_total_for_job_tech()` SQL function and the `JobExtrasEditor` frontend component both follow this priority chain.

## PDF Export

`generateTourRatesSummaryPDF()` in `src/utils/rates-pdf-export.ts` (47.8KB):
- Detailed multi-page PDF with all job rates
- Per-technician totals, multipliers, extras breakdown
- `buildTourRatesExportPayload()` gathers all data (jobs, quotes, profiles)
- Single job export also available via JobPayoutTotalsPanel

## Integration Points

- **Timesheet System**: Approved timesheets feed into payout totals
- **Tour System**: Tour-level rate approval controls all tour date visibility
- **Custom Rates**: Per-technician overrides via `custom_tech_rates` table
- **Push Notifications**: Override notifications sent to technicians
- **Flex Integration**: Rate data referenced in crew assignment sync
