import { vi } from "vitest";

export interface MockSupabaseResult<T = unknown> {
  data: T;
  error: unknown;
}

type MockChainMethod =
  | "select"
  | "insert"
  | "update"
  | "upsert"
  | "delete"
  | "eq"
  | "neq"
  | "in"
  | "gte"
  | "lte"
  | "lt"
  | 'gt'
  | "or"
  | "like"
  | "ilike"
  | "match"
  | "contains"
  | "overlaps"
  | "order"
  | "limit"
  | "range";

const chainMethods: MockChainMethod[] = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "in",
  "gte",
  "lte",
  "lt",
  "gt",
  "or",
  "like",
  "ilike",
  "match",
  "contains",
  "overlaps",
  "order",
  "limit",
  "range",
];

export function createMockQueryBuilder<T = unknown>(
  initialResult: MockSupabaseResult<T> = { data: null as T, error: null },
) {
  let result = initialResult;
  const builder: Record<string, any> = {};

  chainMethods.forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });

  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.csv = vi.fn(async () => result);
  builder.then = (onFulfilled?: (value: MockSupabaseResult<T>) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).catch(onRejected);
  builder.finally = (onFinally?: (() => void) | undefined) =>
    Promise.resolve(result).finally(onFinally);
  builder.__setResult = (nextResult: MockSupabaseResult<T>) => {
    result = nextResult;
    return builder;
  };

  return builder;
}

export interface MockSupabaseClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  functions: {
    invoke: ReturnType<typeof vi.fn>;
  };
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
}

export function createMockSupabaseClient(): MockSupabaseClient {
  const defaultStorageBucket = {
    upload: vi.fn().mockResolvedValue({ data: null, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/receipt" }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: vi.fn((path?: string) => ({ data: { publicUrl: path ?? "" } })),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn(() => createMockQueryBuilder()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    storage: {
      from: vi.fn(() => defaultStorageBucket),
    },
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel),
        unsubscribe: vi.fn(),
      };
      return channel;
    }),
    removeChannel: vi.fn(),
  };
}

export const mockSupabase = createMockSupabaseClient();

export function resetMockSupabase() {
  mockSupabase.auth.getUser.mockReset();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mockSupabase.auth.getSession.mockReset();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSupabase.from.mockReset();
  mockSupabase.from.mockImplementation(() => createMockQueryBuilder());
  mockSupabase.rpc.mockReset();
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  mockSupabase.functions.invoke.mockReset();
  mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: null });
  mockSupabase.storage.from.mockReset();
  mockSupabase.storage.from.mockImplementation(() => ({
    upload: vi.fn().mockResolvedValue({ data: null, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/receipt" }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: vi.fn((path?: string) => ({ data: { publicUrl: path ?? "" } })),
  }));
  mockSupabase.channel.mockReset();
  mockSupabase.channel.mockImplementation(() => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
    };
    return channel;
  });
  mockSupabase.removeChannel.mockReset();
}
