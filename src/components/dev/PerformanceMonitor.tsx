
import { useEffect, useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowRight, XCircle, MinusCircle, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { Badge } from '../ui/badge';

// Define a limited PerformanceEntry type that only contains fields we need
interface SimplePerformanceEntry {
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
}

// Define a limited Performance type to avoid TypeScript error
interface SimplePerformance {
  getEntriesByType(type: string): SimplePerformanceEntry[];
  getEntriesByName(name: string): SimplePerformanceEntry[];
}

// Define Memory Info type for memory usage
interface MemoryInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

export function PerformanceMonitor() {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('resources');
  const [resourceMetrics, setResourceMetrics] = useState<SimplePerformanceEntry[]>([]);
  const [apiRequests, setApiRequests] = useState<any[]>([]);
  const [memoryUsage, setMemoryUsage] = useState<MemoryInfo>({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0
  });
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [networkLatency, setNetworkLatency] = useState<number>(0);
  const [frameRate, setFrameRate] = useState<number>(60);
  const [cpuHistory, setCpuHistory] = useState<Array<{ time: string; usage: number }>>([]);
  const [memoryHistory, setMemoryHistory] = useState<Array<{ time: string; used: number; total: number }>>([]);

  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const requestInterceptorInstalled = useRef(false);

  // Install fetch interceptor
  useEffect(() => {
    if (requestInterceptorInstalled.current) return;
    requestInterceptorInstalled.current = true;

    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      // Start time
      const startTime = performance.now();
      
      let url = '';
      let method = 'GET';
      
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Request) {
        url = input.url;
        method = input.method;
      }
      
      try {
        // Execute the original fetch
        const response = await originalFetch(input, init);
        
        // Calculate duration
        const duration = performance.now() - startTime;
        
        // Add to metrics if it's not a static asset (images, etc.)
        if (!url.match(/\.(jpeg|jpg|gif|png|svg|woff|woff2|ttf|eot)$/)) {
          setApiRequests(prev => [
            ...prev.slice(-19),
            {
              url,
              method,
              status: response.status,
              duration,
              timestamp: new Date().toISOString()
            }
          ]);
        }
        
        return response;
      } catch (error) {
        // Calculate duration even for errors
        const duration = performance.now() - startTime;
        
        setApiRequests(prev => [
          ...prev.slice(-19),
          {
            url,
            method,
            status: 'ERROR',
            duration,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        ]);
        
        throw error;
      }
    };
  }, []);

  // Monitor frame rate
  useEffect(() => {
    let frameId: number;
    
    const measureFrameRate = (timestamp: number) => {
      frameCountRef.current++;
      
      // Every second, calculate FPS
      if (timestamp - lastFrameTimeRef.current >= 1000) {
        setFrameRate(frameCountRef.current);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = timestamp;
      }
      
      frameId = requestAnimationFrame(measureFrameRate);
    };
    
    frameId = requestAnimationFrame(measureFrameRate);
    
    return () => cancelAnimationFrame(frameId);
  }, []);
  
  // Collect performance metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      try {
        // Memory usage (if available)
        const perf = window.performance as unknown as SimplePerformance;
        
        // Resource timing metrics
        const resources = perf.getEntriesByType('resource');
        setResourceMetrics(resources as SimplePerformanceEntry[]);
        
        // Memory usage estimation
        setMemoryUsage({
          usedJSHeapSize: (performance as any).memory?.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit
        });
        
        // CPU usage estimation (based on task delay)
        const start = performance.now();
        setTimeout(() => {
          const taskDelay = performance.now() - start - 10;
          const estimatedCpuUsage = Math.min(100, Math.max(0, taskDelay / 5 * 100));
          setCpuUsage(estimatedCpuUsage);
          
          // Add to history
          const time = new Date().toLocaleTimeString();
          setCpuHistory(prev => [
            ...prev.slice(-10),
            { time, usage: Math.round(estimatedCpuUsage) }
          ]);
          
          // Memory history
          if ((performance as any).memory) {
            const used = Math.round(((performance as any).memory.usedJSHeapSize / 1024 / 1024) * 10) / 10;
            const total = Math.round(((performance as any).memory.totalJSHeapSize / 1024 / 1024) * 10) / 10;
            
            setMemoryHistory(prev => [
              ...prev.slice(-10),
              { time, used, total }
            ]);
          }
        }, 10);
        
        // Network latency check
        if (navigator.onLine) {
          const latencyStart = performance.now();
          fetch('/favicon.ico', { cache: 'no-cache', method: 'HEAD' })
            .then(() => {
              setNetworkLatency(performance.now() - latencyStart);
            })
            .catch(() => {
              // Ignore errors
            });
        }
      } catch (error) {
        console.error("Error collecting performance metrics:", error);
      }
    };
    
    // Initial update
    updateMetrics();
    
    // Update every 2 seconds
    const intervalId = setInterval(updateMetrics, 2000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Detect slow resources
  const slowResources = resourceMetrics
    .filter(r => r.duration > 500)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  // Format bytes to readable size
  const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (!expanded) {
    return (
      <div 
        className="fixed bottom-0 right-0 m-2 p-2 bg-secondary/80 rounded-md shadow-md flex items-center gap-2 text-xs cursor-pointer backdrop-blur-sm"
        onClick={() => setExpanded(true)}
      >
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="h-4">DEV</Badge>
            <ChevronUp size={12} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-0 right-0 w-[350px] m-2 shadow-lg bg-background/95 backdrop-blur-sm z-50 text-xs overflow-hidden">
      <CardHeader className="p-3 pb-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline">DEV</Badge>
              Performance Monitor
            </CardTitle>
            <CardDescription className="text-xs">
              CPU: {Math.round(cpuUsage)}% | Memory: {formatBytes(memoryUsage.usedJSHeapSize)} | FPS: {frameRate}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0" 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
          >
            <MinusCircle size={14} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-7 text-[0.7rem]">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resources" className="mt-2">
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[0.65rem] mb-1">
                  <span>CPU Usage</span>
                  <span>{Math.round(cpuUsage)}%</span>
                </div>
                <Progress 
                  value={cpuUsage} 
                  className="h-2" 
                  indicatorClassName={
                    cpuUsage > 80 ? "bg-destructive" : (cpuUsage > 50 ? "bg-warning" : "bg-success")
                  } 
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[0.65rem] mb-1">
                  <span>Memory Usage</span>
                  <span>{formatBytes(memoryUsage.usedJSHeapSize)} / {formatBytes(memoryUsage.totalJSHeapSize)}</span>
                </div>
                <Progress 
                  value={memoryUsage.usedJSHeapSize ? (memoryUsage.usedJSHeapSize / memoryUsage.totalJSHeapSize! * 100) : 0} 
                  className="h-2" 
                  indicatorClassName={
                    memoryUsage.usedJSHeapSize && (memoryUsage.usedJSHeapSize / memoryUsage.totalJSHeapSize! > 0.8) 
                      ? "bg-destructive" 
                      : (memoryUsage.usedJSHeapSize && memoryUsage.usedJSHeapSize / memoryUsage.totalJSHeapSize! > 0.6 
                        ? "bg-warning" 
                        : "bg-success")
                  }
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[0.65rem] mb-1">
                  <span>Frame Rate</span>
                  <span>{frameRate} FPS</span>
                </div>
                <Progress 
                  value={frameRate / 60 * 100} 
                  className="h-2" 
                  indicatorClassName={frameRate < 30 ? "bg-destructive" : (frameRate < 50 ? "bg-warning" : "bg-success")} 
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[0.65rem] mb-1">
                  <span>Network Latency</span>
                  <span>{Math.round(networkLatency)}ms</span>
                </div>
                <Progress 
                  value={100 - Math.min(100, networkLatency / 5)} 
                  className="h-2" 
                  indicatorClassName={
                    networkLatency > 300 ? "bg-destructive" : (networkLatency > 100 ? "bg-warning" : "bg-success")
                  } 
                />
              </div>
              
              <div className="mt-3">
                <h4 className="text-[0.7rem] font-medium mb-1">Slow Resources</h4>
                {slowResources.length > 0 ? (
                  <div className="space-y-1">
                    {slowResources.map((resource, i) => (
                      <div key={i} className="flex justify-between items-center text-[0.65rem]">
                        <span className="truncate w-3/4" title={resource.name}>
                          {resource.name.split('/').pop()}
                        </span>
                        <Badge variant="outline" className={
                          resource.duration > 1000 ? "bg-destructive/20" : "bg-warning/20"
                        }>
                          {Math.round(resource.duration)}ms
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-[0.65rem]">
                    No slow resources detected
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="network" className="mt-2 max-h-[200px] overflow-y-auto">
            <div className="space-y-2">
              <h4 className="text-[0.7rem] font-medium">Recent API Requests</h4>
              {apiRequests.length > 0 ? (
                <div className="space-y-1">
                  {apiRequests.slice().reverse().map((request, i) => (
                    <div key={i} className="flex flex-col gap-0.5 pb-1 border-b border-muted">
                      <div className="flex justify-between items-center text-[0.65rem]">
                        <span className="truncate w-3/4" title={request.url}>
                          {request.url.split('/').slice(-2).join('/')}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge variant={
                            request.status >= 400 || request.status === 'ERROR' ? 'destructive' : 'outline'
                          } className="h-4 text-[0.6rem]">
                            {request.status}
                          </Badge>
                          <Badge variant="outline" className={
                            request.duration > 1000 ? "bg-destructive/20" : (
                              request.duration > 500 ? "bg-warning/20" : "bg-success/20"
                            )
                          } className="h-4 text-[0.6rem]">
                            {Math.round(request.duration)}ms
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[0.6rem]">
                        <span>{request.method}</span>
                        <span>{new Date(request.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-[0.65rem]">
                  No API requests captured yet
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="charts" className="mt-2">
            <div className="space-y-3">
              <div>
                <h4 className="text-[0.7rem] font-medium mb-1">CPU Usage Over Time</h4>
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cpuHistory}>
                      <Line 
                        type="monotone" 
                        dataKey="usage" 
                        stroke="#0ea5e9" 
                        strokeWidth={1.5} 
                        dot={false}
                        isAnimationActive={false}
                      />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 8 }} 
                        tickFormatter={() => ''} 
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tick={{ fontSize: 8 }} 
                        width={20}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <Tooltip 
                        formatter={(value) => [`${value}%`, 'CPU']}
                        labelFormatter={(label) => `Time: ${label}`}
                        contentStyle={{ fontSize: '10px', padding: '2px 4px' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div>
                <h4 className="text-[0.7rem] font-medium mb-1">Memory Usage Over Time</h4>
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={memoryHistory}>
                      <Line 
                        type="monotone" 
                        dataKey="used" 
                        name="Used Memory"
                        stroke="#0ea5e9" 
                        strokeWidth={1.5} 
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        name="Total Memory"
                        stroke="#94a3b8" 
                        strokeWidth={1} 
                        dot={false}
                        isAnimationActive={false}
                        strokeDasharray="3 3"
                      />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 8 }} 
                        tickFormatter={() => ''}
                      />
                      <YAxis 
                        tick={{ fontSize: 8 }}
                        width={20} 
                        tickFormatter={(value) => `${value}MB`}
                      />
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <Tooltip 
                        formatter={(value) => [`${value} MB`, '']}
                        labelFormatter={(label) => `Time: ${label}`}
                        contentStyle={{ fontSize: '10px', padding: '2px 4px' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
