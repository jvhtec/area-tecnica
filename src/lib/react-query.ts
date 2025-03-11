import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // Standardize to 2 minutes (from 30 seconds)
      retry: 2, // Increase retry attempts from 1 to 2
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with max of 30 seconds
      refetchOnWindowFocus: true, // Keep existing setting
      refetchOnMount: true, // Keep existing setting
    },
  },
});

// Custom hooks for specific data types with appropriate overrides
export const useEntityQuery = <T>(
  entityType: string,
  id: string,
  options?: any // Using any temporarily for compatibility
) => {
  return {
    queryKey: [entityType, id],
    queryFn: () => fetchEntity(entityType, id),
    ...options,
  };
};

// Placeholder function to be implemented or replaced with actual API call
const fetchEntity = async <T>(entityType: string, id: string): Promise<T> => {
  // This would be replaced with actual implementation using the ApiService
  throw new Error("fetchEntity not implemented");
};
