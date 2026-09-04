import { hashKey } from "@tanstack/react-query";

export type SubscriptionPriority = "high" | "medium" | "low";

export type RealtimeSubscriptionFilter = {
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  filter?: string;
};

export type RealtimeChangePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE" | string;
  schema?: string;
  table?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type RealtimePayloadHandler = (payload: RealtimeChangePayload) => void | Promise<void>;

export type SubscriptionOptions = {
  table: string;
  queryKey: SubscriptionQueryKey;
  filter?: RealtimeSubscriptionFilter;
  priority: SubscriptionPriority;
};

export type ManagedSubscription = {
  key: string;
  unsubscribe: () => void;
  options: SubscriptionOptions;
  ownerRoutes: Set<string>;
  payloadHandlers: Map<symbol, RealtimePayloadHandler>;
  payloadHandlerOwners: Map<string, Set<symbol>>;
  invalidateOnPayload: boolean;
  createdAt: number;
  lastPayloadAt: number | null;
  invalidationCount: number;
};

export type SubscribeToTableOptions = {
  ownerRoute?: string;
  onPayload?: RealtimePayloadHandler;
  invalidateOnPayload?: boolean;
};

export type PendingManagedSubscription = {
  options: SubscriptionOptions;
  ownerRoutes: string[];
  payloadHandlers: Array<{
    ownerRoute?: string;
    handler: RealtimePayloadHandler;
  }>;
  invalidateOnPayload: boolean;
};

export type SubscriptionDebugEntry = {
  key: string;
  ownerRoutes: string[];
  table: string;
  queryKey: unknown[];
  filter?: RealtimeSubscriptionFilter;
  priority: SubscriptionPriority;
  createdAt: number;
  lastPayloadAt: number | null;
  invalidationCount: number;
};

export type SubscriptionSnapshot = {
  connectionStatus: "connected" | "disconnected" | "connecting";
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  debugSubscriptions: SubscriptionDebugEntry[];
  lastRefreshTime: number;
  activeConnections: number;
  queuedSubscriptions: number;
  failedConnections: number;
  averageResponseTime: number;
  circuitBreakerOpen: boolean;
  lastHealthCheck: number;
};

/**
 * A React Query key as accepted by the subscription layer: either a bare scope string
 * or a key array. Mirrors `QueryKey` (`readonly unknown[]`) so keys built by
 * `queryKeys.scope(...)` — which may embed nullable ids — are accepted without casts.
 */
export type SubscriptionQueryKey = string | readonly unknown[];

export const normalizeQueryKey = (queryKey: SubscriptionQueryKey): unknown[] =>
  Array.isArray(queryKey) ? [...queryKey] : [queryKey];

export const hashSubscriptionQueryKey = (queryKey: SubscriptionQueryKey): string =>
  hashKey(normalizeQueryKey(queryKey));

export const buildSubscriptionKey = (
  table: string,
  queryKey: SubscriptionQueryKey,
  filter?: RealtimeSubscriptionFilter,
): string => {
  const normalizedFilter = {
    event: filter?.event ?? "*",
    schema: filter?.schema ?? "public",
    filter: filter?.filter ?? "",
  };

  return `${table}::${hashSubscriptionQueryKey(queryKey)}::${normalizedFilter.event}::${normalizedFilter.schema}::${normalizedFilter.filter}`;
};

export const createInitialSubscriptionSnapshot = (now = Date.now()): SubscriptionSnapshot => ({
  connectionStatus: "connecting",
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
  debugSubscriptions: [],
  lastRefreshTime: now,
  activeConnections: 0,
  queuedSubscriptions: 0,
  failedConnections: 0,
  averageResponseTime: 0,
  circuitBreakerOpen: false,
  lastHealthCheck: now,
});

export const groupSubscriptionsByTable = (
  subscriptions: Map<string, ManagedSubscription>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  subscriptions.forEach((_, key) => {
    const [table] = key.split("::");
    (result[table] ??= []).push(key);
  });
  return result;
};

export const createSubscriptionDebugEntries = (
  subscriptions: Map<string, ManagedSubscription>,
): SubscriptionDebugEntry[] =>
  Array.from(subscriptions.values()).map((subscription) => ({
    key: subscription.key,
    ownerRoutes: Array.from(subscription.ownerRoutes).sort(),
    table: subscription.options.table,
    queryKey: normalizeQueryKey(subscription.options.queryKey),
    filter: subscription.options.filter,
    priority: subscription.options.priority,
    createdAt: subscription.createdAt,
    lastPayloadAt: subscription.lastPayloadAt,
    invalidationCount: subscription.invalidationCount,
  }));

type ForceRefreshSubscriptionsOptions = {
  subscriptions: Map<string, ManagedSubscription>;
  tableLastActivity: Map<string, number>;
  snapshotSubscription: (subscription: ManagedSubscription) => PendingManagedSubscription;
  replaySubscription: (subscription: PendingManagedSubscription) => void;
  invalidateQuery: (queryKey: unknown[]) => void;
};

export const forceRefreshManagedSubscriptions = (
  tables: string[],
  {
    subscriptions,
    tableLastActivity,
    snapshotSubscription,
    replaySubscription,
    invalidateQuery,
  }: ForceRefreshSubscriptionsOptions,
): void => {
  tables.forEach((table) => {
    const subscriptionKeys = Array.from(subscriptions.keys()).filter((key) => key.startsWith(`${table}::`));

    subscriptionKeys.forEach((key) => {
      const subscription = subscriptions.get(key);
      if (!subscription) return;

      try {
        const pendingSubscription = snapshotSubscription(subscription);
        subscription.unsubscribe();
        subscriptions.delete(key);
        replaySubscription(pendingSubscription);
        tableLastActivity.set(key, Date.now());
      } catch (error) {
        console.error(`Error refreshing subscription ${key}:`, error);
      }
    });

    const queryKeysForTable = Array.from(subscriptions.values())
      .filter((subscription) => subscription.options.table === table)
      .map((subscription) => normalizeQueryKey(subscription.options.queryKey));

    if (queryKeysForTable.length > 0) {
      queryKeysForTable.forEach(invalidateQuery);
    } else {
      invalidateQuery([table]);
    }
  });
};
