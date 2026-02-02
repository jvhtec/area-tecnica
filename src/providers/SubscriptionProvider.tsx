import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TokenManager } from "@/lib/token-manager";
import { UnifiedSubscriptionManager, type SubscriptionSnapshot } from "@/lib/unified-subscription-manager";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionContextType {
  connectionStatus: "connected" | "disconnected" | "connecting";
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  refreshSubscriptions: () => void;
  invalidateQueries: (queryKey?: string | string[]) => void;
  lastRefreshTime: number;
  forceRefresh: (tables?: string[]) => void;
  forceSubscribe: (
    tables: Array<{ table: string; queryKey: string | string[]; priority?: "high" | "medium" | "low" }>,
  ) => void;
}

type SubscriptionContextInternal = {
  manager: Pick<
    UnifiedSubscriptionManager,
    "subscribe" | "getSnapshot" | "reestablishSubscriptions" | "forceRefreshSubscriptions" | "subscribeToTable" | "markRefreshed"
  >;
  refreshSubscriptions: SubscriptionContextType["refreshSubscriptions"];
  invalidateQueries: SubscriptionContextType["invalidateQueries"];
  forceRefresh: SubscriptionContextType["forceRefresh"];
  forceSubscribe: SubscriptionContextType["forceSubscribe"];
};

const noopSnapshot: SubscriptionSnapshot = {
  connectionStatus: "connecting",
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
  lastRefreshTime: 0,
};

const noopManager = {
  subscribe: () => () => {},
  getSnapshot: () => noopSnapshot,
  reestablishSubscriptions: () => false,
  forceRefreshSubscriptions: () => {},
  subscribeToTable: () => ({ unsubscribe: () => {} }),
  markRefreshed: () => {},
} satisfies SubscriptionContextInternal["manager"];

const SubscriptionContext = createContext<SubscriptionContextInternal>({
  manager: noopManager,
  refreshSubscriptions: () => {},
  invalidateQueries: () => {},
  forceRefresh: () => {},
  forceSubscribe: () => {},
});

export const useSubscriptionContext = (): SubscriptionContextType => {
  const ctx = useContext(SubscriptionContext);

  const snapshot = useSyncExternalStore(
    ctx.manager.subscribe.bind(ctx.manager),
    ctx.manager.getSnapshot.bind(ctx.manager),
    ctx.manager.getSnapshot.bind(ctx.manager),
  );

  return useMemo(
    () => ({
      connectionStatus: snapshot.connectionStatus,
      activeSubscriptions: snapshot.activeSubscriptions,
      subscriptionCount: snapshot.subscriptionCount,
      subscriptionsByTable: snapshot.subscriptionsByTable,
      lastRefreshTime: snapshot.lastRefreshTime,
      refreshSubscriptions: ctx.refreshSubscriptions,
      invalidateQueries: ctx.invalidateQueries,
      forceRefresh: ctx.forceRefresh,
      forceSubscribe: ctx.forceSubscribe,
    }),
    [ctx.forceRefresh, ctx.forceSubscribe, ctx.invalidateQueries, ctx.refreshSubscriptions, snapshot],
  );
};

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";

  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);

  useEffect(() => {
    const tokenManager = TokenManager.getInstance();
    const unsubscribe = tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      manager.reestablishSubscriptions();
      manager.markRefreshed();
    });

    return () => {
      unsubscribe();
    };
  }, [manager]);

  const refreshSubscriptions = useCallback(() => {
    manager.reestablishSubscriptions();
    manager.markRefreshed();

    if (isAdmin) {
      toast.success("Subscriptions refreshed");
    }
  }, [isAdmin, manager]);

  const invalidateQueries = useCallback(
    (queryKey?: string | string[]) => {
      if (queryKey) {
        const key = Array.isArray(queryKey) ? queryKey : [queryKey];
        queryClient.invalidateQueries({ queryKey: key });
      } else {
        queryClient.invalidateQueries();
      }
      manager.markRefreshed();
    },
    [manager, queryClient],
  );

  const forceRefresh = useCallback(
    (tables?: string[]) => {
      if (tables && tables.length > 0) {
        manager.forceRefreshSubscriptions(tables);
      } else {
        manager.reestablishSubscriptions();
      }

      manager.markRefreshed();

      if (isAdmin) {
        if (tables && tables.length > 0) {
          toast.success(`Refreshed ${tables.join(", ")} tables`);
        } else {
          toast.success("All subscriptions refreshed");
        }
      }
    },
    [isAdmin, manager],
  );

  const forceSubscribe = useCallback(
    (tables: Array<{ table: string; queryKey: string | string[]; priority?: "high" | "medium" | "low" }>) => {
      if (!tables || tables.length === 0) return;
      const names = tables.map((t) => t.table).join(", ");
      console.log(`Ensuring subscriptions for tables: ${names}`);

      tables.forEach(({ table, queryKey, priority }) => {
        manager.subscribeToTable(table, queryKey, undefined, priority ?? "medium");
      });
    },
    [manager],
  );

  const value = useMemo<SubscriptionContextInternal>(
    () => ({
      manager,
      refreshSubscriptions,
      invalidateQueries,
      forceRefresh,
      forceSubscribe,
    }),
    [forceRefresh, forceSubscribe, invalidateQueries, manager, refreshSubscriptions],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

