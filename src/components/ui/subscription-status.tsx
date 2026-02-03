import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { useResetSubscriptions } from "@/hooks/useResetSubscriptions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

/**
 * Displays a realtime subscription status card with expandable details and a reset action.
 *
 * Shows current connection status and active subscription count; when expanded, lists subscriptions grouped by table and provides a "Reset Subscriptions" button that invokes the reset action and, for admin users, shows success or error toasts.
 *
 * @returns The rendered subscription status Card element
 */
export function SubscriptionStatus() {
  const { connectionStatus, subscriptionCount, subscriptionsByTable } = useSubscriptionContext();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [expanded, setExpanded] = useState(false);
  const { resetAllSubscriptions } = useResetSubscriptions();

  const handleReset = () => {
    try {
      resetAllSubscriptions();
      // Only show toasts to admin users
      if (isAdmin) {
        toast.success("Subscriptions reset successfully");
      }
    } catch (error) {
      console.error("Error resetting subscriptions:", error);
      // Only show toasts to admin users
      if (isAdmin) {
        toast.error("Failed to reset subscriptions");
      }
    }
  };
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            Realtime Status
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
        <CardDescription>
          Status: {connectionStatus} • {subscriptionCount} Active Subscriptions
        </CardDescription>
      </CardHeader>
      
      {expanded && (
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Reset Subscriptions
              </Button>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Subscriptions by Table</h3>
              <div className="space-y-2">
                {Object.entries(subscriptionsByTable).length > 0 ? (
                  Object.entries(subscriptionsByTable).map(([table, keys]) => (
                    <div key={table} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{table}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {keys.length} subscription{keys.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="ml-4 text-xs text-muted-foreground">
                        {keys.slice(0, 3).map((key, i) => (
                          <div key={i} className="truncate max-w-xs">
                            {key}
                          </div>
                        ))}
                        {keys.length > 3 && (
                          <div>+{keys.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No active subscriptions
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}