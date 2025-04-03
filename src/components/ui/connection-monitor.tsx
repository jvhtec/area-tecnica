
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { EnhancedSubscriptionManager } from '@/lib/enhanced-subscription-manager';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ConnectionMonitorProps {
  onRefresh?: () => void;
  className?: string;
  showRefreshButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  tables?: string[];
}

export function ConnectionMonitor({
  onRefresh,
  className,
  showRefreshButton = true,
  size = 'md',
  showLabel = true,
  tables = ['profiles', 'jobs']
}: ConnectionMonitorProps) {
  const queryClient = useQueryClient();
  const manager = EnhancedSubscriptionManager.getInstance(queryClient);
  
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>(
    manager.getConnectionStatus()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastActivity, setLastActivity] = useState<number | null>(null);
  
  // Update connection status
  useEffect(() => {
    const interval = setInterval(() => {
      const status = manager.getConnectionStatus();
      setConnectionStatus(status);
      
      // Get most recent activity from tracked tables
      let mostRecentActivity = 0;
      tables.forEach(table => {
        const tableStatus = manager.getSubscriptionStatus(table, table);
        if (tableStatus.lastActivity > mostRecentActivity) {
          mostRecentActivity = tableStatus.lastActivity;
        }
      });
      
      if (mostRecentActivity > 0) {
        setLastActivity(mostRecentActivity);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [manager, tables]);
  
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Reset subscriptions
      tables.forEach(table => {
        manager.unsubscribeFromTable(`${table}::${table}`);
        manager.subscribeToTable(table, table);
        queryClient.invalidateQueries({ queryKey: [table] });
      });
      
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const isStale = lastActivity && (Date.now() - lastActivity > 5 * 60 * 1000); // 5 minutes
  
  const getIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Loader2 className={`${iconSize} animate-spin text-blue-500`} />;
    } else if (connectionStatus === 'connected' && !isStale) {
      return <Wifi className={`${iconSize} text-green-500`} />;
    } else {
      return <WifiOff className={`${iconSize} text-red-500`} />;
    }
  };
  
  const getStatusText = () => {
    if (connectionStatus === 'connecting') {
      return 'Connecting...';
    } else if (connectionStatus === 'connected') {
      return isStale ? 'Stale data' : 'Live';
    } else {
      return 'Offline';
    }
  };
  
  const getTooltipText = () => {
    if (connectionStatus === 'connecting') {
      return 'Establishing connection to real-time updates';
    } else if (connectionStatus === 'connected') {
      return isStale 
        ? 'Data may be stale - click refresh to get latest data' 
        : 'Real-time updates active';
    } else {
      return 'Real-time updates unavailable - click refresh to get latest data';
    }
  };
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {getIcon()}
              {showLabel && <span className="text-xs">{getStatusText()}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {showRefreshButton && (
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-6 w-6"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`${iconSize} ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      )}
    </div>
  );
}
