
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

interface ConnectionStatusIndicatorProps {
  className?: string;
  variant?: "default" | "compact";
  showTooltip?: boolean;
}

export function ConnectionStatusIndicator({
  className = "",
  variant = "default",
  showTooltip = true
}: ConnectionStatusIndicatorProps) {
  const queryClient = useQueryClient();
  const subscriptionManager = UnifiedSubscriptionManager.getInstance(queryClient);
  
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [staleDataExists, setStaleDataExists] = useState(false);
  
  // Track connection status and stale data
  useEffect(() => {
    const interval = setInterval(() => {
      const connectionStatus = subscriptionManager.getConnectionStatus();
      setStatus(connectionStatus);
      
      // Check for stale data
      const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
      const now = Date.now();
      let hasStaleData = false;
      
      activeSubscriptions.forEach(key => {
        const [table, queryKey] = key.split('::');
        const subscriptionStatus = subscriptionManager.getSubscriptionStatus(table, queryKey);
        
        if (now - subscriptionStatus.lastActivity > 5 * 60 * 1000) { // 5 minutes
          hasStaleData = true;
        }
      });
      
      setStaleDataExists(hasStaleData);
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle refresh when clicking the indicator
  const handleRefresh = () => {
    queryClient.invalidateQueries();
    
    const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
    activeSubscriptions.forEach(key => {
      const [table, queryKey] = key.split('::');
      subscriptionManager.forceRefreshSubscriptions([table]);
    });
  };
  
  const getStatusColor = () => {
    if (status === 'connected') return staleDataExists ? "bg-yellow-500" : "bg-green-500";
    if (status === 'disconnected') return "bg-red-500";
    return "bg-yellow-500"; // connecting
  };
  
  const getStatusIcon = () => {
    if (status === 'connected') {
      return staleDataExists ? <AlertTriangle className="h-3 w-3" /> : <Wifi className="h-3 w-3" />;
    }
    return <WifiOff className="h-3 w-3" />;
  };
  
  const getStatusText = () => {
    if (status === 'connected') {
      return staleDataExists ? "Connected (Stale Data)" : "Connected";
    }
    if (status === 'disconnected') return "Disconnected";
    return "Connecting...";
  };
  
  const indicator = (
    <Badge 
      variant="outline"
      className={`flex items-center gap-1 cursor-pointer ${className}`}
      onClick={handleRefresh}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
      {variant === "default" && (
        <>
          {getStatusIcon()}
          <span className="text-xs">{getStatusText()}</span>
        </>
      )}
    </Badge>
  );
  
  if (!showTooltip) return indicator;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusText()}</p>
          {(status !== 'connected' || staleDataExists) && (
            <p className="text-xs text-muted-foreground">Click to refresh data</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
