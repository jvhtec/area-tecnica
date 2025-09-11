/**
 * Network utility functions for handling connection issues and retries
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry certain types of errors
      if (isNonRetryableError(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const totalDelay = delay + jitter;
      
      console.log(`Retrying in ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  throw lastError;
}

/**
 * Check if an error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  // Don't retry authentication errors
  if (error?.message?.includes('JWTIssuedAtFuture')) return true;
  if (error?.message?.includes('expired')) return true;
  if (error?.message?.includes('invalid')) return true;
  
  // Don't retry 4xx errors (except 408, 429)
  if (error?.status >= 400 && error?.status < 500) {
    return error.status !== 408 && error.status !== 429;
  }
  
  return false;
}

/**
 * Check if the network is available
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network to come back online
 */
export function waitForOnline(timeout: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', onOnline);
      resolve(false);
    }, timeout);
    
    const onOnline = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', onOnline);
      resolve(true);
    };
    
    window.addEventListener('online', onOnline);
  });
}

/**
 * Enhanced fetch with retry and network awareness
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    // Check if we're online before attempting
    if (!isOnline()) {
      throw new Error('Network offline');
    }
    
    const response = await fetch(url, options);
    
    // Throw for server errors to trigger retry
    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  }, retryOptions);
}