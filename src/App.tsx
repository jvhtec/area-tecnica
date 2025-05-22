import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppInit } from "@/components/AppInit";
import { queryClient } from "@/lib/react-query";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { PerformanceMonitor } from "@/components/dev/PerformanceMonitor";
import { Routes } from "@/routes";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
          <SubscriptionProvider>
            <AppInit />
            <Routes />
            <Toaster />
            {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
          </SubscriptionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
