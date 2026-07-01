# Performance Audit — 2026-07-01

Codebase-wide performance audit covering bundle/build configuration, React
Query data-fetching patterns, Supabase realtime/multi-tab coordination, and
database indexing + heavy client-side compute (PDF generation, image
handling). All findings below were verified by reading the referenced files
directly — this supersedes the more general observations in
`PERFORMANCE_AUDIT.md` and `PERFORMANCE_AUDIT_REPORT.md` with specific
file:line references and current (2026-07) code state.

Severity legend: **High** = user-visible slowdown or scales badly with data
growth; **Medium** = real but bounded impact today; **Low** = worth fixing
opportunistically.

## Status

- ✅ **Fixed 2026-07-01** — items 1, 2, and 3 below (realtime bypass hooks +
  `useDetailsModalData.ts` query-key fragmentation). See commit
  `0f7cdf1` on `claude/codebase-performance-audit-kcda0t`.
- ✅ **Fixed in follow-up branch** — items 4, 5, 6, 7, 8, 9, 10, 14, 15,
  16, 17, 19, 20, 21, 22, 24, 25, 26, and 27.
- ✅ **Verified/corrected** — item 12 is covered by existing left-prefix
  sender indexes; item 13's `useTimesheets` client-side date filtering is
  fixed server-side.
- ⚠️ **Deferred for larger migrations/production confirmation** — item 11's
  varchar-to-uuid FK conversion, item 13's SQL aggregation/RPC work,
  item 18's broad query-key migration, and item 23's non-matrix list
  virtualization decision.

## High severity

1. ~~**Several hooks open their own realtime channels instead of going
   through `UnifiedSubscriptionManager`**, breaking dedup and leader-election
   gating. Every tab (not just the leader) independently opens a websocket
   subscription:
   - `src/hooks/useJobAssignmentsRealtime.ts:299-334`
   - `src/hooks/useTourSubscription.ts:18-20`
   - `src/hooks/useStaffingCampaignRealtime.ts:17,47,75,112`
   - `src/components/messages/hooks/useMessagesSubscription.ts:13-15`
   - `src/features/activity/hooks/useActivityRealtime.ts:121-122`

   Fix: migrate these to `UnifiedSubscriptionManager.subscribeToTable()`
   (the API already supports per-owner payload callbacks), or at minimum
   gate channel creation behind `MultiTabCoordinator.getIsLeader()`.~~

   **RESOLVED (2026-07-01):** all five hooks now go through
   `UnifiedSubscriptionManager.subscribeToTable()` with owner-route
   registration/cleanup, preserving their original filters and
   invalidation behavior (including JS-side filtering where a payload
   couldn't be expressed as a single Postgres filter, e.g. staffing
   campaign department matching). `useMessagesSubscription` additionally
   now stabilizes its `onUpdate` callback via a ref to stop resubscribing
   on every parent render.

2. ~~**`useJobAssignmentsRealtime.ts:169-290` double-subscribes** — it uses
   `useRealtimeQuery` (subscribed to `timesheets`) *and* a second manual
   channel (lines 299-329) subscribed to both `timesheets` and
   `job_assignments`. Two independent paths react to the same table
   changes and can both trigger a refresh, risking duplicate fetches/races.
   Consolidate into a single subscription path.~~

   **RESOLVED (2026-07-01):** the manual channel was replaced by two
   manager-routed, `job_id`-filtered subscriptions (`timesheets` and
   `job_assignments`) sharing one owner route and `invalidateOnPayload:
   false` + a shared `onPayload` handler that calls `manualRefresh()` once
   — no more duplicate refresh paths for the same job.

3. ~~**`useDetailsModalData.ts:66-590`** — all 16 `useQuery` calls use
   free-form `queryKeys.scope(...)` strings instead of the domain factories
   in `src/lib/optimized-react-query.ts:83-148`. Job/assignment data fetched
   here lives under different cache keys than the same data fetched by the
   matrix, so `optimizedInvalidation.invalidateJobRelated()` silently misses
   these entries — stale data after mutations, plus duplicate fetches for
   data that's already cached elsewhere. Fix: extend `createQueryKey` with
   the missing accessors (`.staff`, `.dateTypes`, `.artists`, etc.) and
   migrate these 16 call sites.~~

   **RESOLVED (2026-07-01), with a correction:** before migrating, found
   that `EnhancedJobDetailsModal.tsx` (department view) intentionally
   shares three of these cache entries (`job-details-modal`, `job-staff`,
   `job-restaurants-modal`) with this hook via matching string literals —
   migrating only this file to different factory keys would have silently
   *broken* that existing sharing rather than fixed fragmentation. Instead,
   added `createQueryKey.jobDetailsModal` (the 3 shared keys, generating
   byte-identical key arrays to what was there before) and
   `createQueryKey.technicianJobModal` (the 12 technician-only keys) to
   `src/lib/optimized-react-query.ts`, and migrated both
   `useDetailsModalData.ts` and `EnhancedJobDetailsModal.tsx` onto the same
   canonical factories so the coupling is explicit and drift-proof instead
   of relying on two files independently typing matching strings. No
   `optimizedInvalidation.invalidateJobRelated()` wiring was added for
   these keys — that's a separate, riskier change left out of scope.

