# Jobs Hooks Migration Note (2026-03-20)

## What changed

The following legacy hooks were removed:

- `useJobs`
- `useOptimizedJobs`
- `useJobsRealtime`

They were replaced by one canonical hook:

- `useJobsData` (`src/hooks/useJobsData.ts`)

## Why

`useJobsData` centralizes:

- query key generation with normalized filter shape
- Supabase jobs fetching and shared filtering
- realtime updates and cache merging
- retry/loading/error behavior

This avoids duplicate React Query cache entries and hook drift.

## New API

```ts
const jobsQuery = useJobsData({
  department: 'sound',
  startDate,
  endDate,
  includeDryhire: true,
  realtime: true,
  refetchOnMount: 'always',
});
```

Returned fields include:

- `data` (array)
- `jobs` (alias of `data` for compatibility)
- `isLoading`
- `isError`
- `error`
- `isRefreshing`
- `isPaused`
- `refetch`
- `realtimeStatus`

## Migration examples

### Before

```ts
const { data } = useOptimizedJobs(department, startDate, endDate);
const { jobs, realtimeStatus } = useJobsRealtime();
const { data } = useJobs();
```

### After

```ts
const { data } = useJobsData({ department, startDate, endDate });
const { jobs, realtimeStatus, isPaused } = useJobsData({ realtime: true });
const { data } = useJobsData();
```

When swapping legacy jobs hooks over to `useJobsData`, update the related cache namespace too.

- Replace the removed legacy jobs cache namespace and old `["jobs"]`-only invalidations when they were targeting the removed hooks.
- Update `useTabVisibility(...)`, route-level query key overrides, and realtime subscription wiring to point at the canonical `["jobs-data"]` namespace.
- Keep `["jobs"]` invalidations only for screens that still maintain the legacy list cache alongside `useJobsData`.
