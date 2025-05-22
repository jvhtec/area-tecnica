
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SubscriptionIndicatorProps {
  tables: string[];
  variant?: "normal" | "compact";
  className?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  showLabel?: boolean;
}

export function SubscriptionIndicator({
  tables,
  variant = "normal",
  className,
  showRefreshButton = false,
  onRefresh,
  showLabel = false
}: SubscriptionIndicatorProps) {
  const { subscriptionsByTable, connectionStatus, forceRefresh, lastRefreshTime } = useSubscriptionContext();
  
  // Check if all required tables are subscribed
  const hasAllSubscriptions = tables.every(table => 
    subscriptionsByTable[table] && subscriptionsByTable[table].length > 0
  );
  
  // Calculate time since last refresh
  const timeSinceRefresh = Math.floor((Date.now() - lastRefreshTime) / 1000);
  const formattedTimeSinceRefresh = timeSinceRefresh < 60 
    ? `${timeSinceRefresh} seconds ago` 
    : `${Math.floor(timeSinceRefresh / 60)} minutes ago`;
  
  // Determine status
  const isConnected = connectionStatus === 'CONNECTED' && hasAllSubscriptions;
  const isStale = timeSinceRefresh > 5 * 60; // 5 minutes
  
  // Handle refresh
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      forceRefresh(tables);
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            {variant === "normal" ? (
              <Badge 
                variant={isConnected ? (isStale ? "outline" : "default") : "destructive"}
                className="cursor-help"
              >
                {isConnected ? (
                  <Wifi className="h-3 w-3 mr-1" />
                ) : (
                  <WifiOff className="h-3 w-3 mr-1" />
                )}
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            ) : (
              <div className="cursor-help">
                {isConnected ? (
                  <Wifi className={`h-4 w-4 ${isStale ? "text-amber-500" : "text-green-500"}`} />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </div>
            )}
            
            {showRefreshButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh} 
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>
              <strong>Status:</strong> {isConnected ? "Connected" : "Disconnected"}
            </p>
            <p>
              <strong>Last update:</strong> {formattedTimeSinceRefresh}
            </p>
            <p>
              <strong>Tables:</strong> {hasAllSubscriptions ? "All subscribed" : "Missing subscriptions"}
            </p>
            <p className="text-muted-foreground text-[10px]">Click to refresh</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
