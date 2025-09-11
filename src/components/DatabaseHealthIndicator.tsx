import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { checkDatabaseHealth } from '@/lib/emergency-database-client';

export const DatabaseHealthIndicator = () => {
  const [healthStatus, setHealthStatus] = useState<{
    isHealthy: boolean | null;
    responseTime: number;
    connectionStats: any;
  }>({
    isHealthy: null,
    responseTime: 0,
    connectionStats: {}
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  
  // Force refresh to clear any cached references

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const result = await checkDatabaseHealth();
      setHealthStatus(result);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        isHealthy: false,
        responseTime: 0,
        connectionStats: {}
      });
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check and set up interval (less frequent in emergency mode)
  useEffect(() => {
    checkHealth();
    
    const interval = setInterval(checkHealth, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Show emergency mode alert
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Emergency Mode Active</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <div className="space-y-2">
          <span>
            Real-time features disabled to restore database performance.
          </span>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Health: {healthStatus.isHealthy === null ? 'Checking...' : healthStatus.isHealthy ? 'OK' : 'Issues Detected'}</div>
            <div>Response Time: {healthStatus.responseTime}ms</div>
            <div>Active Connections: {healthStatus.connectionStats?.activeConnections || 0}/{healthStatus.connectionStats?.maxConnections || 3}</div>
            {lastCheck && (
              <div>Last Check: {lastCheck.toLocaleTimeString()}</div>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkHealth}
          disabled={isChecking}
        >
          {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Check
        </Button>
      </AlertDescription>
    </Alert>
  );
};