# Rates & Extras Centralization Plan

## 1. Current landscape audit

### 1.1 UI touchpoints
- **Tour-specific management dialog** – `TourRatesManagerDialog` combines job selection, approval toggles, extras editing (via `JobExtrasEditor`), and base-rate tabs inside a modal that only opens from tour context. The modal orchestrates disparate queries for jobs, assignments, profiles, and extras without persistent navigation or cross-tour visibility.【F:src/components/tours/TourRatesManagerDialog.tsx†L30-L200】
- **House tech override editor** – The settings page component focuses solely on per-profile overrides, replicating contextual data (default category rates) and save flows that overlap with tour editing but live elsewhere in the product hierarchy.【F:src/components/settings/HouseTechRateEditor.tsx†L25-L198】
- **Tour job rates panel (read only)** – A job-level panel visualises quotes per assignment, but the heavy lifting for editing, approvals, and extras happens outside of this surface, reinforcing the fragmentation between overview and configuration.【F:src/components/tours/TourRatesPanel.tsx†L17-L200】
- **Job extras editor** – Managers edit extras inside each technician card; the same component powers both manager and technician views, mixing approval-related logic with day-to-day data entry.【F:src/components/jobs/JobExtrasEditor.tsx†L28-L200】

### 1.2 Hooks & data sources
- **Rate catalogs & overrides** – Multiple hooks hit separate Supabase tables/views for base tour rates, extras amounts, and house-tech overrides (`rate_cards_tour_2025`, `rate_extras_2025`, `house_tech_rates`). Each hook manages its own cache keys, invalidations, and toasts, with little shared infrastructure.【F:src/hooks/useTourBaseRates.ts†L12-L48】【F:src/hooks/useRateExtrasCatalog.ts†L10-L46】【F:src/hooks/useHouseTechRates.ts†L22-L85】
- **Approvals & quotes** – Manager flows fetch approval state and compute quotes per job/tour using bespoke hooks; technicians consume different hooks scoped to their assignments, duplicating grouping logic client-side.【F:src/hooks/useTourRatesApproval.ts†L5-L37】【F:src/hooks/useTourJobRateQuotesForManager.ts†L9-L98】【F:src/hooks/useJobExtras.ts†L6-L114】

### 1.3 Database primitives
- Rate tables for 2025 (base tiers, extras catalog, per-profile overrides) already exist with RLS rules that restrict writes to managers, but there is no unified API layer that exposes them together.【F:supabase/migrations/20250917082106_6c478d6d-5e51-499f-ace7-7e99a1ff1853.sql†L3-L118】【F:supabase/migrations/20250920151521_ec9eb57c-334c-4f96-aa82-c883e3bb7fcf.sql†L3-L19】【F:supabase/migrations/20250920091546_6ee5e3f2-53ad-4af3-b3b6-6657b2062716.sql†L1-L143】

## 2. Pain points & risks
1. **Modal-only workflow** – Managers must jump into a tour modal to make changes, lacking global context (e.g., comparing rates across tours or confirming default catalogs before approving).
2. **Redundant data fetches** – Each hook independently loads profiles, rate cards, and extras, increasing Supabase round-trips and creating cache invalidation complexity when a change should fan out to many surfaces.
3. **Approval ambiguity** – Approval toggles live inside the modal, but technicians see status elsewhere; there is no consolidated audit trail tying approvals, rate edits, and extras adjustments together.
4. **Fragmented editing controls** – Extras, base rate defaults, and house overrides use different UI patterns; managers must learn multiple micro-flows to accomplish related tasks.
5. **Limited bulk operations** – Managers cannot view multi-tour data, duplicate settings, or apply changes in bulk; everything is per-tour/per-technician.

## 3. UX centralization vision
Create a dedicated **Rates & Extras Center** accessible from the management settings navigation. The page becomes the authoritative hub for configuring defaults, overrides, and approvals across tours, jobs, and profiles.

### 3.1 Page scaffolding
1. **Global header** – Summaries of pending approvals, recently edited items, and quick actions (e.g., "Approve next tour", "Review extras catalog").
2. **Tabs/sections** (persistent, not modal):
   - **Rate Catalogs** – Edit base tour categories and extras in a side-by-side layout; re-use forms from current modal but surface them simultaneously for quicker cross-referencing. Add inline history badges sourced from activity log.
   - **House Tech Overrides** – Searchable list of technicians with inline editing drawers using the existing `HouseTechRateEditor`, but now embedded with category context and differential indicators (default vs override).
   - **Tour & Job Approvals** – Table summarizing tours/jobs, approval status, total assignments, and blockers (e.g., missing categories or extras). Allow inline actions to open detailed drawers.
   - **Assignment Drill-down** – Dedicated panel (drawer or right-side inspector) showing the current `TourRatesManagerDialog` content but in-page, enabling persistent navigation.

3. **Contextual drawers** – Instead of modals, open drawers for granular edits (e.g., editing extras for a single job). They inherit shared toolbars (approve, revoke, log) for consistency.

