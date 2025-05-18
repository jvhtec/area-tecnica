
import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getRealtimeConnectionStatus } from "@/lib/supabase-client";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { toast } from "sonner";

interface ConnectionIndicatorProps {
  className?: string;
  variant?: "icon" | "badge" | "full";
}

export function ConnectionIndicator({ 
  className = "", 
  variant = "badge" 
}: ConnectionIndicatorProps) {
  const [status, setStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>(
    getRealtimeConnectionStatus()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getRealtimeConnectionStatus());
    }, 5000);
    
    // Update immediately on mount
    setStatus(getRealtimeConnectionStatus());
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle reconnection
  const handleReconnect = async () => {
    setIsRefreshing(true);
    
    try {
      connectionRecovery.startRecovery();
      toast.info("Attempting to restore connection...");
      
      // Set a timeout to reset the refreshing state
      setTimeout(() => {
        setIsRefreshing(false);
      }, 3000);
    } catch (error) {
      setIsRefreshing(false);
      toast.error("Failed to restore connection");
      console.error("Error during reconnection:", error);
    }
  };
  
  // Simple icon-only variant
  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`cursor-help ${className}`}>
              {status === "CONNECTED" && <Wifi className="h-4 w-4 text-green-500" />}
              {status === "CONNECTING" && <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />}
              {status === "DISCONNECTED" && <WifiOff className="h-4 w-4 text-red-500" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {status === "CONNECTED" ? "Connected to real-time updates" :
               status === "CONNECTING" ? "Connecting..." :
               "Disconnected from real-time updates"}
            </p>
            {status !== "CONNECTED" && (
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
        {status === "CONNECTED" && <Wifi className="h-3 w-3 text-green-500" />}
        {status === "CONNECTING" && <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />}
        {status === "DISCONNECTED" && <WifiOff className="h-3 w-3 text-red-500" />}
        
        <span className="text-xs">
          {status === "CONNECTED" ? "Connected" :
           status === "CONNECTING" ? "Connecting..." :
           "Disconnected"}
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
      {status === "CONNECTED" && <Wifi className="h-4 w-4 text-green-500" />}
      {status === "CONNECTING" && <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />}
      {status === "DISCONNECTED" && <WifiOff className="h-4 w-4 text-red-500" />}
      
      <span>
        {status === "CONNECTED" ? "Connected to real-time updates" :
         status === "CONNECTING" ? "Connecting to real-time updates..." :
         "Disconnected from real-time updates"}
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
