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
const { jobs, realtimeStatus } = useJobsData({ realtime: true });
const { data } = useJobsData();
```
