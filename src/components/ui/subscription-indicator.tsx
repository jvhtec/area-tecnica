
import { Wifi, WifiOff, AlertCircle, RefreshCw, Clock, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { cn } from "@/lib/utils";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Button } from "./button";
import { useState } from "react";

interface SubscriptionIndicatorProps {
  tables: string[];
  showLabel?: boolean;
  className?: string;
  showTooltip?: boolean;
  variant?: 'default' | 'compact';
  showRefreshButton?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function SubscriptionIndicator({
  tables,
  showLabel = false,
  className,
  showTooltip = true,
  variant = 'default',
  showRefreshButton = false,
  onRefresh
}: SubscriptionIndicatorProps) {
  const { 
    isSubscribed, 
    tablesSubscribed, 
    tablesUnsubscribed, 
    connectionStatus, 
    lastRefreshTime,
    lastRefreshFormatted, 
    isStale,
    refreshSubscription
  } = useSubscriptionStatus(tables);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const isCompact = variant === 'compact';
  
  const getStatusIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Loader2 className={cn("text-blue-500 animate-spin", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    if (connectionStatus !== 'connected') {
      return <WifiOff className={cn("text-red-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    if (isStale) {
      return <Clock className={cn("text-amber-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    if (!isSubscribed) {
      return <AlertCircle className={cn("text-amber-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    return <Wifi className={cn("text-green-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
  };
  
  const getStatusLabel = () => {
    if (connectionStatus === 'connecting') {
      return "Connecting...";
    }
    
    if (connectionStatus !== 'connected') {
      return "Disconnected";
    }
    
    if (isStale) {
      return "Stale data";
    }
    
    if (!isSubscribed) {
      return "Partial subscription";
    }
    
    return "Real-time active";
  };
  
  const getTooltipContent = () => {
    if (connectionStatus === 'connecting') {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Establishing connection</p>
          <p>Setting up real-time connection...</p>
        </div>
      );
    }
    
    if (connectionStatus !== 'connected') {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Connection lost</p>
          <p>Attempting to reconnect...</p>
          <p className="text-muted-foreground mt-1">Last data refresh: {lastRefreshFormatted}</p>
        </div>
      );
    }
    
    if (isStale) {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Data may be stale</p>
          <p>Last updated: {lastRefreshFormatted}</p>
          <p>Click to refresh data</p>
        </div>
      );
    }
    
    if (!isSubscribed) {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Partial real-time subscription</p>
          <div className="mt-1">
            <p>Subscribed tables: {tablesSubscribed.join(', ') || 'none'}</p>
            <p>Unsubscribed tables: {tablesUnsubscribed.join(', ')}</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-xs max-w-xs">
        <p className="font-semibold">Real-time updates active</p>
        <p>All tables subscribed: {tables.join(', ')}</p>
        <p>Last updated: {lastRefreshFormatted}</p>
      </div>
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        refreshSubscription();
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const indicator = (
    <div className={cn(
      "flex items-center gap-1", 
      isCompact ? "text-xs" : "text-sm",
      className
    )}>
      {getStatusIcon()}
      {showLabel && <span>{getStatusLabel()}</span>}
      {showRefreshButton && (
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("ml-1", isCompact ? "h-4 w-4" : "h-6 w-6")} 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn(
            isCompact ? "h-2 w-2" : "h-3 w-3",
            isRefreshing ? "animate-spin" : ""
          )} />
        </Button>
      )}
    </div>
  );
  
  if (!showTooltip) {
    return indicator;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div onClick={isStale ? handleRefresh : undefined} className={isStale ? "cursor-pointer" : undefined}>
            {indicator}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