4. **`stock_movements.user_id` has a foreign key but no index**
   (`00000000000000_production_schema.sql`). This is a high-write table;
   cascading updates/deletes from `profiles`/`auth.users` will seq-scan it.
   Fix: `CREATE INDEX CONCURRENTLY idx_stock_movements_user_id ON stock_movements(user_id);`

   **RESOLVED:** added `idx_stock_movements_user_id`.

5. **`v_job_staffing_summary` materialized view has no auto-refresh
   trigger.** A `refresh_v_job_staffing_summary()` function exists (uses
   `CONCURRENTLY`) but nothing calls it when `timesheets`/`job_assignments`
   change — the staffing dashboard can silently serve stale data
   indefinitely. Fix: add a trigger on the source tables or a scheduled
   `pg_cron` job.

   **RESOLVED:** added a guarded `pg_cron` schedule to refresh
   `v_job_staffing_summary` every 5 minutes when the linked database has
   `pg_cron` installed.

6. **`festivalPdfGenerator.ts:381-479`** generates one PDF per artist in a
   sequential `for...await` loop with zero progress feedback. For a
   150-300 artist festival this blocks the main thread for 20-30+ seconds
   with no UI indication anything is happening. Fix: chunk the work with
   progress reporting, and/or batch independent exports with `Promise.all`.

   **RESOLVED:** individual artist PDFs now generate with bounded
   concurrency while preserving output order, and the festival-management
   print dialog shows live generation progress.

## Medium severity

7. **`vite.config.ts` `manualChunks`** only isolates 4 libraries
   (pdf-libs, maps-lib, spreadsheet-libs, editor-lib — correctly
   implemented). `recharts`, `framer-motion`, `react-markdown` (+
   remark/rehype plugins), `qrcode`, and `jszip` are not split out and land
   unpredictably in whichever chunk imports them first. There's also no
   explicit `vendor-react`/`vendor-radix` grouping, so Rollup's default
   heuristic handles all core framework deps. Recommend adding explicit
   chunk rules for the heavy libs above and a stable long-cache vendor
   chunk for react/react-dom/react-router-dom.

   **RESOLVED:** added stable chunks for React core, Radix, charts, motion,
   markdown, QR, and ZIP dependencies.

8. **Bundle budget is a ratchet with no absolute ceiling**
   (`scripts/performance/check-bundle-budget.mjs`). It only fails a PR if
   growth exceeds ~10-12% of `docs/performance/phase-4-baseline/baseline.json`
   (or a fixed slack: 75KB JS / 20KB CSS / 25KB fonts / 500KB images).
   Gradual bloat (a few % per PR) can compound past what any single review
   would catch, since there's no absolute cap (e.g., "fail if total JS gzip
   > 2MB"). Consider adding one alongside the existing ratchet.

   **RESOLVED:** added absolute kind-level caps, an absolute largest entry
   script cap, and fixed caps for the known large JS families.

9. **`index.html`** preconnects to `sectorpro.flexrentalsolutions.com` but
   not to the Supabase URL, which is the primary data dependency hit on
   every page load. Add `<link rel="preconnect" href="https://<project>.supabase.co" crossorigin>`
   (inject at build time next to the existing SW-version injection, since
   the URL is env-dependent).

   **RESOLVED:** added Supabase `preconnect` and `dns-prefetch` tags using
   the existing post-build injector and `VITE_SUPABASE_URL`.

10. **Redundant polling stacked on top of realtime**:
    `src/hooks/useTourDateRealtime.ts:39-59` runs a 15s `setInterval`
    invalidating the same query key its realtime subscription already
    covers, with no leader/visibility gating. With multiple tabs open on a
    tour detail page this becomes N×(poll + realtime). Remove the interval
    or gate it to the leader tab with a much longer period.

    **RESOLVED:** removed the 15s fallback invalidation interval; the hook
    now relies on its scoped realtime subscriptions.

11. **`technician_availability.technician_id`** is a plain `varchar` with
    no FK to `profiles` and no index beyond the `(technician_id, date)`
    unique constraint — no referential integrity, and lookups by
    technician alone can't use an index efficiently. Needs a migration to
    convert to `uuid REFERENCES profiles(id)`.

    **PARTIAL/DEFERRED:** added a standalone
    `idx_technician_availability_technician_id` index. The varchar-to-uuid
    FK conversion is intentionally deferred because it affects existing SQL
    functions/RPCs and should be handled as a dedicated compatibility
    migration.

