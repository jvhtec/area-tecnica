import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../deps.ts";

vi.mock("../apns.ts", () => ({ sendNativePushNotification: vi.fn() }));
vi.mock("../webpush.ts", () => ({ sendPushNotification: vi.fn() }));

import { handleSubscribe } from "../subscriptions.ts";

type Call = { op: string; args: unknown[] };

/** Records the PostgREST chain per statement and answers from `results`. */
function fakeClient(results: { ownerLookup: unknown; deviceUpdate?: unknown[] }) {
  const statements: Call[][] = [];
  const client = {
    from: () => {
      const calls: Call[] = [];
      statements.push(calls);
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "eq", "update", "insert"]) {
        builder[op] = (...args: unknown[]) => {
          calls.push({ op, args });
          if (op === "insert") return Promise.resolve({ error: null });
          if (op === "select" && calls.some((c) => c.op === "update")) {
            return Promise.resolve({ data: results.deviceUpdate ?? [], error: null });
          }
          return builder;
        };
      }
      builder.maybeSingle = () => Promise.resolve({ data: results.ownerLookup, error: null });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, statements };
}

const subscribeBody = {
  action: "subscribe" as const,
  subscription: { endpoint: "https://push.example/rotated", keys: { p256dh: "k", auth: "a" } },
  device_id: "device-1",
  send_welcome: false,
};

const request = new Request("https://example.test", { headers: { "user-agent": "test" } });

describe("handleSubscribe", () => {
  it("moves an existing device row to a rotated endpoint instead of inserting a duplicate", async () => {
    const { client, statements } = fakeClient({ ownerLookup: null, deviceUpdate: [{ id: "sub-1" }] });
    const response = await handleSubscribe(client, "user-1", subscribeBody, request);

    expect(response.status).toBe(200);
    const write = statements[1];
    expect(write.map((c) => c.op)).toEqual(["update", "eq", "eq", "select"]);
    expect(write[1].args).toEqual(["user_id", "user-1"]);
    expect(write[2].args).toEqual(["device_id", "device-1"]);
    expect(statements.flat().some((c) => c.op === "insert")).toBe(false);
  });

  it("inserts when the device has no subscription yet", async () => {
    const { client, statements } = fakeClient({ ownerLookup: null, deviceUpdate: [] });
    const response = await handleSubscribe(client, "user-1", subscribeBody, request);

    expect(response.status).toBe(200);
    expect(statements[2].map((c) => c.op)).toEqual(["insert"]);
  });
});
