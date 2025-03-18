
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

export function SubscriptionStatus() {
  const { connectionStatus, subscriptionCount, subscriptionsByTable } = useSubscriptionContext();
  const [expanded, setExpanded] = useState(false);
  
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
