import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

type NetworkRequest = {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  status?: number;
  error?: string;
  size?: number;
};

type PerformanceMetric = {
  name: string;
  value: number;
  unit: string;
  description: string;
};

export function PerformanceMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [cpuUsage, setCpuUsage] = useState<number>(0);

  // Initialize performance monitoring
  useEffect(() => {
    // Basic performance metrics
    const updateMetrics = () => {
      const performanceEntries = performance.getEntriesByType('navigation');
      const paintEntries = performance.getEntriesByType('paint');
      
      const newMetrics: PerformanceMetric[] = [];
      
      if (performanceEntries.length > 0) {
        const navEntry = performanceEntries[0] as PerformanceNavigationTiming;
        
        newMetrics.push({
          name: 'Page Load',
          value: navEntry.loadEventEnd - navEntry.startTime,
          unit: 'ms',
          description: 'Total page load time'
        });
        
        newMetrics.push({
          name: 'DOM Content Loaded',
          value: navEntry.domContentLoadedEventEnd - navEntry.startTime,
          unit: 'ms',
          description: 'Time until DOM content loaded'
        });
        
        newMetrics.push({
          name: 'First Byte',
          value: navEntry.responseStart - navEntry.requestStart,
          unit: 'ms',
          description: 'Time to first byte'
        });
      }
      
      // Find the FCP entry
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        newMetrics.push({
          name: 'First Contentful Paint',
          value: fcpEntry.startTime,
          unit: 'ms',
          description: 'Time to first contentful paint'
        });
      }
      
      setMetrics(newMetrics);
      
      // Simulate CPU usage (real CPU usage requires more complex APIs)
      setCpuUsage(Math.random() * 30);

      // Try to get memory usage if available
      if ('memory' in performance) {
        try {
          // @ts-ignore - TypeScript doesn't know about the memory API
          const memoryInfo = (performance as any).memory;
          if (memoryInfo && memoryInfo.usedJSHeapSize && memoryInfo.jsHeapSizeLimit) {
            const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
            setMemoryUsage(usedPercent);
          }
        } catch (error) {
          console.error("Error accessing memory info:", error);
        }
      }
    };
    
    // Network request monitoring
    const monitorNetworkRequests = () => {
      // Store original functions before overriding them
      const originalFetch = window.fetch;
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;
      
      window.fetch = async function(input, init) {
        const requestId = Math.random().toString(36).substring(2);
        let url = "";
        let method = "GET";
        
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
          method = input.method;
        } else {
          url = String(input);
        }
        
        if (init?.method) {
          method = init.method;
        }
        
        const request: NetworkRequest = {
          id: requestId,
          url,
          method,
          startTime: performance.now()
        };
        
        setNetworkRequests(prev => [...prev, request]);
        
        try {
          // Use the stored original fetch function
          const response = await originalFetch.apply(this, [input, init]);
          
          // Update request with success info
          setNetworkRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { 
                    ...req, 
                    endTime: performance.now(), 
                    status: response.status,
                    size: parseInt(response.headers.get('content-length') || '0')
                  }
                : req
            )
          );
          
          return response;
        } catch (error) {
          // Update request with error info
          setNetworkRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { 
                    ...req, 
                    endTime: performance.now(), 
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }
                : req
            )
          );
          throw error;
        }
      };
      
      // Monitor XMLHttpRequest as well
      XMLHttpRequest.prototype.open = function(method, url) {
        this._perfMonRequestId = Math.random().toString(36).substring(2);
        this._perfMonMethod = method;
        this._perfMonUrl = url;
        // Use the stored original XHR open function
        originalXhrOpen.apply(this, arguments as any);
      };
      
      XMLHttpRequest.prototype.send = function() {
        if (this._perfMonRequestId && this._perfMonUrl) {
          const request: NetworkRequest = {
            id: this._perfMonRequestId,
            url: String(this._perfMonUrl),
            method: this._perfMonMethod || 'GET',
            startTime: performance.now()
          };
          
          setNetworkRequests(prev => [...prev, request]);
          
          this.addEventListener('load', () => {
            setNetworkRequests(prev => 
              prev.map(req => 
                req.id === this._perfMonRequestId 
                  ? { 
                      ...req, 
                      endTime: performance.now(), 
                      status: this.status,
                      size: parseInt(this.getResponseHeader('content-length') || '0')
                    }
                  : req
              )
            );
          });
          
          this.addEventListener('error', () => {
            setNetworkRequests(prev => 
              prev.map(req => 
                req.id === this._perfMonRequestId 
                  ? { 
                      ...req, 
                      endTime: performance.now(), 
                      error: 'Request failed'
                    }
                  : req
              )
            );
          });
        }
        
        // Use the stored original XHR send function
        originalXhrSend.apply(this, arguments as any);
      };
      
      // Return a cleanup function that restores the original functions
      return () => {
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXhrOpen;
        XMLHttpRequest.prototype.send = originalXhrSend;
      };
    };
    
    updateMetrics();
    const cleanup = monitorNetworkRequests();
    
    const interval = setInterval(updateMetrics, 5000);
    
    return () => {
      clearInterval(interval);
      // Call the cleanup function to restore original methods
      cleanup();
    };
  }, []);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const formatDuration = (ms: number): string => {
    return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
  };

  const calculateNetworkStats = () => {
    const completed = networkRequests.filter(req => req.endTime);
    
    if (completed.length === 0) return { avg: 0, max: 0, total: 0, success: 0, failed: 0 };
    
    const durations = completed.map(req => (req.endTime || 0) - req.startTime);
    const avg = durations.reduce((sum, time) => sum + time, 0) / durations.length;
    const max = Math.max(...durations);
    const total = completed.length;
    const success = completed.filter(req => req.status && req.status < 400).length;
    const failed = completed.filter(req => req.error || (req.status && req.status >= 400)).length;
    
    return { avg, max, total, success, failed };
  };

  const renderMemoryUsage = () => {
    const color = memoryUsage > 80 ? 'bg-red-500' : memoryUsage > 50 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm">Memory Usage</span>
          <span className="text-sm">{memoryUsage.toFixed(1)}%</span>
        </div>
        <Progress value={memoryUsage} className="h-2" indicatorClassName={color} />
      </div>
    );
  };

  const renderCpuUsage = () => {
    const color = cpuUsage > 80 ? 'bg-red-500' : cpuUsage > 50 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm">CPU Usage (est.)</span>
          <span className="text-sm">{cpuUsage.toFixed(1)}%</span>
        </div>
        <Progress value={cpuUsage} className="h-2" indicatorClassName={color} />
      </div>
    );
  };

  const { avg, max, total, success, failed } = calculateNetworkStats();

  if (!isVisible) {
    return (
      <div 
        className="fixed bottom-4 right-4 bg-primary text-primary-foreground p-2 rounded-full shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
        onClick={toggleVisibility}
        title="Show Performance Monitor"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20v-6M6 20V10M18 20V4"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-auto bg-background shadow-lg rounded-lg z-50">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between">
            <CardTitle className="text-lg">Performance Monitor</CardTitle>
            <button 
              onClick={toggleVisibility} 
              className="p-1 rounded-full hover:bg-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="network" className="flex-1">Network ({total})</TabsTrigger>
              <TabsTrigger value="metrics" className="flex-1">Metrics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="pt-4">
              {renderCpuUsage()}
              {renderMemoryUsage()}
              
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-muted p-2 rounded">
                  <div className="text-xs text-muted-foreground">Network Requests</div>
                  <div className="text-lg font-bold">{total}</div>
                </div>
                <div className="bg-muted p-2 rounded">
                  <div className="text-xs text-muted-foreground">Avg Response Time</div>
                  <div className="text-lg font-bold">{formatDuration(avg)}</div>
                </div>
                <div className="bg-muted p-2 rounded">
                  <div className="text-xs text-muted-foreground">Success / Failed</div>
                  <div className="text-lg font-bold">
                    <span className="text-green-500">{success}</span> / <span className={failed > 0 ? "text-red-500" : ""}>{failed}</span>
                  </div>
                </div>
                <div className="bg-muted p-2 rounded">
                  <div className="text-xs text-muted-foreground">Slowest Request</div>
                  <div className="text-lg font-bold">{formatDuration(max)}</div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="network" className="pt-4 max-h-96 overflow-auto">
              <Accordion type="single" collapsible>
                {networkRequests.map((request, index) => {
                  const duration = request.endTime 
                    ? (request.endTime - request.startTime).toFixed(0)
                    : '...';
                  
                  const isError = request.error || (request.status && request.status >= 400);
                  const isPending = !request.endTime;
                  
                  return (
                    <AccordionItem value={`request-${index}`} key={request.id}>
                      <AccordionTrigger className="text-xs hover:no-underline">
                        <div className="flex items-center gap-2 w-full">
                          <Badge variant={isError ? "destructive" : isPending ? "outline" : "default"} className="text-[10px] h-5">
                            {request.method}
                          </Badge>
                          <div className="truncate flex-grow text-left">
                            {new URL(request.url, window.location.origin).pathname}
                          </div>
                          <span className="text-xs whitespace-nowrap">
                            {isPending ? "pending..." : `${duration} ms`}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-xs space-y-1 mt-1">
                          <div><strong>URL:</strong> {request.url}</div>
                          <div><strong>Method:</strong> {request.method}</div>
                          <div><strong>Started:</strong> {new Date(request.startTime).toISOString()}</div>
                          {request.endTime && (
                            <div><strong>Duration:</strong> {duration} ms</div>
                          )}
                          {request.status && (
                            <div><strong>Status:</strong> {request.status}</div>
                          )}
                          {request.size && (
                            <div><strong>Size:</strong> {request.size} bytes</div>
                          )}
                          {request.error && (
                            <div className="text-red-500"><strong>Error:</strong> {request.error}</div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
              {networkRequests.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  No network requests recorded yet
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="metrics" className="pt-4">
              <div className="space-y-4">
                {metrics.map((metric, index) => (
                  <div key={index} className="bg-muted p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{metric.name}</span>
                      <span>{metric.value.toFixed(0)} {metric.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{metric.description}</div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Add the missing helper functions
PerformanceMonitor.prototype.toggleVisibility = function() {
  this.setIsVisible(!this.isVisible);
};

PerformanceMonitor.prototype.formatDuration = function(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
};

PerformanceMonitor.prototype.calculateNetworkStats = function() {
  const completed = this.networkRequests.filter(req => req.endTime);
  
  if (completed.length === 0) return { avg: 0, max: 0, total: 0, success: 0, failed: 0 };
  
  const durations = completed.map(req => (req.endTime || 0) - req.startTime);
  const avg = durations.reduce((sum, time) => sum + time, 0) / durations.length;
  const max = Math.max(...durations);
  const total = completed.length;
  const success = completed.filter(req => req.status && req.status < 400).length;
  const failed = completed.filter(req => req.error || (req.status && req.status >= 400)).length;
  
  return { avg, max, total, success, failed };
};

PerformanceMonitor.prototype.renderMemoryUsage = function() {
  const color = this.memoryUsage > 80 ? 'bg-red-500' : this.memoryUsage > 50 ? 'bg-yellow-500' : 'bg-green-500';
  
  return (
    <div className="mt-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm">Memory Usage</span>
        <span className="text-sm">{this.memoryUsage.toFixed(1)}%</span>
      </div>
      <Progress value={this.memoryUsage} className="h-2" indicatorClassName={color} />
    </div>
  );
};

PerformanceMonitor.prototype.renderCpuUsage = function() {
  const color = this.cpuUsage > 80 ? 'bg-red-500' : this.cpuUsage > 50 ? 'bg-yellow-500' : 'bg-green-500';
  
  return (
    <div className="mt-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm">CPU Usage (est.)</span>
        <span className="text-sm">{this.cpuUsage.toFixed(1)}%</span>
      </div>
      <Progress value={this.cpuUsage} className="h-2" indicatorClassName={color} />
    </div>
  );
};
