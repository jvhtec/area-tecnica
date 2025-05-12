import { useState, useEffect, useMemo } from "react";
import { Wifi, WifiOff, Shield, ShieldOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

interface SessionStatusIndicatorProps {
  className?: string;
  variant?: "icon" | "badge" | "full";
}

export function SessionStatusIndicator({ 
  className = "", 
  variant = "badge" 
}: SessionStatusIndicatorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { status: sessionStatus, refreshSession } = useSessionManager();
  const { connectionStatus, refreshSubscriptions } = useSubscriptionContext();
  
  // Combined status for display - memoized to prevent recalculations
  const combinedStatus = useMemo(() => {
    // If session has an error, that's the highest priority
    if (sessionStatus === "error") return "error";
    
    // If session is refreshing or recovering, show that
    if (sessionStatus === "refreshing" || sessionStatus === "recovering") return "updating";
    
    // If session is inactive, that's a critical issue
    if (sessionStatus === "inactive") return "disconnected";
    
    // If session is active but connection is not connected, we're connecting
    if (connectionStatus !== "connected") return "connecting";
    
    // Otherwise everything is good
    return "connected";
  }, [sessionStatus, connectionStatus]);
  
  // Handle reconnection
  const handleReconnect = async () => {
    setIsRefreshing(true);
    
    try {
      // First refresh the session
      await refreshSession();
      
      // Then refresh subscriptions
      refreshSubscriptions();
      
      // Set a timeout to reset the refreshing state
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      setIsRefreshing(false);
      console.error("Error during reconnection:", error);
    }
  };
  
  // Get the right status icon - memoized
  const statusIcon = useMemo(() => {
    switch (combinedStatus) {
      case "connected":
        return (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <Shield className="h-3 w-3 text-green-500" />
          </>
        );
      case "connecting":
        return (
          <>
            <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
            <Shield className="h-3 w-3 text-green-500" />
          </>
        );
      case "updating":
        return (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
          </>
        );
      case "disconnected":
      case "error":
        return (
          <>
            <WifiOff className="h-3 w-3 text-red-500" />
            <ShieldOff className="h-3 w-3 text-red-500" />
          </>
        );
      default:
        return <Loader2 className="h-3 w-3 animate-spin" />;
    }
  }, [combinedStatus]);
  
  // Get status text - memoized
  const statusText = useMemo(() => {
    switch (combinedStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "updating":
        return "Updating...";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [combinedStatus]);
  
  // Get tooltip message - memoized
  const tooltipMessage = useMemo(() => {
    switch (combinedStatus) {
      case "connected":
        return "Connected to session and realtime updates";
      case "connecting":
        return "Connecting to realtime updates";
      case "updating":
        return "Updating session or subscriptions";
      case "disconnected":
        return "Disconnected from session or realtime updates";
      case "error":
        return "Error with session or subscriptions";
      default:
        return "Unknown status";
    }
  }, [combinedStatus]);
  
  // Render based on variant - using functions to avoid conditional hook calls
  const renderIconVariant = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`cursor-help flex ${className}`}>
            {statusIcon}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMessage}</p>
          {combinedStatus !== "connected" && (
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs" 
              onClick={handleReconnect}
            >
              Click to reconnect
            </Button>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
  
  const renderBadgeVariant = () => (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-1 cursor-pointer ${className}`}
      onClick={handleReconnect}
    >
      <div className="flex items-center">
        {statusIcon}
      </div>
      
      <span className="text-xs">
        {statusText}
      </span>
      
      {isRefreshing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
    </Badge>
  );
  
  const renderFullVariant = () => (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        {statusIcon}
      </div>
      
      <span>
        {tooltipMessage}
      </span>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleReconnect}
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

  // Use a switch instead of conditionals to ensure consistent hook calls
  switch (variant) {
    case "icon":
      return renderIconVariant();
    case "badge":
      return renderBadgeVariant();
    case "full":
      return renderFullVariant();
    default:
      return renderBadgeVariant();
  }
}
