
import { useState, useEffect } from "react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "./button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function HeaderStatus({ className }: { className?: string }) {
  const { 
    connectionStatus, 
    activeSubscriptions, 
    lastRefreshTime,
    refreshSubscriptions
  } = useSubscriptionContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Calculate stale status
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000; // 5 minutes
  
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
  
  // Format last refresh time
  let lastRefreshDisplay = "Unknown";
  try {
    lastRefreshDisplay = formatDistanceToNow(lastRefreshTime) + " ago";
  } catch (error) {
    console.error("Error formatting time:", error);
  }
  
  const getStatusIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    } else if (connectionStatus === 'connected') {
      return isStale 
        ? <AlertCircle className="h-3 w-3 text-amber-500" />
        : <Wifi className="h-3 w-3 text-green-500" />;
    } else {
      return <WifiOff className="h-3 w-3 text-red-500" />;
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
    
    return (
      <div className="text-xs max-w-xs">
        <p className="font-semibold">Real-time updates active</p>
        <p>{activeSubscriptions.length} active subscriptions</p>
        <p>Last updated: {lastRefreshDisplay}</p>
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
              isStale ? "text-amber-500" : (
                connectionStatus === 'connected' ? "text-muted-foreground" : "text-red-500"
              ),
              className
            )}
            onClick={isStale ? handleRefresh : undefined}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">
              {connectionStatus === 'connecting' ? "Connecting..." :
               connectionStatus === 'connected' 
                ? (isStale ? "Stale data" : "Live") 
                : "Offline"}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 ml-0.5 hidden sm:flex" 
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={isRefreshing || connectionStatus === 'connecting'}
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
