# Finance Phase 0 — UX Surface Map

**Date:** 2026-10-02  
**Baseline:** `main` at branch creation  
**Scope:** current money-related product surfaces, overlap, user journeys, and a proposed target information architecture.  
**Change type:** documentation only. No runtime behaviour, schema, RLS, rate calculation, approval, or payout logic changes.

---

## 1. Why this map exists

Área Técnica now has enough real operating history to stop treating the finance features as a collection of screens that happened to grow next to one another.

The current product is already rule-rich:

- technician timesheets and approval,
- job and tour rates,
- house-tech/custom rates,
- rate extras,
- payout overrides,
- payout visibility/release,
- technician expenses,
- invoice-received tracking,
- payout-due estimation,
- payout PDFs and email delivery.

The problem is not lack of functionality. The problem is that the same financial lifecycle is exposed through too many surfaces with overlapping responsibilities and slightly different semantics.

Phase 0 should therefore preserve the current implementation as an executable specification while answering two questions in parallel:

1. **What are the actual financial domain rules?**
2. **What is the smallest coherent set of UX surfaces needed to operate those rules?**

This document answers the second question at the current-code level. It is intentionally descriptive first and prescriptive second.

---

## 2. UX principle

Do not consolidate by putting every control on one enormous Finance page.

Consolidate by **user intent**.

The current features reduce to five journeys:

1. **Configure policy** — define reusable rates, multipliers, extras and technician-specific defaults.
2. **Operate one job/tour** — review the financial state of a concrete production and resolve exceptions.
3. **Approve/release money** — decide that a calculated amount is ready to be exposed/settled.
4. **Settle/pay** — track invoices, due windows and payment workflow across jobs.
5. **Technician self-service** — submit work/expenses and understand what is pending, approved or payable.

Any surface that cannot be explained by one of these journeys is probably either a drill-down or historical duplication.

---

## 3. Current top-level routes

### 3.1 Rates & Extras Center

**Route:** `/management/rates`  
**Page:** `src/pages/RatesCenterPage.tsx`  
**Access:** management  
**Current navigation label:** “Tarifas y extras”

The page currently contains four tabs:

| Tab | Component / source | Current responsibility |
| --- | --- | --- |
| Catálogo de tarifas | `ExtrasCatalogEditor`, `BaseRatesEditor` | Global/default rate and extra configuration |
| Tarifas internas | `HouseTechOverridesPanel` | Per-technician internal/custom rate overrides |
| Aprobaciones | `RatesApprovalsTable` | Cross-job/tour financial release status and drill-down |
| Partes de horas | `Timesheets` page embedded as a tab | Timesheet operations and approval |

This is already evidence that one route contains two different domains:

- **configuration**: catalogs and internal rates;
- **operations**: approvals and timesheets.

The page title describes configuration, while half of the page is operational workflow.

### 3.2 Payouts Due

**Route:** `/management/payouts-due`  
**Page:** `src/pages/PayoutsDueFortnights.tsx`  
**Access:** `payoutsDue`

Responsibilities currently include:

- aggregating payable technician totals from `v_job_tech_payout_2025`,
- estimating payment windows from service dates,
- grouping payments by fortnight,
- filtering/sorting by technician, department and job,
- marking freelancer invoices as received,
- exporting/printing settlement groups.

This is not rate configuration. It is a **settlement queue** and should eventually be named and modelled as such.

### 3.3 Expenses

**Route:** `/gastos`  
**Page:** `src/pages/Expenses.tsx`  
**Access:** project operations

Responsibilities include:

- global expense review,
- status filtering,
- technician/job/date filtering,
- approval/rejection,
- receipt inspection,
- bulk/management operations.

This is a legitimate cross-job operational queue. It overlaps with job-local expense management, but the overlap is useful when the distinction is explicit:

- job-local = understand one production;
- global = clear the queue.

---

## 4. Current job-level surfaces

A single job can expose financial controls through multiple components.

### 4.1 Job details

Relevant components include:

- `src/components/jobs/JobDetailsDialog.tsx`
- `src/components/jobs/job-details-dialog/tabs/JobDetailsInfoTab.tsx`
- `src/components/department/EnhancedJobDetailsModal.tsx`

