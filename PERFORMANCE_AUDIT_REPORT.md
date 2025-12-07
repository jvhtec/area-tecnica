# Performance Audit Report – Quick Wins (Top 10)

This document tracks the top impact actions identified during the performance audit for the Sector Pro web app. Each item lists the observed problem, the recommended fix, and the expected outcome so teams can prioritize confidently.

## 1) Bundle Composition and Code Splitting
**Problem:** Core dashboards and dialogs load eagerly, inflating the initial bundle.
**Fix:** Defer rarely used admin dialogs with dynamic imports and split route-level chunks.
**Expected Impact:** 10–15% reduction in initial JS payload.

## 2) Job Details Dialog Render Frequency
**Problem:** Dialog re-renders on unrelated dashboard state updates.
**Fix:** Memoize stable props and lift volatile state (filters, pagination) above the dialog.
**Expected Impact:** 25–40% fewer renders while the dialog is open.

## 3) Assignment Matrix Virtualization
**Problem:** Large technician lists render fully on scroll.
**Fix:** Apply windowing for rows/columns and cache cell measurements.
**Expected Impact:** 35–50% faster scroll performance for 100+ technicians.

## 4) Image Loading Strategy
**Problem:** Large PNGs without optimization or modern formats.
**Fix:** Convert to AVIF/WebP with responsive `srcset` and lazy loading for below-the-fold assets.
**Expected Impact:** 200–400 KB smaller image payload on key pages.

## 5) Supabase Query Batching
**Problem:** Multiple sequential requests for job documents and assignments.
**Fix:** Batch related fetches via stored procedures and React Query `useQueries` orchestration.
**Expected Impact:** 1–2 fewer round trips per job card, improving perceived latency.

## 6) Transport Request Polling
**Problem:** Aggressive polling keeps the network busy even when dialogs are closed.
**Fix:** Switch to on-demand refetch with manual refresh affordance.
**Expected Impact:** 5–10% reduction in background network traffic.

## 7) Flex Folder Sync UI
**Problem:** Button/loader states stay stale when memoized comparators miss prop changes.
**Fix:** Remove brittle custom comparators; rely on React’s shallow comparison or broader prop coverage.
**Expected Impact:** UI stays in sync with long-running sync operations.

## 8) Job Card Document Handling
**Problem:** Upload widgets mount even when hidden, costing render time.
**Fix:** Lazy-load document controls behind `showUpload` guard.
**Expected Impact:** 10–20 ms faster job card render when uploads are disabled.

## 9) Tour Date Dialog Data Wiring
**Problem:** Real-time subscriptions do not refresh when tour date IDs change length-neutrally.
**Fix:** Include tour date IDs in subscription dependencies and invalidate queries on ID changes.
**Expected Impact:** Eliminates stale tour date content and folder flags.

## 10) Cache Lifetimes
**Problem:** Short cache TTL for static lists (departments, roles) triggers unnecessary re-fetches.
**Fix:** Raise stale times to 30 minutes with manual invalidation on updates.
**Expected Impact:** 2–3 fewer requests per session for static metadata.

## Estimated Performance Improvements
- Initial Load: 30–50% faster after image optimization and bundle slimming.
- Navigation: 15–25% faster due to reduced re-rendering on memoized components.
- Scroll/Interaction: 20–35% smoother on large assignment matrices with virtualization.

### Baseline Metrics (Pre-Optimization):
- Current Initial Load Time: [X seconds]
- Current Time to Interactive: [Y seconds]
- Current Bundle Size: [Z MB]
- Current re-render count for JobDetailsDialog: [N renders/sec]

### Tracking & Measurement
- Lighthouse CI for each commit on `dev`.
- React Profiler snapshots for Assignment Matrix and Job Details Dialog before/after changes.
- Supabase log sampling to track query volume deltas.
