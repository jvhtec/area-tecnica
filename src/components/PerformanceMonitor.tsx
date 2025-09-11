import React, { useState } from 'react';
import { useSubscriptionStats } from '@/hooks/useOptimizedRealtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Database, Zap } from 'lucide-react';

interface PerformanceMonitorProps {
  className?: string;
}

export function PerformanceMonitor({ className }: PerformanceMonitorProps) {
  const stats = useSubscriptionStats();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Determine status color based on performance
  const getStatusColor = () => {
    if (stats.circuitBreakerOpen) return 'destructive';
    if (stats.averageResponseTime > 2000) return 'warning';
    if (stats.failedConnections > 5) return 'warning';
    return 'success';
  };
  
  const getStatusIcon = () => {
    const status = getStatusColor();
    switch (status) {
      case 'destructive':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <Clock className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };
  
  const formatResponseTime = (time: number) => {
    return time > 1000 ? `${(time / 1000).toFixed(1)}s` : `${Math.round(time)}ms`;
  };
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Database Performance</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor() as any} className="text-xs">
              {getStatusIcon()}
              {stats.circuitBreakerOpen ? 'Circuit Open' : 
               stats.averageResponseTime > 2000 ? 'Slow' : 'Healthy'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? '-' : '+'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Connections:</span>
            <span className="font-medium">{stats.activeConnections}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Response:</span>
            <span className="font-medium">{formatResponseTime(stats.averageResponseTime)}</span>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="grid grid-cols-2 gap-4">
              <div>Subscriptions: {stats.subscriptionCount}</div>
              <div>Queued: {stats.queuedSubscriptions}</div>
              <div>Failed: {stats.failedConnections}</div>
              <div>Last Check: {new Date(stats.lastHealthCheck).toLocaleTimeString()}</div>
            </div>
            
            {stats.circuitBreakerOpen && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                Circuit breaker is open. Database connections are temporarily suspended.
              </div>
            )}
            
            {stats.averageResponseTime > 3000 && (
              <div className="mt-2 p-2 bg-warning/10 rounded text-warning text-xs">
                High response times detected. Some operations may be slower than usual.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}