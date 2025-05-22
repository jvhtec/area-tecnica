
import { useState, useEffect } from "react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "./button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouteSubscriptions, ROUTE_SUBSCRIPTIONS } from "@/hooks/useRouteSubscriptions";

export function HeaderStatus({ className }: { className?: string }) {
  const { refreshSubscriptions } = useSubscriptionContext();
  const {
    connectionStatus,
    lastRefreshTime,
    isFullySubscribed,
    isStale,
    requiredTables,
    subscribedTables,
    unsubscribedTables,
    routeKey
  } = useRouteSubscriptions();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Format last refresh time
  let lastRefreshDisplay = "Unknown";
  try {
    lastRefreshDisplay = formatDistanceToNow(lastRefreshTime) + " ago";
  } catch (error) {
    console.error("Error formatting time:", error);
  }
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshSubscriptions();
      toast.success("Real-time connections refreshed");
    } catch (error) {
      console.error("Error refreshing subscriptions:", error);
      toast.error("Failed to refresh connections");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const getStatusIcon = () => {
    if (connectionStatus === 'CONNECTING') {
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    } else if (connectionStatus !== 'CONNECTED') {
      return <WifiOff className="h-3 w-3 text-red-500" />;
    } else if (isStale) {
      return <Clock className="h-3 w-3 text-amber-500" />;
    } else if (!isFullySubscribed) {
      return <AlertCircle className="h-3 w-3 text-amber-500" />;
    } else {
      return <Wifi className="h-3 w-3 text-green-500" />;
    }
  };
  
  const getStatusText = () => {
    if (connectionStatus === 'CONNECTING') {
      return "Connecting...";
    } else if (connectionStatus !== 'CONNECTED') {
      return "Offline";
    } else if (isStale) {
      return "Stale data";
    } else if (!isFullySubscribed) {
      return "Partial";
    } else {
      return "Live";
    }
  };
  
  const formatRouteName = (route: string) => {
    // Remove leading slash
    const withoutSlash = route.startsWith('/') ? route.substring(1) : route;
    
    // Replace hyphens with spaces and capitalize each word
    return withoutSlash
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const getTooltipContent = () => {
    if (connectionStatus === 'CONNECTING') {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Establishing connection</p>
          <p>Setting up real-time connection...</p>
        </div>
      );
    }
    
    if (connectionStatus !== 'CONNECTED') {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Connection lost</p>
          <p>Attempting to reconnect...</p>
          <p className="text-muted-foreground mt-1">Last data refresh: {lastRefreshDisplay}</p>
        </div>
      );
    }
    
    if (isStale) {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Data may be stale</p>
          <p>Last updated: {lastRefreshDisplay}</p>
          <p>Click to refresh data</p>
        </div>
      );
    }
    
    const routeName = formatRouteName(routeKey);
    const isDefinedRoute = Object.keys(ROUTE_SUBSCRIPTIONS).includes(routeKey);
    
    if (!isFullySubscribed) {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Partial real-time updates</p>
          <p className="mt-1">Current page: {routeName}</p>
          <div className="mt-1">
            {subscribedTables.length > 0 && (
              <p>Subscribed: {subscribedTables.join(', ')}</p>
            )}
            {unsubscribedTables.length > 0 && (
              <p>Missing: {unsubscribedTables.join(', ')}</p>
            )}
            {!isDefinedRoute && (
              <p className="text-amber-500 mt-1">This route has no specific subscriptions defined</p>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Last updated: {lastRefreshDisplay}</p>
        </div>
      );
    }
    
    return (
      <div className="text-xs max-w-xs">
        <p className="font-semibold">Real-time updates active</p>
        <p>Current page: {routeName}</p>
        {requiredTables.length > 0 ? (
          <>
            <p>All required tables are subscribed:</p>
            <p className="mt-1">{requiredTables.join(', ')}</p>
          </>
        ) : (
          <p>No specific tables required for this route</p>
        )}
        <p className="text-muted-foreground mt-1">Last updated: {lastRefreshDisplay}</p>
      </div>
    );
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-1.5 text-xs cursor-pointer",
              isStale || !isFullySubscribed ? "text-amber-500" : (
                connectionStatus === 'CONNECTED' ? "text-muted-foreground" : "text-red-500"
              ),
              className
            )}
            onClick={isStale ? handleRefresh : undefined}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">
              {getStatusText()}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 ml-0.5 hidden sm:flex" 
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={isRefreshing || connectionStatus === 'CONNECTING'}
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
