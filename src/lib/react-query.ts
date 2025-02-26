import { QueryClient } from "@tanstack/react-query";

// Function to determine if a query error is auth-related
const isAuthError = (error: unknown): boolean => {
  // Handle typical auth error patterns
  if (error instanceof Error) {
    // Check for common auth error messages or status codes
    const message = error.message.toLowerCase();
    const isAuthMessage = 
      message.includes('unauthorized') || 
      message.includes('unauthenticated') || 
      message.includes('auth') || 
      message.includes('token') ||
      message.includes('401') ||
      message.includes('403');
      
    return isAuthMessage;
  }
  
  // Check for error objects with status or statusCode
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as any).status;
    return status === 401 || status === 403;
  }
  
  return false;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // Back to 30 seconds as in original
      cacheTime: 1000 * 60 * 10, // 10 minutes - keep data longer in cache
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (isAuthError(error)) return false;
        
        // Only retry once for other errors (same as original)
        return failureCount < 1;
      },
      retryDelay: attempt => Math.min(1000 * (attempt + 1), 3000), // Gentler backoff
      refetchOnWindowFocus: true, // Back to original setting
      refetchOnMount: true, // Back to original setting
      refetchOnReconnect: true, // Still useful for network changes
      // Don't use keepPreviousData globally - can cause stale UI
      keepPreviousData: false,
      // Improved error handling
      onError: (error) => {
        console.error('Query error:', error);
      },
    },
    mutations: {
      // Better defaults for mutations
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Selective refetch for authenticated queries - use sparingly
export const refetchAuthenticatedQueries = () => {
  return queryClient.invalidateQueries({
    // Only invalidate queries that specifically need refreshing after auth changes
    predicate: (query) => {
      const queryKey = query.queryKey;
      // Target only queries that depend on authentication
      // Customize this pattern to match only critical auth-dependent queries
      return Array.isArray(queryKey) && 
             queryKey.length > 0 && 
             typeof queryKey[0] === 'string' && 
             queryKey[0].startsWith('auth-');
    },
  });
};

// Clear cache on logout
export const clearAuthenticatedCache = () => {
  // More selective clearing to prevent UI flashing
  return queryClient.removeQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return Array.isArray(queryKey) && 
             queryKey.length > 0 && 
             typeof queryKey[0] === 'string' && 
             !queryKey[0].startsWith('public-');
    },
  });
};