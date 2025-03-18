
import { Wifi, WifiOff, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { cn } from "@/lib/utils";

interface SubscriptionIndicatorProps {
  tables: string[];
  showLabel?: boolean;
  className?: string;
  showTooltip?: boolean;
  variant?: 'default' | 'compact';
}

export function SubscriptionIndicator({
  tables,
  showLabel = false,
  className,
  showTooltip = true,
  variant = 'default'
}: SubscriptionIndicatorProps) {
  const { isSubscribed, tablesSubscribed, tablesUnsubscribed, connectionStatus } = useSubscriptionStatus(tables);

  const isCompact = variant === 'compact';
  
  const getStatusIcon = () => {
    if (connectionStatus !== 'connected') {
      return <WifiOff className={cn("text-red-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    if (!isSubscribed) {
      return <AlertCircle className={cn("text-amber-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
    }
    
    return <Wifi className={cn("text-green-500", isCompact ? "h-3 w-3" : "h-4 w-4")} />;
  };
  
  const getStatusLabel = () => {
    if (connectionStatus !== 'connected') {
      return "Disconnected";
    }
    
    if (!isSubscribed) {
      return "Partial subscription";
    }
    
    return "Real-time active";
  };
  
  const getTooltipContent = () => {
    if (connectionStatus !== 'connected') {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Connection lost</p>
          <p>Attempting to reconnect...</p>
        </div>
      );
    }
    
    if (!isSubscribed) {
      return (
        <div className="text-xs max-w-xs">
          <p className="font-semibold">Partial real-time subscription</p>
          <div className="mt-1">
            <p>Subscribed tables: {tablesSubscribed.join(', ') || 'none'}</p>
            <p>Unsubscribed tables: {tablesUnsubscribed.join(', ')}</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-xs max-w-xs">
        <p className="font-semibold">Real-time updates active</p>
        <p>All tables subscribed: {tables.join(', ')}</p>
      </div>
    );
  };
  
  const indicator = (
    <div className={cn(
      "flex items-center gap-1", 
      isCompact ? "text-xs" : "text-sm",
      className
    )}>
      {getStatusIcon()}
      {showLabel && <span>{getStatusLabel()}</span>}
    </div>
  );
  
  if (!showTooltip) {
    return indicator;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