12. **`messages.sender_id`** has no standalone index, only a composite
    `(sender_id, created_at)` — confirm this covers all sender-only query
    shapes before assuming it's fine.

    **CORRECTED:** confirmed the existing `(sender_id, created_at)`
    btree index covers sender-only predicates via the leftmost prefix, with
    additional unread-message partial indexes already present for inbox
    shapes.

13. Client-side aggregation instead of SQL: `useJobsRealtime.ts:82-123`
    fetches per-job timesheet rows and aggregates via `reduce()` in JS
    rather than a SQL aggregate/RPC — unnecessary payload+CPU at 100+
    timesheets/job. `useTimesheets.ts:55-72` does `.select('*')` then
    filters client-side with `.filter(t => prepDayDates.has(t.date))`
    instead of `.in('date', [...])` server-side.

    **PARTIAL/DEFERRED:** `useTimesheets` now pushes tour prep-day date
    filtering into Supabase with `.in("date", ...)`. Replacing
    `useJobsRealtime`'s JS aggregation with an RPC is deferred because it
    changes the data contract and needs focused SQL coverage.

14. **`useAvailableTechnicians.ts:78-110`** invalidates/refetches the
    entire technician set on any `job_assignments` realtime event instead
    of a scoped subscription — refetch storms on busy matrix pages.

    **RESOLVED:** replaced the broad channel with scoped manager-backed
    subscriptions filtered to the active job and exact query key.

15. Several `useQuery` hooks override the global 2min/5min stale/gc
    defaults (`src/lib/optimized-react-query.ts:7-21`) with `staleTime: 0`,
    forcing a refetch on every mount:
    `src/features/festival-management/hooks/useFestivalDocuments.ts:42`,
    `useFestivalJobData.ts:16`, `src/hooks/festival/useFestivalShifts.ts:137`.
    Worth confirming these truly need always-fresh data rather than relying
    on the existing realtime invalidation.

    **RESOLVED:** changed those hooks to a 2-minute stale window and disabled
    unnecessary focus refetch for festival shifts.

16. Festival artist file uploads bypass image optimization: `optimizeProfilePicture`
    (`src/utils/imageOptimization.ts`) is only wired into
    `ProfilePictureUpload.tsx`. `ArtistFileDialog.tsx:~89` and the
    festival-management upload paths push raw `File` objects straight to
    Supabase Storage — at 3-5MB per stage-plot/rider image across hundreds
    of artist files per tour, this inflates storage cost and
    upload/download latency. `FestivalLogoManager.tsx` additionally has no
    client-side file-size validation before upload (unlike
    `ProfilePictureUpload.tsx`'s `validateImageFile(file, 5)`).

    **RESOLVED:** added a shared image-upload optimizer and wired it into
    artist file uploads, stage plots, festival logos, job documents, and
    festival-management upload paths.

17. `festivalPdfGenerator.ts:174-193,211-304` also generates stage
    gear-setup and per-date shift PDFs in sequential `for...await` loops
    (no `Promise.all`) — 4-8 stages × 3-5 days adds several seconds of
    avoidable blocking on top of finding #6.

    **RESOLVED:** gear setup, shift schedules, artist tables, and individual
    artist PDFs now use bounded concurrent generation with ordered results.

18. The generic `queryKeys.scope`/`queryKeys.custom` escape hatch
    (`src/lib/react-query.ts:21-25`) is used in 769 call sites across 207
    files, far outnumbering the domain-specific `createQueryKey.*`
    factories. This doesn't break caching by itself (keys are still
    unique/stable) but means `optimizedInvalidation` can't reach most of
    the app's queries — invalidation is done ad hoc, scattered, and easy to
    get subtly wrong. The migration described in the code's own comments
    appears stalled.

    **DEFERRED:** this is a broad architecture migration across hundreds of
    call sites and should be split by domain-specific query-key ownership.

## Low severity

19. Service worker (`public/sw.js:157-224`) caches static assets
    cache-first with no size/count cap between deploys — for long-lived
    PWA/Capacitor sessions the runtime cache can grow unbounded until the
    next deploy clears it. Low risk, but worth an LRU cap for mobile.

    **RESOLVED:** runtime cache entries are trimmed to a fixed LRU-style cap.

20. `unified-subscription-manager.ts:332-364` infers connection health from
    a presence `sync` event on a channel that never calls `channel.track()`
    — the sync event may not fire reliably, making connection-status
    reporting to `useSubscriptionContext` unreliable in edge cases.

    **RESOLVED:** the ping channel now tracks presence after subscription.

