
import { QueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "./unified-subscription-manager";

// Re-export the UnifiedSubscriptionManager as SubscriptionManager for backward compatibility
export const SubscriptionManager = UnifiedSubscriptionManager;

// Export a helper to get the instance
export const getSubscriptionManager = (queryClient: QueryClient) => {
  return UnifiedSubscriptionManager.getInstance(queryClient);
};
