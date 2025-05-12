
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "./button";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { cn } from "@/lib/utils";

interface SubscriptionIndicatorProps {
  tables: string[];
  variant?: 'default' | 'compact' | 'icon-only';
  showRefreshButton?: boolean;
  showLabel?: boolean;
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export function SubscriptionIndicator({ 
  tables,
  variant = 'default',
  showRefreshButton = false,
  showLabel = false,
  onRefresh,
  className 
}: SubscriptionIndicatorProps) {
  const {
    isSubscribed,
    tablesSubscribed,
    tablesUnsubscribed,
    connectionStatus,
    lastRefreshFormatted,
    isStale,
    refreshSubscription
  } = useSubscriptionStatus(tables);

  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const getStatusIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Loader2 className={cn("animate-spin", 
        variant === 'icon-only' ? "h-5 w-5" : "h-4 w-4"
      )} />;
    } else if (connectionStatus !== 'connected') {
      return <WifiOff className={cn("text-red-500", 
        variant === 'icon-only' ? "h-5 w-5" : "h-4 w-4"
      )} />;
    } else if (isStale) {
      return <AlertTriangle className={cn("text-amber-500", 
        variant === 'icon-only' ? "h-5 w-5" : "h-4 w-4"
      )} />;
    } else if (!isSubscribed) {
      return <AlertTriangle className={cn("text-amber-500", 
        variant === 'icon-only' ? "h-5 w-5" : "h-4 w-4"
      )} />;
    } else {
      return <Wifi className={cn("text-green-500", 
        variant === 'icon-only' ? "h-5 w-5" : "h-4 w-4"
      )} />;
    }
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
          <p className="font-semibold">Partial real-time updates</p>
          {tablesSubscribed.length > 0 && (
            <p>Subscribed: {tablesSubscribed.join(', ')}</p>
          )}
          {tablesUnsubscribed.length > 0 && (
            <p>Missing: {tablesUnsubscribed.join(', ')}</p>
          )}
          <p className="text-muted-foreground mt-1">Last updated: {lastRefreshFormatted}</p>
        </div>
      );
    }
    
    return (
      <div className="text-xs max-w-xs">
        <p className="font-semibold">Real-time updates active</p>
        <p>Subscribed tables: {tables.join(', ')}</p>
        <p className="text-muted-foreground mt-1">Last updated: {lastRefreshFormatted}</p>
      </div>
    );
  };
  
  // For icon-only variant
  if (variant === 'icon-only') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("cursor-help", className)}>
              {getStatusIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // For compact variant
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5", className)}>
              {getStatusIcon()}
              {showRefreshButton && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRefresh();
                  }}
                  disabled={isRefreshing || connectionStatus === 'connecting'}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                  <span className="sr-only">Refresh</span>
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Default variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className="flex items-center gap-1.5">
              {getStatusIcon()}
              {showLabel && (
                <span className="text-sm font-medium">
                  {connectionStatus === 'connecting' ? "Connecting..." :
                   !isSubscribed ? "Partial" :
                   isStale ? "Stale" :
                   "Live"}
                </span>
              )}
            </div>
            {showRefreshButton && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 py-1"
                onClick={handleRefresh}
                disabled={isRefreshing || connectionStatus === 'connecting'}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
