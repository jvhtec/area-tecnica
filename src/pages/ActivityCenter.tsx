import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listActivity } from '@/features/activity/api';
import { getActivityMeta } from '@/features/activity/catalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ActivityCenter() {
  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['activity', 'all'],
    queryFn: () => listActivity({ limit: 50 }),
  });
  const isMobile = useIsMobile();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Sticky header on mobile */}
      <div className={`${isMobile ? 'sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4' : ''}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Activity Center</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Loading state with skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6 text-center">
            <div className="text-destructive text-sm font-medium">Failed to load activity</div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity list - optimized for vertical scrolling */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {data.map((row: any) => {
            const meta = getActivityMeta(row.code);
            return (
              <Card key={row.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium flex-1">{meta?.label || row.code}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>
                    {row.payload && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(row.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {data.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-muted-foreground">No recent activity.</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

