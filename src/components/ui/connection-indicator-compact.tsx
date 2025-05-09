
import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { connectionManager } from "@/lib/connection-manager";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { connectionConfig } from "@/lib/connection-config";
import { cn } from "@/lib/utils";
import { useResetSubscriptions } from "@/hooks/useResetSubscriptions";

interface ConnectionIndicatorCompactProps {
  className?: string;
  hideAfterMs?: number;
  alwaysShowOnError?: boolean;
}

/**
 * A minimalist connection indicator that only shows when there are issues
 * or briefly after connection state changes, then hides itself
 */
export function ConnectionIndicatorCompact({ 
  className, 
  hideAfterMs = 5000,
  alwaysShowOnError = true
}: ConnectionIndicatorCompactProps) {
  const { 
    connectionState, 
    isStale, 
    formattedLastRefresh, 
    refreshConnections 
  } = useConnectionStatus();
  
  const { resetAllSubscriptions } = useResetSubscriptions();
  const [isResetting, setIsResetting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const config = connectionConfig.get();
  
  // Don't show if indicators are disabled in config
  if (!config.showConnectionIndicator) {
    return null;
  }
  
  // Show/hide logic based on connection state
  useEffect(() => {
    // Always show when connecting or disconnected
    if (connectionState !== 'connected' || isStale) {
      setIsVisible(true);
      // If alwaysShowOnError is true, keep it visible
      if (alwaysShowOnError) {
        return;
      }
    } else {
      // When connected, show briefly then hide
      setIsVisible(true);
      
      // Clear any existing timer
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      
      // Set timer to hide
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        hideTimerRef.current = null;
      }, hideAfterMs);
    }
    
    // Cleanup
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [connectionState, isStale, hideAfterMs, alwaysShowOnError]);
  
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetAllSubscriptions();
    } finally {
      setIsResetting(false);
    }
  };
  
  // Short-circuit if not visible
  if (!isVisible) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "fixed bottom-4 right-4 z-50 flex items-center gap-2 p-2 rounded-md shadow-lg transition-all cursor-pointer",
            connectionState === "connected" && !isStale ? "bg-green-50 border border-green-100" : 
            connectionState === "connecting" ? "bg-blue-50 border border-blue-100" : 
            "bg-red-50 border border-red-100",
            className
          )}
          onClick={handleReset}>
            {connectionState === "connecting" && (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            {connectionState === "connected" && !isStale && (
              <Wifi className="h-4 w-4 text-green-500" />
            )}
            {connectionState === "connected" && isStale && (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            {connectionState === "disconnected" && (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            
            <span className="text-xs font-medium">
              {connectionState === "connecting" ? "Connecting..." :
              connectionState === "connected" && !isStale ? "Connected" :
              connectionState === "connected" && isStale ? "Stale data" :
              "Reconnecting..."}
            </span>
            
            {isResetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {connectionState === "connecting" ? "Establishing connection..." :
            connectionState === "connected" && !isStale ? "Real-time updates active" :
            connectionState === "connected" && isStale ? "Data may be out-of-date" :
            "Connection lost, attempting to reconnect"}
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated: {formattedLastRefresh}
          </p>
          <p className="text-xs font-medium mt-1">
            Click to reset connection
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
