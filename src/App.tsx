
import { ThemeProvider } from "./components/theme-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppInit } from "@/components/AppInit";
import { queryClient } from "@/lib/react-query";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { PerformanceMonitor } from "@/components/dev/PerformanceMonitor";
import router from "@/routes";
import { RouterProvider } from "react-router-dom";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <SubscriptionProvider>
          <AppInit />
          <RouterProvider router={router} />
          <Toaster />
          {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
        </SubscriptionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