These surfaces currently aggregate several financial concerns:

- job-level `rates_approved` state,
- payout totals,
- payout email/PDF actions,
- extras,
- expenses,
- approval state,
- technician financial visibility.

This is directionally correct: the job is a natural financial boundary.

The weakness is that the same operations are also available elsewhere, which makes the job view one of several authorities rather than the obvious operational home.

### 4.2 Job payout totals

**Component:** `src/components/jobs/payout-totals/JobPayoutTotalsPanel.tsx`

Responsibilities include:

- technician payout aggregation,
- timesheet/extras totals,
- payout overrides,
- approval-related actions,
- payout PDF/email flows,
- tour-date adaptations.

This is already close to the core of a future **Job Finance** surface, but it currently lives as a component inside several different containers and has to understand too much surrounding state.

### 4.3 Job extras

Relevant components:

- `src/components/jobs/JobExtrasManagement.tsx`
- `src/components/jobs/JobExtrasEditor.tsx`
- `src/components/jobs/JobExtrasDialog.tsx`

Responsibilities:

- edit per-job/per-technician extras,
- resolve travel/day-off quantities,
- apply custom technician travel rates,
- present extra totals.

The same editor is also embedded in tour finance management. Extras therefore behave as a portable sub-feature, but they do not currently have a single lifecycle owner.

### 4.4 Job expenses

**Component:** `src/components/jobs/JobExpensesPanel.tsx`

Responsibilities:

- job-local expense permissions,
- job-local expense history,
- approval/rejection,
- receipt access,
- technician/category totals.

This is a good job-level drill-down and should survive consolidation, but under a common Job Finance shell rather than as an independent financial island.

### 4.5 Timesheets

Relevant surfaces include:

- `src/pages/Timesheets.tsx`
- `src/components/timesheet/TimesheetView.tsx`
- `src/components/technician/TimesheetView.tsx`
- `src/hooks/useTimesheets.ts`

Responsibilities include:

- time entry,
- signature,
- submission,
- management approval/rejection/reset,
- amount calculation,
- job-total display,
- manager and technician variants.

Timesheets are both an operational record and a financial input. Their current embedding inside the Rates Center makes that distinction unclear.

---

## 5. Current tour-level surfaces

### 5.1 Tour Rates Manager

**Component:** `src/components/tours/TourRatesManagerDialog.tsx`  
**Entry points:** Tour Management and Rates Center approval drill-downs.

Responsibilities currently include:

- selecting tour jobs/dates,
- inspecting calculated tour quotes,
- fixing missing categories/rates,
- editing extras,
- editing base-rate catalog values,
- editing house-tech/custom rates,
- job-level payout release,
- tour-level rate release,
- payout email actions,
- PDF export.

This is the densest example of surface overlap.

It combines:

- global configuration,
- technician configuration,
- job operations,
- tour operations,
- approval/release,
- communications/export.

It should ultimately become a **Tour Finance overview/drill-down**, not a second finance application inside a modal.

### 5.2 Tour Rates Panel

**Component:** `src/components/tours/TourRatesPanel.tsx`

Responsibilities include quote display and payout-related actions for tour jobs.

It overlaps with:

- `TourRatesManagerDialog`,
- `JobPayoutTotalsPanel`,
- job-level approval,
- technician payout approval.

The eventual question should be whether this becomes a reusable read-only summary inside Tour Finance, or disappears once the main financial drill-down is available.

---

## 6. Current technician-facing surfaces

Technicians currently encounter financial state through several workflows rather than one conceptual “my money” model.

### 6.1 Timesheets

Technicians:

- enter hours,
- sign and submit,
- see approval/rejection state,
- may see rate/amount information according to visibility rules.

### 6.2 Job totals

**Component:** `src/components/timesheet/MyJobTotal.tsx`

Responsibilities:

- show technician job payout totals,
- gate visibility using job/tour rate approval state,
- expose aggregated payout information.

### 6.3 Expenses

Technicians can submit and inspect their own permitted job expenses through job/self-service surfaces.

