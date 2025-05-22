
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  description: string;
}

interface NetworkCall {
  url: string;
  method: string;
  duration: number;
  timestamp: number;
  status: number;
  size: number;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [networkCalls, setNetworkCalls] = useState<NetworkCall[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { subscriptionsByTable } = useSubscriptionContext();
  
  // Collect performance metrics
  useEffect(() => {
    const gatherMetrics = () => {
      if (!performance || !performance.memory) return;
      
      const memory = (performance as any).memory;
      
      const newMetrics: PerformanceMetric[] = [
        {
          name: "JS Heap Size",
          value: Math.round(memory.usedJSHeapSize / (1024 * 1024) * 10) / 10,
          unit: "MB",
          threshold: memory.jsHeapSizeLimit / (1024 * 1024) / 2,
          description: "Memory used by JavaScript objects"
        },
        {
          name: "DOM Nodes",
          value: document.querySelectorAll('*').length,
          unit: "nodes",
          threshold: 1500,
          description: "Total number of DOM elements"
        },
        {
          name: "Active Subscriptions",
          value: Object.values(subscriptionsByTable).reduce((acc, val) => acc + val.length, 0),
          unit: "subs",
          threshold: 20,
          description: "Number of active Supabase realtime subscriptions"
        }
      ];
      
      setMetrics(newMetrics);
    };
    
    // Gather initial metrics
    gatherMetrics();
    
    // Set up interval to update metrics
    const intervalId = setInterval(gatherMetrics, 5000);
    
    // Monitor network calls
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const startTime = performance.now();
      
      try {
        const response = await originalFetch.apply(this, [input, init]);
        
        // Clone the response to get its size and status
        const clone = response.clone();
        const blob = await clone.blob();
        
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method || (typeof input !== 'string' && input.method) || 'GET';
        
        // Add to network calls
        setNetworkCalls(prev => [{
          url,
          method,
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          status: response.status,
          size: blob.size
        }, ...prev.slice(0, 19)]); // Keep last 20 calls
        
        return response;
      } catch (error) {
        // Also track failed requests
        setNetworkCalls(prev => [{
          url: typeof input === 'string' ? input : input.url,
          method: init?.method || (typeof input !== 'string' && input.method) || 'GET',
          duration: performance.now() - startTime,
          timestamp: Date.now(),
          status: 0,
          size: 0
        }, ...prev.slice(0, 19)]);
        
        throw error;
      }
    };
    
    // Add keyboard shortcut to toggle visibility (Ctrl+Shift+P)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      clearInterval(intervalId);
      window.fetch = originalFetch;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [subscriptionsByTable]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 shadow-lg">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Performance Monitor</CardTitle>
            <Badge variant="outline">DEV</Badge>
          </div>
          <CardDescription className="text-xs">
            Press Ctrl+Shift+P to toggle
          </CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="metrics">
          <CardContent className="pt-2 pb-0">
            <TabsList className="w-full">
              <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
              <TabsTrigger value="network" className="text-xs">Network</TabsTrigger>
              <TabsTrigger value="subscriptions" className="text-xs">Subscriptions</TabsTrigger>
            </TabsList>
          </CardContent>
          
          <TabsContent value="metrics" className="m-0">
            <CardContent className="space-y-3">
              {metrics.map((metric) => (
                <div key={metric.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">{metric.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {metric.value} {metric.unit}
                    </div>
                  </div>
                  <Progress 
                    value={Math.min((metric.value / metric.threshold) * 100, 100)} 
                    className="h-1"
                    indicatorClassName={metric.value > metric.threshold ? "bg-destructive" : undefined}
                  />
                  <div className="text-[10px] text-muted-foreground">
                    {metric.description}
                  </div>
                </div>
              ))}
            </CardContent>
          </TabsContent>
          
          <TabsContent value="network" className="m-0 p-0">
            <CardContent className="px-2 py-1">
              <div className="max-h-60 overflow-y-auto text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] text-muted-foreground">
                      <th className="py-1 px-2 text-left">Endpoint</th>
                      <th className="py-1 px-2 text-right">Time</th>
                      <th className="py-1 px-2 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkCalls.map((call, i) => {
                      const urlObj = new URL(call.url);
                      const path = urlObj.pathname;
                      
                      return (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-1 px-2">
                            <div className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className={`text-[9px] w-12 flex justify-center ${
                                  call.status >= 400 ? 'bg-destructive/10 text-destructive' : 
                                  call.status >= 300 ? 'bg-yellow-500/10 text-yellow-500' :
                                  'bg-green-500/10 text-green-500'
                                }`}
                              >
                                {call.method}
                              </Badge>
                              <span className="truncate inline-block w-32">{path}</span>
                            </div>
                          </td>
                          <td className="py-1 px-2 text-right tabular-nums">
                            {call.duration.toFixed(0)} ms
                          </td>
                          <td className="py-1 px-2 text-right tabular-nums">
                            {(call.size / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      );
                    })}
                    
                    {networkCalls.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-muted-foreground">
                          No network calls recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="subscriptions" className="m-0">
            <CardContent className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(subscriptionsByTable).length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No active subscriptions
                </div>
              ) : (
                Object.entries(subscriptionsByTable).map(([table, subs]) => (
                  <div key={table} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium">{table}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {subs.length} {subs.length === 1 ? 'sub' : 'subs'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
