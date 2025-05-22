
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, XCircle } from "lucide-react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { ensureRealtimeConnection } from "@/lib/enhanced-supabase-client";

export function ConnectionStatus() {
  const { connectionStatus, isNetworkAvailable, forceRefresh } = useSubscriptionContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Only show when disconnected for 5+ seconds
  useEffect(() => {
    let timeoutId: number;
    
    if (connectionStatus === 'DISCONNECTED' && !isNetworkAvailable) {
      // Wait 5 seconds before showing the banner
      timeoutId = window.setTimeout(() => {
        setIsVisible(true);
      }, 5000);
    } else {
      setIsVisible(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [connectionStatus, isNetworkAvailable]);
  
  if (!isVisible) return null;
  
  const handleReconnect = async () => {
    setIsRecovering(true);
    
    try {
      // Try to recover connection
      const recovered = await ensureRealtimeConnection();
      
      if (recovered) {
        // Force refresh data
        forceRefresh();
        setIsVisible(false);
      }
    } catch (error) {
      console.error("Error recovering connection:", error);
    } finally {
      setIsRecovering(false);
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-destructive/90 text-destructive-foreground rounded-lg shadow-lg p-4 animate-in fade-in slide-in-from-right">
      <div className="flex items-center gap-3">
        <WifiOff className="h-5 w-5" />
        <div className="flex-1">
          <h4 className="font-medium">Connection lost</h4>
          <p className="text-xs opacity-80">The application is experiencing connectivity issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReconnect} 
            disabled={isRecovering}
            className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90"
          >
            {isRecovering ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reconnect
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsVisible(false)}
            className="text-destructive-foreground hover:bg-destructive-foreground/10"
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
