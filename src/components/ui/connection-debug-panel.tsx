
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { useResetSubscriptions } from "@/hooks/useResetSubscriptions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, Loader2, Network, RefreshCw, Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TokenManager } from "@/lib/token-manager";

/**
 * Debug panel component for diagnosing connection issues
 * This is a developer tool, not intended for regular user use
 */
export function ConnectionDebugPanel() {
  const { 
    connectionState, 
    isStale, 
    formattedLastRefresh, 
    refreshConnections 
  } = useConnectionStatus();
  
  const { 
    activeSubscriptions, 
    subscriptionCount, 
    subscriptionsByTable 
  } = useSubscriptionContext();
  
  const { resetAllSubscriptions, isResetting } = useResetSubscriptions();
  const [isChecking, setIsChecking] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'valid' | 'expired' | 'unknown'>('unknown');
  const [channelStatus, setChannelStatus] = useState<string[]>([]);
  const tokenManager = TokenManager.getInstance();
  
  // Function to check session status
  const checkSession = async () => {
    setIsChecking(true);
    try {
      // Check if we have a session
      const session = await tokenManager.getSession();
      
      if (session) {
        setSessionStatus('valid');
      } else {
        setSessionStatus('expired');
      }
    } catch (error) {
      console.error("Error checking session:", error);
      setSessionStatus('unknown');
    } finally {
      setIsChecking(false);
    }
  };
  
  // Function to check channel status
  const checkChannels = () => {
    setIsChecking(true);
    try {
      // Get all channels
      const channels = supabase.getChannels();
      
      // Format channel info
      const channelInfo = channels.map(channel => 
        `Channel "${channel.topic}": ${channel.state}`
      );
      
      setChannelStatus(channelInfo.length ? channelInfo : ['No active channels found']);
    } catch (error) {
      console.error("Error checking channels:", error);
      setChannelStatus(['Error checking channel status']);
    } finally {
      setIsChecking(false);
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Connection Debug Panel
        </CardTitle>
        <CardDescription>
          Diagnose and fix real-time connection issues
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="status">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="session">Session</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-md">
                <div className="text-sm font-medium mb-1">Connection Status</div>
                <div className="flex items-center gap-2">
                  {connectionState === 'connected' && !isStale && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      <Check className="h-3 w-3 mr-1" /> Connected
                    </Badge>
                  )}
                  {connectionState === 'connected' && isStale && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Stale
                    </Badge>
                  )}
                  {connectionState === 'connecting' && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Connecting
                    </Badge>
                  )}
                  {connectionState === 'disconnected' && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Disconnected
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="p-4 border rounded-md">
                <div className="text-sm font-medium mb-1">Last Refresh</div>
                <div className="text-sm">{formattedLastRefresh}</div>
              </div>
              
              <div className="p-4 border rounded-md">
                <div className="text-sm font-medium mb-1">Active Subscriptions</div>
                <div className="text-sm">{subscriptionCount}</div>
              </div>
              
              <div className="p-4 border rounded-md">
                <div className="text-sm font-medium mb-1">Network Status</div>
                <div className="text-sm">
                  {navigator.onLine ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      <Check className="h-3 w-3 mr-1" /> Online
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Offline
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <Alert variant="info" className="mt-4">
              <Server className="h-4 w-4" />
              <AlertTitle>Connection Diagnostics</AlertTitle>
              <AlertDescription>
                If you're experiencing data staleness or connection issues, try refreshing the connections.
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted p-2 font-medium text-sm">
                Subscribed Tables ({Object.keys(subscriptionsByTable).length})
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                {Object.keys(subscriptionsByTable).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(subscriptionsByTable).map(([table, subscriptions]) => (
                      <li key={table} className="text-sm">
                        <span className="font-medium">{table}</span>: {subscriptions.length} subscription(s)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No active subscriptions found</div>
                )}
              </div>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted p-2 font-medium text-sm">
                Active Subscription Keys ({activeSubscriptions.length})
              </div>
              <div className="p-4 max-h-60 overflow-y-auto">
                {activeSubscriptions.length > 0 ? (
                  <ul className="space-y-1">
                    {activeSubscriptions.map((subscription, index) => (
                      <li key={index} className="text-xs font-mono truncate">{subscription}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No active subscriptions found</div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="session" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Session Status</div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkSession}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Check
              </Button>
            </div>
            
            <div className="p-4 border rounded-md">
              {sessionStatus === 'valid' && (
                <div className="text-green-600 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Session is valid
                </div>
              )}
              {sessionStatus === 'expired' && (
                <div className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Session is expired or missing
                </div>
              )}
              {sessionStatus === 'unknown' && (
                <div className="text-muted-foreground">
                  Click "Check" to verify session status
                </div>
              )}
            </div>
            
            <Alert variant="info">
              <AlertTitle>About Sessions</AlertTitle>
              <AlertDescription>
                Sessions automatically refresh in the background. If your session is expired, you may need to log in again.
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">WebSocket Channels</div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkChannels}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Check
              </Button>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted p-2 font-medium text-sm">Channel Status</div>
              <div className="p-4 max-h-60 overflow-y-auto">
                {channelStatus.length > 0 ? (
                  <ul className="space-y-1">
                    {channelStatus.map((status, index) => (
                      <li key={index} className="text-xs">{status}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Click "Check" to see WebSocket channel status
                  </div>
                )}
              </div>
            </div>
            
            <Alert variant="info">
              <AlertTitle>About WebSocket Channels</AlertTitle>
              <AlertDescription>
                WebSocket channels are used for real-time data updates. Active channels should have a status of "joined".
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-4">
        <div className="flex items-center justify-between w-full">
          <Button 
            variant="secondary" 
            onClick={refreshConnections} 
            disabled={isResetting}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Connections
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={resetAllSubscriptions} 
            disabled={isResetting}
            className="flex items-center gap-2"
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reset All Subscriptions
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          Connection debugging tools for resolving real-time data issues
        </div>
      </CardFooter>
    </Card>
  );
}