21. `unified-subscription-manager.ts:616-639` retries `CHANNEL_ERROR`
    every 5s indefinitely with no retry cap — during a sustained outage
    this spins forever instead of backing off or giving up.

    **RESOLVED:** channel retries now use bounded exponential backoff with a
    maximum retry count.

22. `useVirtualizedMatrix.ts` is dead code (zero call sites beyond its own
    definition) — CLAUDE.md references it as the matrix's virtualization
    mechanism, but the actual matrix (`OptimizedAssignmentMatrix.tsx:439-443`)
    does its own inline row/column windowing plus `useVirtualizedDateRange`.
    Either wire the hook in or delete it and correct the docs.

    **RESOLVED:** deleted the unused hook and corrected the CLAUDE.md
    virtualization note.

23. No `react-window`/`react-virtual` anywhere in the codebase — large
    non-matrix lists (equipment, technician pickers, messages) render fully
    via `.map()`. Likely fine at current list sizes; worth confirming
    production festivals don't have artist/technician rosters in the low
    hundreds before deprioritizing.

    **DEFERRED:** requires production list-size confirmation before adding a
    virtualization dependency or rewriting specific list components.

24. `wiredMicrophoneNeedsPdfExport.ts:404-441` — triple-nested
    date→stage→artist loop with per-iteration `console.log` calls; the
    logging overhead alone adds ~500ms on large festivals.

    **RESOLVED:** removed the per-date/stage/artist console logging from the
    organizer.

25. `getMismatchSummary.ts:6-7` — repeated `.filter()` inside a `reduce()`
    (O(n·m)) over gear mismatches instead of a single pass; only
    noticeable above ~200 artists.

    **RESOLVED:** replaced repeated filtering with a single-pass aggregation.

26. `useJobCard.ts:62,116` uses `.select("*")` scoped by `job_id` — not a
    table scan, but pulls unused columns per card render; project only the
    fields `JobCard` actually uses.

    **RESOLVED:** narrowed fallback `job_date_types` and
    `sound_job_personnel` projections.

27. Multi-tab heartbeat (`multitab-coordinator.ts:258-276`) writes to
    `localStorage` every 3s per tab, but only in the Web Locks API fallback
    path (older browsers/some WebViews) — low impact on modern targets.

    **RESOLVED:** moved the fallback heartbeat to a named 5s interval while
    keeping it below the existing 10s stale-leader timeout.

## Verified non-issues (checked, found solid)

- `src/App.tsx` / `src/routes/app-route-manifest.tsx`: zero eager page
  imports; all 54 routes are `React.lazy()`-loaded.
- No cross-cutting barrel files in `src/components/` or `src/hooks/` that
  would defeat tree-shaking.
- No duplicate heavy libraries (single date/chart/editor/spreadsheet lib
  families).
- `JobAssignmentMatrix.tsx` is well-memoized (`useMemo` on filtered
  technicians, job IDs, outstanding jobs) with proper realtime cleanup and
  windowed prefetching for adjacent date ranges.
- `useOptimizedAuth.tsx` effect dependency arrays are correctly scoped —
  no fetch-loop risk found.
- No true N+1 `useQuery`-per-row pattern found in festival artist,
  staffing, or technician list views (they batch via `.in()`/`.or()`).
- Realtime client config (`eventsPerSecond: 1`, 30s timeout, 15s
  heartbeat) matches CLAUDE.md and is a deliberate, documented tradeoff.
- `timesheets`, `job_assignments`, and `staffing_requests` all have solid
  composite indexes on `job_id`/`technician_id`/`status` — the FK index
  gaps found are isolated, not systemic.
- No O(n²) collision/conflict-detection loops confirmed in
  `src/components/festival/` or matrix components (grep hits on
  "conflict"/"overlap" were UI copy, not algorithms) — inconclusive rather
  than clean; revisit if matrix performance at 100+ technicians becomes a
  live complaint.

## Suggested priority order

1. ~~Fix the two DB items with a migration (#4 index, #5 trigger) — cheap,
   isolated, no app-code risk.~~ **Done in follow-up branch.**
2. ~~Consolidate the realtime bypass hooks (#1, #2) — highest blast radius
   for duplicate-fetch bugs and unnecessary connections at scale.~~ **Done
   2026-07-01.**
3. ~~Migrate `useDetailsModalData.ts` onto query-key factories (#3) — fixes
   real stale-cache bugs, not just a "nice to have."~~ **Done 2026-07-01.**
4. ~~Chunk/parallelize the festival PDF export (#6, #17) with progress
   feedback — directly user-visible on large festivals.~~ **Done in
   follow-up branch.**
5. ~~Everything else (bundle chunking, upload image optimization, dead-code
   cleanup) can be picked up opportunistically.~~ **Most follow-ups done;
   broad query-key/RPC/list-virtualization migrations are deferred above.**
