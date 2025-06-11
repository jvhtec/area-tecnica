
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LoaderIcon, AlertCircle } from 'lucide-react';

interface TimeoutLoaderProps {
  /** Duration in ms before showing timeout UI */
  timeout?: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError?: boolean;
  /** Error message */
  error?: Error | null;
  /** Additional loading message */
  message?: string;
  /** Function to call on retry */
  onRetry?: () => void;
  /** Duration scaling factor on each retry */
  backoffFactor?: number;
  /** Maximum timeout value */
  maxTimeout?: number;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Component to render when timed out but not error */
  timeoutComponent?: React.ReactNode;
}

/**
 * TimeoutLoader - Enhanced loading component with timeout detection and retry
 */
export function TimeoutLoader({
  timeout = 10000,
  isLoading,
  isError = false,
  error,
  message = "Loading data...",
  onRetry,
  backoffFactor = 1.5,
  maxTimeout = 30000,
  loadingComponent,
  timeoutComponent,
}: TimeoutLoaderProps) {
  const [showTimeout, setShowTimeout] = useState(false);
  const [timeoutDuration, setTimeoutDuration] = useState(timeout);
  const [retryCount, setRetryCount] = useState(0);
  
  // Reset timeout state when loading state changes
  useEffect(() => {
    if (isLoading) {
      setShowTimeout(false);
      const timer = setTimeout(() => {
        if (isLoading) {
          setShowTimeout(true);
        }
      }, timeoutDuration);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, timeoutDuration]);
  
  // Handle retry with exponential backoff
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
      setRetryCount(prev => prev + 1);
      
      // Calculate new timeout with backoff
      const newTimeout = Math.min(
        timeout * Math.pow(backoffFactor, retryCount),
        maxTimeout
      );
      setTimeoutDuration(newTimeout);
      
      // Reset timeout UI
      setShowTimeout(false);
    }
  }, [onRetry, retryCount, timeout, backoffFactor, maxTimeout]);
  
  // Default loading component
  const defaultLoadingComponent = (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-spin mb-4">
        <LoaderIcon className="h-8 w-8" />
      </div>
      <p className="text-muted-foreground">{message}</p>
      {retryCount > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          Retry attempt: {retryCount}
        </p>
      )}
    </div>
  );
  
  // Default timeout component
  const defaultTimeoutComponent = (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Taking longer than expected</AlertTitle>
        <AlertDescription>
          This is taking longer than usual. The connection might be slow.
        </AlertDescription>
      </Alert>
      <Button onClick={handleRetry} variant="outline" className="mt-4">
        <LoaderIcon className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
  
  // Error component
  const errorComponent = (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Alert className="mb-4 border-destructive">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          {error?.message || "Something went wrong. Please try again."}
        </AlertDescription>
      </Alert>
      <Button onClick={handleRetry} variant="outline" className="mt-4">
        <LoaderIcon className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
  
  if (isError) {
    return errorComponent;
  }
  
  if (isLoading && !showTimeout) {
    return loadingComponent || defaultLoadingComponent;
  }
  
  if (isLoading && showTimeout) {
    return timeoutComponent || defaultTimeoutComponent;
  }
  
  return null;
}
