// Simple stub provider to replace SubscriptionProvider temporarily
import { ReactNode } from 'react';

interface SubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSubscriptions: number;
  subscriptionCount: number;
  refreshSubscriptions: () => void;
  invalidateQueries: () => void;
  forceRefresh: () => void;
  forceSubscribe: (tables: string[]) => void;
  lastRefreshTime: number;
}

// Create a simple stub context
import { createContext, useContext } from 'react';

const StubSubscriptionContext = createContext<SubscriptionContextType>({
  connectionStatus: 'connected',
  activeSubscriptions: 0,
  subscriptionCount: 0,
  refreshSubscriptions: () => {},
  invalidateQueries: () => {},
  forceRefresh: () => {},
  forceSubscribe: () => {},
  lastRefreshTime: Date.now(),
});

export const useSubscriptionContext = () => useContext(StubSubscriptionContext);

// Stub provider component
export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  return (
    <StubSubscriptionContext.Provider value={{
      connectionStatus: 'connected',
      activeSubscriptions: 0,
      subscriptionCount: 0,
      refreshSubscriptions: () => {},
      invalidateQueries: () => {},
      forceRefresh: () => {},
      forceSubscribe: () => {},
      lastRefreshTime: Date.now(),
    }}>
      {children}
    </StubSubscriptionContext.Provider>
  );
};