### 6.4 Invoice/payment state

`PayoutsDueFortnights` tracks invoice receipt on `job_assignments`, but this lifecycle is primarily manager-facing. Technician-facing visibility of invoice/payment progression is not represented as one coherent journey.

The target should be a single technician mental model:

> Work submitted → reviewed → amount approved → invoice needed/received if applicable → scheduled/due → paid.

The backend model does not yet fully express every one of those states, but the UX should ultimately follow that lifecycle rather than expose individual implementation tables.

---

## 7. Current configuration surfaces

Reusable financial policy is spread across several components.

### Global/default policy

- `rate_cards_2025`
- `rate_cards_tour_2025`
- `rate_extras_2025`
- multiplier tables/rules
- Rates Center catalog editors

### Per-technician policy

- `custom_tech_rates`
- `HouseTechOverridesPanel`
- profile/settings rate editors
- inline fixers inside `TourRatesManagerDialog`

### Per-job/per-date exceptions

- `job_rate_extras`
- `job_technician_payout_overrides`
- `job_technician_rate_mode_dates`
- rehearsal/date-mode controls
- timesheet-derived values

The UX should make this precedence visible:

```text
global policy
    ↓
technician policy
    ↓
job/date facts
    ↓
job/date exceptions
    ↓
calculation revision
    ↓
approval/release
```

Today the user can encounter controls from several of these levels in the same modal without a clear indication of whether they are changing a reusable policy or only one job.

---

## 8. Duplicate / overlapping operations

### 8.1 Financial release

`rates_approved` can currently be manipulated from multiple surfaces, including job details and tour-rate management.

This creates multiple entry points for what looks like one business transition.

**Target:** one domain command and one reusable control, rendered in context where useful.

### 8.2 Timesheet approval versus payout release

A timesheet may be approved separately from the job/tour payout release.

That can be legitimate, but the UX currently makes both concepts look like variants of “approval”.

**Target wording:**

- **Timesheet review**: “Are these worked hours accepted?”
- **Payout release**: “Is this financial result ready to expose/settle?”

Do not call both simply “approved” without context.

### 8.3 Job and tour rate management

Tour finance can edit global base rates and technician-specific rates while also operating a specific tour/date.

**Target:** configuration changes should live under Rates & Policies. Tour Finance may link to them or offer an explicit “edit underlying policy” action, but should not casually mix scopes.

### 8.4 Extras

Extras are editable from multiple contexts and immediately affect calculations.

**Target:** keep one reusable editor, but make its lifecycle owner the Job Finance revision. Tour Finance should drill into the relevant job/date revision.

### 8.5 Expenses

The job-local panel and the global expenses page both approve/reject expenses.

That duplication is reasonable if both call the same command and communicate context clearly.

- **Job Finance:** “What happened on this job?”
- **Expense Queue:** “What requires review across the company?”

### 8.6 Payout communication

PDF/email actions appear in job and tour financial views.

**Target:** generation and sending should consume the same approved financial revision. Different presentation surfaces are acceptable, different financial assembly logic is not.

### 8.7 Invoice tracking

Invoice receipt currently lives in the payouts-due workflow while payout totals live elsewhere.

**Target:** invoice state belongs to settlement, with job/technician drill-downs showing the same state read-only or linking to the settlement action.

---

## 9. Proposed target information architecture

The goal is **five coherent surfaces**, not necessarily five routes on day one.

### 9.1 Rates & Policies

**Primary user:** management/admin  
**Purpose:** reusable configuration only.

Contains:

- base rate catalogs,
- tour base rates,
- extras catalog,
- multiplier/policy configuration,
- technician-specific internal/custom rates,
- travel/overtime policy defaults.

Explicitly does **not** contain:

- timesheet approval,
- job payout release,
- settlement queues,
- invoice receipt,
- job-specific extras.

Likely evolution of current `/management/rates`.

### 9.2 Job Finance

**Primary user:** management responsible for a job  
**Purpose:** authoritative operational financial view of one job.

Proposed sections:

