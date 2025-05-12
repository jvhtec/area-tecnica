
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "./button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ConnectionStatusProps {
  variant?: 'card' | 'inline';
  className?: string;
}

export function ConnectionStatus({ 
  variant = 'card',
  className
}: ConnectionStatusProps) {
  const { 
    connectionStatus, 
    refreshSubscriptions,
    lastRefreshTime,
    subscriptionCount,
    activeSubscriptions
  } = useSubscriptionContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Calculate stale status
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000; // 5 minutes
  
  // Show connection status briefly when there's an issue or on initial load
  useEffect(() => {
    if (connectionStatus === 'connecting') {
      // Always show when connecting
      setIsVisible(true);
    }
    else if (connectionStatus !== 'connected' || isStale) {
      setIsVisible(true);
      setHasError(true);
      
      // Keep visible while issues persist
    } else if (hasError) {
      // If we've recovered from an error, show briefly then hide
      setIsVisible(true);
      setHasError(false);
      
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    } else {
      // If everything is good, hide after 5 seconds
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [connectionStatus, isStale, hasError]);
  
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
  
  // If using inline variant, render simpler version
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        {connectionStatus === 'connecting' ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : connectionStatus === 'connected' ? (
          isStale ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <Wifi className="h-4 w-4 text-green-500" />
          )
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        
        <span className="text-sm">
          {connectionStatus === 'connecting' ? "Connecting..." :
           connectionStatus === 'connected' 
            ? (isStale ? "Data may be stale" : "Connected") 
            : "Disconnected"}
        </span>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing || connectionStatus === 'connecting'}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>
    );
  }
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-md transition-all duration-300 ease-in-out ${className || ''}`}>
      {isVisible && (
        <Card className={`shadow-lg ${
          connectionStatus === 'connecting' ? 'bg-blue-50' :
          connectionStatus === 'connected' && !isStale ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connecting' ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : connectionStatus === 'connected' ? (
                  isStale ? (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Wifi className="h-5 w-5 text-green-500" />
                  )
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                
                <div>
                  <p className="text-sm font-medium">
                    {connectionStatus === 'connecting' ? "Connecting..." :
                     connectionStatus === 'connected' 
                      ? (isStale ? "Data may be stale" : "Connected") 
                      : "Connection issue"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connectionStatus === 'connecting' ? "Establishing connection..." :
                     connectionStatus === 'connected' 
                      ? `Last updated: ${lastRefreshDisplay}` 
                      : "Attempting to reconnect..."}
                  </p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing || connectionStatus === 'connecting'}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
