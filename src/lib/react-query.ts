
import { QueryClient } from "@tanstack/react-query";
import { SubscriptionManager } from "@/lib/subscription-manager";

export const setupReactQuery = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    },
  });
  
  // Initialize the subscription manager
  const subscriptionManager = SubscriptionManager.getInstance(queryClient);
  
  // Set up global refetch strategies
  subscriptionManager.setupVisibilityBasedRefetching();
  subscriptionManager.setupNetworkStatusRefetching();
  
  // Set up core tables that most pages need
  subscriptionManager.subscribeToTable('profiles', 'profiles');
  subscriptionManager.subscribeToTable('jobs', 'jobs');
  
  return { queryClient, subscriptionManager };
};

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    },
  });
};