1. **Summary**
   - current calculated total,
   - personnel cost,
   - approved expenses,
   - unresolved/pending financial items,
   - current financial revision state.

2. **Personnel**
   - technician payout breakdown,
   - timesheet state,
   - extras,
   - rate/date modes,
   - payout override,
   - calculation derivation.

3. **Expenses**
   - submitted/approved expenses,
   - permissions/caps,
   - receipts.

4. **Approval / Revision**
   - issues blocking release,
   - current revision,
   - approval/release history,
   - explicit re-open/new-revision workflow.

5. **Documents / Communications**
   - payout PDF,
   - technician payout email,
   - future finance exports.

Existing components can be reused while their ownership is gradually consolidated.

### 9.3 Tour Finance

**Primary user:** tour/management operator  
**Purpose:** aggregate jobs/dates and expose exceptions.

Contains:

- tour-level summary,
- date-by-date financial state,
- technician totals across the tour,
- unresolved dates,
- links/drill-down into Job Finance,
- tour-level export,
- tour-level release if that remains a business requirement.

Tour Finance should **not** reimplement the job calculator.

A tour date should use the same financial primitives/revisions as any other job.

### 9.4 Settlements

**Primary user:** finance/management  
**Purpose:** cross-job payment operations.

Evolution of `PayoutsDueFortnights`.

Contains:

- approved payouts awaiting settlement,
- employee/freelancer distinction,
- invoice required / received,
- payment due estimate,
- payment grouping/batches,
- future payment status,
- export/reporting.

The current “Pagos quincena” page is already most of the way toward this concept.

### 9.5 My Money

**Primary user:** technician / house tech  
**Purpose:** one coherent financial self-service view.

Contains:

- timesheets requiring action,
- expense submissions,
- pending review,
- approved payout by job/tour,
- invoice requirement/status where applicable,
- estimated payment state,
- historical settled items once payment tracking exists.

This is a conceptual target. It may initially remain distributed across job/timesheet screens while backend lifecycle states are formalized.

---

## 10. Proposed navigation

### Management

```text
Finance
├── Job / Tour Finance     contextual, primarily entered from jobs/tours
├── Rates & Policies       reusable configuration
├── Expense Queue          global review queue
└── Settlements            invoices / due / payment workflow
```

Job and Tour Finance do not necessarily need permanent global navigation entries. Contextual entry from a job/tour is likely clearer.

### Technician

```text
My Money
├── Needs action
├── Pending
├── Approved
├── Expenses
└── History
```

The exact navigation should wait until lifecycle research establishes what can actually be represented reliably.

---

## 11. Proposed state language

One major UX problem is overloaded terminology.

The target vocabulary should distinguish:

### Work record state

- Draft
- Submitted
- Approved
- Rejected

Used for timesheets/expenses.

### Financial calculation state

- Draft calculation
- Has issues
- Ready for review
- Approved revision
- Superseded revision

Used for derived money.

### Settlement state

- Not applicable
- Invoice required
- Awaiting invoice
- Invoice received
- Scheduled / due
- Paid

Used after financial approval.

A single badge reading “Approved” should never force the operator to guess which of these three state machines it refers to.

---

## 12. Approval should become a visible boundary

Current UX often treats approval as a visibility switch around a live calculation.

The architectural target should let UX express a stronger model:

```text
Facts + policy
      ↓
calculation revision
      ↓
manager review
      ↓
approved financial revision
      ↓
settlement
```

If an approved result must change:

```text
approved revision 3
      ↓ change detected / explicit reopen
draft revision 4
      ↓ review
approved revision 4
```

The UI can then say:

```text
€1,284.50
Approved · Rev 3 · 18 Sep 2026
```

instead of relying on several booleans and live inputs whose relationship the operator has to remember.

This document does **not** prescribe the database implementation of revisions. Phase 0 domain research should determine that.

---

## 13. Phase 0 surface research checklist

Before deleting or merging any surface, collect evidence from the production-shaped local dataset and code paths.

For each current surface record:

