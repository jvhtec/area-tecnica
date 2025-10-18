
import { useState, useEffect } from "react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GlassButton } from "@/components/ui/glass";
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
    if (connectionStatus === 'connecting') {
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    } else if (connectionStatus !== 'connected') {
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
    if (connectionStatus === 'connecting') {
      return "Connecting...";
    } else if (connectionStatus !== 'connected') {
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
  
  const statusTone =
    connectionStatus === 'connecting'
      ? 'text-blue-500'
      : connectionStatus !== 'connected'
        ? 'text-red-500'
        : isStale || !isFullySubscribed
          ? 'text-amber-500'
          : 'text-muted-foreground';

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1.5', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="sm"
              className={cn('gap-1 px-2 text-xs font-medium transition-transform', statusTone)}
              glassSurfaceClassName="h-8"
              glassContentClassName="items-center"
              onClick={isStale ? handleRefresh : undefined}
              disabled={isRefreshing && isStale}
            >
              <span className="flex items-center gap-1">
                {getStatusIcon()}
                <span className="hidden sm:inline">{getStatusText()}</span>
              </span>
            </GlassButton>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
        <GlassButton
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          glassSurfaceClassName="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            handleRefresh();
          }}
          disabled={isRefreshing || connectionStatus === 'connecting'}
          aria-label="Refresh real-time status"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </GlassButton>
      </div>
    </TooltipProvider>
  );
}
