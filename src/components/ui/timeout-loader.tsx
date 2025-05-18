
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TimeoutLoaderProps {
  isLoading: boolean;
  timeout?: number;  // Timeout in milliseconds (default: 15000 - 15 seconds)
  message?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function TimeoutLoader({
  isLoading,
  timeout = 15000,
  message = "Loading is taking longer than expected",
  onRetry,
  children
}: TimeoutLoaderProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Reset the timeout whenever loading state changes
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    // If we're loading, set a new timeout
    if (isLoading) {
      setHasTimedOut(false);
      
      // Set timeout to show a message if loading takes too long
      const id = window.setTimeout(() => {
        if (isLoading) {
          setHasTimedOut(true);
          toast.warning("Loading data is taking longer than expected", {
            description: "Network might be slow or disconnected"
          });
        }
      }, timeout);
      
      setTimeoutId(Number(id));
    }
    
    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, timeout]);

  // Handle retry
  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
      toast.success("Retry successful");
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Retry failed", {
        description: "Please check your network connection"
      });
    } finally {
      setIsRetrying(false);
      setHasTimedOut(false);
    }
  };

  // Show loading indicator for normal loading states
  if (isLoading && !hasTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  // Show timeout message with retry button when loading takes too long
  if (isLoading && hasTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[200px] border border-dashed border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
        <AlertCircle className="h-8 w-8 text-yellow-500 mb-4" />
        <h3 className="font-semibold mb-2">Taking longer than expected</h3>
        <p className="text-muted-foreground text-center mb-4">{message}</p>
        {onRetry && (
          <Button 
            variant="outline" 
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-2"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  // If not loading, show the children
  return <>{children}</>;
}
