import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listActivity } from '@/features/activity/api';
import { getActivityMeta } from '@/features/activity/catalog';

export default function ActivityCenter() {
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['activity', 'all'],
    queryFn: () => listActivity({ limit: 50 }),
  });

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Activity</h1>
        <button className="text-sm underline" onClick={() => refetch()}>Refresh</button>
      </div>
      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error && <div className="text-red-600 text-sm">Failed to load activity</div>}
      <div className="space-y-2">
        {data.map((row: any) => {
          const meta = getActivityMeta(row.code);
          return (
            <div key={row.id} className="border rounded-md p-3">
              <div className="text-sm font-medium">{meta?.label || row.code}</div>
              <div className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</div>
              {row.payload && (
                <pre className="text-xs mt-2 bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(row.payload, null, 2)}</pre>
              )}
            </div>
          );
        })}
        {data.length === 0 && !isLoading && (
          <div className="text-muted-foreground">No recent activity.</div>
        )}
      </div>
    </div>
  );
}

