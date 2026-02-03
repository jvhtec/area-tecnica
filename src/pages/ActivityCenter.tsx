import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listActivity } from '@/features/activity/api';
import { getActivityMeta } from '@/features/activity/catalog';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/utils/roleBasedRouting';

/**
 * Render the activity center UI for admin and management users, showing recent events, loading/error states, and a refresh control.
 *
 * @returns The component's JSX: a full-screen authorization spinner while authentication is loading; the activity dashboard (title, refresh button, list of activity items with timestamps and optional payloads) when the userRole is 'admin' or 'management'; `null` when the user is unauthorized or no role is present.
 */
export default function ActivityCenter() {
  const navigate = useNavigate();
  const { userRole, isLoading: authLoading } = useAuth();

  // Early security check: Only allow admin, management
  useEffect(() => {
    if (authLoading) return;

    if (userRole && !['admin', 'management'].includes(userRole)) {
      const redirectPath = getDashboardPath(userRole as any);
      navigate(redirectPath, { replace: true });
    }
  }, [userRole, authLoading, navigate]);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['activity', 'all'],
    queryFn: () => listActivity({ limit: 50 }),
  });

  // Show loading state while checking authorization
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  // Don't render anything if user is unauthorized
  if (!userRole || !['admin', 'management'].includes(userRole)) {
    return null;
  }

  return (
    <div className="space-y-6">
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