
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { Toaster } from "sonner";
import "./App.css";
import { AppInit } from "@/components/AppInit";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <AppInit />
        <Toaster position="top-right" />
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

export default App;
