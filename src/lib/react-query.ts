import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1, // Retry failed queries only once
      refetchOnWindowFocus: true, // Refetch data when the window is refocused
      refetchOnMount: true, // Refetch data when the component is remounted
    },
  },
});