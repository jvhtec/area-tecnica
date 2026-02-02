
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ConnectionStatusProps {
  variant?: 'card' | 'inline' | 'icon' | 'badge' | 'full';
  className?: string;
}

export function ConnectionStatus({
  variant = 'card',
  className
}: ConnectionStatusProps) {
  const {
    connectionStatus,
    activeSubscriptions,
    lastRefreshTime,
    refreshSubscriptions
  } = useSubscriptionContext();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Calculate stale status
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000; // 5 minutes

  // Normalize status for display
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';
  const isDisconnected = !isConnected && !isConnecting;

  // Show connection status briefly when there's an issue or on initial load
  useEffect(() => {
    // Auto-hide logic only applies to card variant
    if (variant !== 'card') return;

    if (isConnecting) {
      setIsVisible(true);
    }
    else if (isDisconnected || isStale) {
      setIsVisible(true);
      setHasError(true);
    } else if (hasError) {
      setIsVisible(true);
      setHasError(false);

      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [connectionStatus, isStale, hasError, variant, isConnecting, isDisconnected]);

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

  // Status label helper
  const statusLabel = isConnecting ? "Connecting..." :
    isConnected ? (isStale ? "Data may be stale" : "Connected") : "Disconnected";

  // Icon helper
  const StatusIcon = ({ size = "h-4 w-4" }: { size?: string }) => {
    if (isConnecting) return <Loader2 className={`${size} text-blue-500 animate-spin`} />;
    if (isConnected && !isStale) return <Wifi className={`${size} text-green-500`} />;
    if (isConnected && isStale) return <AlertCircle className={`${size} text-amber-500`} />;
    return <WifiOff className={`${size} text-red-500`} />;
  };

  // Icon-only variant with tooltip
  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`cursor-help ${className || ''}`}>
              <StatusIcon />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isConnected ? "Connected to real-time updates" :
               isConnecting ? "Connecting..." :
               "Disconnected from real-time updates"}
            </p>
            {!isConnected && (
              <Button
                variant="link"
                className="p-0 h-auto text-xs"
                onClick={handleRefresh}
              >
                Click to reconnect
              </Button>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={`flex items-center gap-1 cursor-pointer ${className || ''}`}
        onClick={handleRefresh}
      >
        <StatusIcon size="h-3 w-3" />
        <span className="text-xs">{statusLabel}</span>
        {isRefreshing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </Badge>
    );
  }

  // Full variant with reconnect button
  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <StatusIcon />
        <span>
          {isConnected ? "Connected to real-time updates" :
           isConnecting ? "Connecting to real-time updates..." :
           "Disconnected from real-time updates"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-2"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reconnecting
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect
            </>
          )}
        </Button>
      </div>
    );
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <StatusIcon />
        <span className="text-sm">{statusLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isConnecting}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>
    );
  }

  // Card variant (default) — fixed position overlay
  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-md transition-all duration-300 ease-in-out ${className || ''}`}>
      {isVisible && (
        <Card className={`shadow-lg ${
          isConnecting ? 'bg-blue-50' :
          isConnected && !isStale ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon size="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">{statusLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {isConnecting ? "Establishing connection..." :
                     isConnected
                      ? `Last updated: ${lastRefreshDisplay}`
                      : "Attempting to reconnect..."}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isConnecting}
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

// Backward-compatible alias for ConnectionIndicator
export const ConnectionIndicator = ConnectionStatus;
