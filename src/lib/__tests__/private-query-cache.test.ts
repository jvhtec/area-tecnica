import { afterEach, describe, expect, it, vi } from "vitest";
import { createOptimizedQueryClient } from "../optimized-react-query";
import { PrivateAuthBoundary } from "@/hooks/optimizedAuthBoundary";
import { setPrivateDataIdentity } from "../private-data-scope";

describe("private queries across auth transitions", () => {
  afterEach(() => setPrivateDataIdentity(null));

  it("starts the next account's query even while the previous account's promise is settling", async () => {
    const client = createOptimizedQueryClient();
    const boundary = new PrivateAuthBoundary(client);
    boundary.acceptSession("account-a");
    let finish!: (value: string) => void;
    const oldRequest = client.fetchQuery({ queryKey: ["private"], queryFn: () => new Promise<string>((resolve) => { finish = resolve; }) }).catch(() => "cancelled");
    boundary.acceptSession("account-b");
    const nextRequest = client.fetchQuery({ queryKey: ["private"], queryFn: async () => "account B" });
    finish("account A");
    await expect(nextRequest).resolves.toBe("account B");
    await oldRequest;
    expect(client.getQueryData(["private"])).toBe("account B");
    client.clear();
  });

  it("still shares one request for simultaneous callers of the same query", async () => {
    const client = createOptimizedQueryClient();
    let finish!: (value: string) => void;
    const fetch = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const first = client.fetchQuery({ queryKey: ["same"], queryFn: fetch });
    const second = client.fetchQuery({ queryKey: ["same"], queryFn: fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    finish("result");
    await expect(Promise.all([first, second])).resolves.toEqual(["result", "result"]);
    client.clear();
  });

  it("does not let a late mutation result or rollback repopulate the next account's cache", async () => {
    const client = createOptimizedQueryClient();
    const boundary = new PrivateAuthBoundary(client);
    boundary.acceptSession("account-a");
    let finish!: (value: string) => void;
    const mutationFn = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const mutation = client.getMutationCache().build(client, {
      mutationFn,
      retry: false,
      onSuccess: (data) => { client.setQueryData(["private"], data); },
      onError: () => { client.setQueryData(["private"], "A optimistic rollback"); },
    });
    const result = mutation.execute(undefined).catch(() => "cancelled");
    await vi.waitFor(() => expect(mutationFn).toHaveBeenCalled());
    boundary.acceptSession("account-b");
    finish("A private response");
    await result;
    expect(client.getQueryData(["private"])).toBeUndefined();
    client.clear();
  });

  it("does not dispatch a retry under the next account", async () => {
    const client = createOptimizedQueryClient();
    const boundary = new PrivateAuthBoundary(client);
    boundary.acceptSession("account-a");
    let reject!: (error: Error) => void;
    const mutationFn = vi.fn().mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; })).mockResolvedValue("wrong account retry");
    const mutation = client.getMutationCache().build(client, { mutationFn, retry: 1, retryDelay: 0 });
    const result = mutation.execute(undefined).catch(() => "cancelled");
    await vi.waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    boundary.acceptSession("account-b");
    reject(new Error("Network failure"));
    await result;
    expect(mutationFn).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