- intended persona,
- actual authorization,
- entry points,
- reads,
- writes,
- RPCs/functions called,
- financial state changed,
- whether the action is global policy or job-local,
- whether the result is persisted or dynamically calculated,
- downstream consumers,
- export/email side effects,
- whether another surface performs the same action,
- whether production data shows the action is actually used.

### Candidate surfaces to inventory first

- `RatesCenterPage`
- `RatesApprovalsTable`
- `HouseTechOverridesPanel`
- `CatalogEditors`
- `Timesheets`
- `JobDetailsDialog`
- `EnhancedJobDetailsModal`
- `JobPayoutTotalsPanel`
- `JobExtrasManagement`
- `JobExtrasEditor`
- `JobExpensesPanel`
- `Expenses`
- `TourRatesManagerDialog`
- `TourRatesPanel`
- `PayoutsDueFortnights`
- `MyJobTotal`
- technician timesheet/expense views
- job/tour payout PDF and email actions

---

## 14. Consolidation decisions that can probably be made already

These are low-risk UX-direction conclusions from the current source layout. They are not instructions to delete code yet.

### Keep as concepts

- Rates & Policies
- Job Finance
- Tour Finance
- Expense Queue
- Settlements
- Technician self-service

### Merge/reframe

- Rates Center “Aprobaciones” → Job/Tour Finance operational queues/drill-downs.
- Rates Center “Partes de horas” → Timesheet/work-record operations, not rate configuration.
- “Pagos quincena” → Settlements.
- Tour Rates Manager → Tour Finance shell that drills into job/date finance.
- Job payout, extras and expense components → sections of Job Finance.

### Likely retire as independent authorities

Any duplicate control that directly performs:

- job/tour payout release,
- technician payout approval,
- payout override,
- global rate editing from job/tour context,

should eventually call one domain command and render one shared interaction pattern.

The component may remain in multiple contexts; the business transition must not.

---

## 15. What not to do

Phase 0 should explicitly avoid these traps:

### Do not redesign from screenshots alone

The current data and functions contain rules that are not obvious from UI labels.

### Do not collapse distinct workflows just because they all contain euro signs

Configuration, approval and settlement have different owners and failure modes.

### Do not delete alternate surfaces before measuring usage and dependencies

Some apparently duplicated screens may serve different organizational roles.

### Do not make the new UI depend on today's table layout

The domain architecture is expected to change.

### Do not let a UX consolidation silently change money

The production-shaped local clone should allow old and new paths to run side-by-side against the same historical corpus.

---

## 16. Suggested implementation sequence after Phase 0

This is intentionally downstream of the domain/behavior audit.

1. Establish canonical financial commands/read models.
2. Introduce financial revision/snapshot semantics where required.
3. Build a Job Finance shell around existing components.
4. Move job-local financial actions into that shell.
5. Reframe the current Rates Center as configuration-only.
6. Reframe Payouts Due as Settlements.
7. Make Tour Finance aggregate/drill into job finance rather than duplicate it.
8. Unify technician financial state under a My Money journey.
9. Delete obsolete entry points only after telemetry/tests prove they are redundant.

---

## 17. Success criteria

Finance UX consolidation is successful when:

- a manager can answer **“what does this job cost and why?”** from one job surface;
- a manager can answer **“what still needs financial review?”** without opening several unrelated dialogs;
- changing a reusable rate is visibly different from overriding one job/date;
- approval/release is one explicit domain transition regardless of where the control is rendered;
- a released amount has a clear revision/history;
- settlement/invoice state is not mixed with rate configuration;
- a technician can understand what they submitted, what was approved and what remains payable without knowing internal implementation concepts;
- PDF/email/reporting consume the same approved financial result shown in the UI.

---

## 18. Relationship to the Finance Phase 0 data audit

This UX map should be validated against the production-shaped local Supabase clone.

The local corpus should tell us:

- which current surfaces correspond to real workflows,
- which controls are effectively dead,
- which rule combinations occur in practice,
- where approved/released values later changed,
- which exceptions operators actually use,
- which proposed consolidated views need first-class support.

The UX architecture and the financial domain architecture should converge together.

The current application is not being treated as a failed design. It is the **rule-complete prototype and usage record** from which the next architecture is derived.
