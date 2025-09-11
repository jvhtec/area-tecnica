import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { checkDatabaseHealth } from '@/lib/supabaseRetry';

export const DatabaseHealthIndicator = () => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const healthy = await checkDatabaseHealth();
      setIsHealthy(healthy);
      setLastCheck(new Date());
    } catch (error) {
      setIsHealthy(false);
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Check health every 2 minutes
    const interval = setInterval(checkHealth, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (isHealthy === null && !isChecking) {
    return null; // Don't show anything initially
  }

  if (isHealthy === true) {
    return null; // Don't show when everything is working
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          {isChecking ? (
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          ) : isHealthy === false ? (
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              {isChecking 
                ? "Checking database connection..." 
                : isHealthy === false 
                ? "Database connectivity issues detected"
                : "Database connection restored"
              }
            </p>
            {!isChecking && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {isHealthy === false 
                  ? "Some features may be temporarily unavailable. Data will sync when connection is restored."
                  : lastCheck && `Last checked: ${lastCheck.toLocaleTimeString()}`
                }
              </p>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={checkHealth}
            disabled={isChecking}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};