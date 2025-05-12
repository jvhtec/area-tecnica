
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/react-query";
import App from './App.tsx';
import './index.css';
import { SubscriptionProvider } from './providers/SubscriptionProvider';

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <App />
    </SubscriptionProvider>
  </QueryClientProvider>
);
