
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/react-query";
import { AppRoutes } from "./AppRoutes";
import { Toaster as SonnerToaster } from "sonner";
import { ConnectionProvider } from "./providers/ConnectionProvider";
import { AuthProvider } from "./hooks/useAuth";

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster />
            <SonnerToaster position="top-right" />
          </AuthProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
