import { useState, useEffect } from "react";
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
  
  // Combined status for display
  const getCombinedStatus = () => {
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
  };
  
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
  
  // Get the right status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
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
        return (
          <>
            <WifiOff className="h-3 w-3 text-red-500" />
            <ShieldOff className="h-3 w-3 text-red-500" />
          </>
        );
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
  };
  
  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
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
  };
  
  // Get tooltip message
  const getTooltipMessage = (status: string) => {
    switch (status) {
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
  };
  
  const combinedStatus = getCombinedStatus();
  
  // Simple icon-only variant
  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`cursor-help flex ${className}`}>
              {getStatusIcon(combinedStatus)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipMessage(combinedStatus)}</p>
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
  }
  
  // Badge variant
  if (variant === "badge") {
    return (
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 cursor-pointer ${className}`}
        onClick={handleReconnect}
      >
        <div className="flex items-center">
          {getStatusIcon(combinedStatus)}
        </div>
        
        <span className="text-xs">
          {getStatusText(combinedStatus)}
        </span>
        
        {isRefreshing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </Badge>
    );
  }
  
  // Full variant with more details
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        {getStatusIcon(combinedStatus)}
      </div>
      
      <span>
        {getTooltipMessage(combinedStatus)}
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
}
