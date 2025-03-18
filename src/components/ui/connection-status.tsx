
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function ConnectionStatus() {
  const { 
    connectionStatus, 
    activeSubscriptions, 
    lastRefreshTime,
    refreshSubscriptions
  } = useSubscriptionContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Calculate stale status
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000; // 5 minutes
  
  // Show connection status briefly when there's an issue
  useEffect(() => {
    if (connectionStatus !== 'connected' || isStale) {
      setIsVisible(true);
      setHasError(true);
      
      // Hide after 5 seconds
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    } else if (hasError) {
      // If we've recovered from an error, show briefly then hide
      setIsVisible(true);
      setHasError(false);
      
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      
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
  
  if (!isVisible) {
    return null;
  }
  
  // Format last refresh time
  let lastRefreshDisplay = "Unknown";
  try {
    lastRefreshDisplay = formatDistanceToNow(lastRefreshTime) + " ago";
  } catch (error) {
    console.error("Error formatting time:", error);
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md transition-all duration-300 ease-in-out">
      <Card className={`shadow-lg ${connectionStatus === 'connected' && !isStale ? 'bg-green-50' : 'bg-red-50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
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
                  {connectionStatus === 'connected' 
                    ? (isStale ? "Data may be stale" : "Connected") 
                    : "Connection issue"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connectionStatus === 'connected' 
                    ? `Last updated: ${lastRefreshDisplay}` 
                    : "Attempting to reconnect..."}
                </p>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