### 3.2 Interaction workflows
- **Setting default rates** – Managers adjust tour category rates and extras on one screen; saves trigger consolidated mutation handlers that optimistically update caches for dependent sections (e.g., approvals list).
- **Managing overrides** – From the overrides tab, managers can filter by discrepancy (override vs default). Editing uses a shared drawer component with side-by-side comparison of default vs override values, reducing context switching.
- **Approving tours/jobs** – Approval table surfaces computed readiness states (e.g., missing house rate). Tapping a row opens the assignment drill-down with aggregated warnings from quote breakdowns. Approvals log actions in the global activity feed.
- **Bulk operations** – Provide checkboxes in the approval table to approve/revoke multiple items, optionally with a confirmation dialog summarizing changes.

### 3.3 Visual design considerations
- Use consistent iconography (Euro badge, shield for approval) already established in existing components to maintain familiarity.【F:src/components/tours/TourRatesManagerDialog.tsx†L124-L167】
- Adopt responsive two-column layout for large screens (catalogs/overrides left, detail inspector right) and stacked sections on mobile.
- Introduce status chips (e.g., "Override", "Missing category", "Extras pending") that read from the same data map powering warnings today.【F:src/components/tours/TourRatesPanel.tsx†L156-L200】

## 4. Data & architecture alignment

### 4.1 Consolidated data service
- Build a **RatesService** module that composes existing queries (rate cards, extras, house overrides, approvals) and exposes typed fetchers/mutations. This reduces repeated Supabase wiring scattered in hooks.【F:src/hooks/useTourBaseRates.ts†L12-L48】【F:src/hooks/useRateExtrasCatalog.ts†L10-L46】【F:src/hooks/useHouseTechRates.ts†L22-L85】
- Provide batched endpoints via Supabase RPC (e.g., `management_fetch_rates_context`) returning combined payloads (tour info + quotes + extras), minimizing sequential queries currently issued in the modal.【F:src/components/tours/TourRatesManagerDialog.tsx†L30-L200】

### 4.2 Cache invalidation strategy
- Centralize React Query keys under a `rates` namespace, enabling broad invalidation when base catalogs change instead of manually listing keys across hooks.【F:src/hooks/useJobExtras.ts†L47-L105】
- When creating the RatesService, export helper functions (`invalidateRatesContext`) that sections call after mutations, ensuring extras, quotes, and approvals refresh together.

### 4.3 Activity & audit integration
- Leverage existing activity log RPC used for house tech edits to capture base rate and extras changes as well; extend the log payload with entity type metadata for a cohesive timeline.【F:src/hooks/useHouseTechRates.ts†L70-L85】
- Surface this audit trail in the Rates Center header to give managers immediate feedback on recent adjustments.

### 4.4 Authorization guardrails
- Keep RLS policies unchanged but encapsulate permission checks client-side by gating Rates Center routes for `management`/`admin` roles only; fall back to readonly tables for others, reusing the read policies in `rate_extras_2025` and `house_tech_rates` for safe data display.【F:supabase/migrations/20250920151521_ec9eb57c-334c-4f96-aa82-c883e3bb7fcf.sql†L3-L19】【F:supabase/migrations/20250920091546_6ee5e3f2-53ad-4af3-b3b6-6657b2062716.sql†L1-L27】

## 5. Implementation roadmap

### Phase 1 – Foundation
1. Introduce the RatesService module with consolidated fetchers/mutations and shared React Query keys.
2. Create management-only `RatesCenterPage` route with placeholder tabs (catalogs, overrides, approvals).
3. Migrate existing modal forms (base rates, extras) into dedicated tab panels using existing components.

### Phase 2 – Approvals & drill-downs
1. Build approval summary table sourcing quotes/flags from new batched RPC.
2. Replace modal with in-page drawer that leverages current `TourRatesManagerDialog` internals refactored into smaller child components (job selector, extras editor, approval toolbar).
3. Add bulk approve/revoke actions and ensure audit logging covers each action.

### Phase 3 – Enhancements & polish
1. Add discrepancy filters (e.g., show technicians missing overrides) and diff badges (default vs override values).
2. Surface aggregated analytics (total extras per tour, average rate per category) using existing quote breakdowns.【F:src/components/tours/TourRatesPanel.tsx†L153-L200】
3. Implement success/error toasts and activity feed panel to deliver immediate feedback on configuration changes.【F:src/hooks/useRateExtrasCatalog.ts†L37-L44】【F:src/hooks/useHouseTechRates.ts†L59-L66】

## 6. Success metrics
- **Operational efficiency** – Reduced time for managers to approve a full tour (measured via usability testing) compared to modal workflow.
- **Data consistency** – Lower incidence of missing overrides or extras mismatches flagged by quote breakdown errors.【F:src/components/tours/TourRatesPanel.tsx†L195-L200】
- **System load** – Fewer Supabase requests per approval session thanks to batched service layer.

---
With this plan, the rates ecosystem gains a single navigable hub, consistent editing patterns, and a data layer ready for future expansions (e.g., 2026 catalogs, region-specific extras). Managers retain the depth of current tooling while eliminating the fragmentation that slows them down today.
