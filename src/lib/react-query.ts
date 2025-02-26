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
      staleTime: 1000 * 60, // 1 minute - increased from 30s for better performance
      cacheTime: 1000 * 60 * 5, // 5 minutes - how long to keep inactive data in cache
      retry: (failureCount, error) => {
        // Don't retry auth errors - better to handle through session management
        if (isAuthError(error)) return false;
        
        // Retry other errors with exponential backoff, max 3 retries
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff with 30s max
      refetchOnWindowFocus: 'always', // Always refetch on focus for fresher data
      refetchOnMount: 'always', // Always refetch on mount for consistency
      refetchOnReconnect: true, // Refetch when reconnecting to network
      refetchInterval: false, // Don't poll by default (enable for specific queries)
      // When components unmount/remount, optimistically reuse stale data while refreshing
      keepPreviousData: true,
      // Improved error handling
      onError: (error) => {
        console.error('Query error:', error);
        // You could add global error tracking/reporting here
      },
    },
    mutations: {
      // Better defaults for mutations
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        // You could add global error tracking/reporting here
      },
    },
  },
});

// Useful utility to trigger refetch across multiple queries
export const refetchAuthenticatedQueries = () => {
  // This helps when session is refreshed and you need to update multiple queries
  return queryClient.invalidateQueries({
    predicate: (query) => {
      // Target only authenticated endpoints - customize this pattern to match your API structure
      return query.queryKey[0] !== 'public' && 
             typeof query.queryKey[0] === 'string' && 
             !query.queryKey[0].startsWith('public-');
    },
  });
};

// Additional helper to clear sensitive queries on logout
export const clearAuthenticatedCache = () => {
  return queryClient.clear();
  // For more selective clearing:
  // return queryClient.removeQueries({
  //   predicate: (query) => {
  //     return query.queryKey[0] !== 'public' && 
  //            typeof query.queryKey[0] === 'string' && 
  //            !query.queryKey[0].startsWith('public-');
  //   },
  // });
};