// This is just an example modification - adjust to match your actual App.tsx structure
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/react-query";
import { AppRoutes } from "./AppRoutes";
import { Toaster as SonnerToaster } from "sonner";
import { ConnectionProvider } from "./providers/ConnectionProvider";

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <AppRoutes />
          <Toaster />
          <SonnerToaster position="top-right" />
        </ConnectionProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
