
import { useState } from "react";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { connectionManager } from "@/lib/connection-manager";

interface ConnectionIndicatorProps {
  className?: string;
  variant?: "icon" | "badge" | "full";
}

export function ConnectionIndicator({ 
  className = "", 
  variant = "badge" 
}: ConnectionIndicatorProps) {
  const { 
    connectionState, 
    isStale, 
    formattedLastRefresh, 
    isRefreshing, 
    refreshConnections 
  } = useConnectionStatus();
  
  // Simple icon-only variant
  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`cursor-help ${className}`}>
              {connectionState === "connecting" && <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />}
              {connectionState === "connected" && !isStale && <Wifi className="h-4 w-4 text-green-500" />}
              {connectionState === "connected" && isStale && <Wifi className="h-4 w-4 text-amber-500" />}
              {connectionState === "disconnected" && <WifiOff className="h-4 w-4 text-red-500" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {connectionState === "connecting" ? "Connecting..." :
               connectionState === "connected" && !isStale ? "Connected to real-time updates" :
               connectionState === "connected" && isStale ? "Data may be stale" :
               "Disconnected from real-time updates"}
            </p>
            <p className="text-xs text-muted-foreground">Last updated: {formattedLastRefresh}</p>
            {(connectionState !== "connected" || isStale) && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs" 
                onClick={refreshConnections}
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
        onClick={refreshConnections}
      >
        {connectionState === "connecting" && <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />}
        {connectionState === "connected" && !isStale && <Wifi className="h-3 w-3 text-green-500" />}
        {connectionState === "connected" && isStale && <Wifi className="h-3 w-3 text-amber-500" />}
        {connectionState === "disconnected" && <WifiOff className="h-3 w-3 text-red-500" />}
        
        <span className="text-xs">
          {connectionState === "connecting" ? "Connecting..." :
           connectionState === "connected" && !isStale ? "Connected" :
           connectionState === "connected" && isStale ? "Stale" :
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
      {connectionState === "connecting" && <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />}
      {connectionState === "connected" && !isStale && <Wifi className="h-4 w-4 text-green-500" />}
      {connectionState === "connected" && isStale && <Wifi className="h-4 w-4 text-amber-500" />}
      {connectionState === "disconnected" && <WifiOff className="h-4 w-4 text-red-500" />}
      
      <span>
        {connectionState === "connecting" ? "Connecting to real-time updates..." :
         connectionState === "connected" && !isStale ? "Connected to real-time updates" :
         connectionState === "connected" && isStale ? "Data may be stale" :
         "Disconnected from real-time updates"}
      </span>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={refreshConnections}
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
