import { describe, expect, it, vi } from "vitest";

import { FlexFetchTimeoutError, fetchWithRetry } from "./flexFetch";

const noSleep = () => Promise.resolve();

const jsonResponse = (status: number) =>
  new Response(JSON.stringify({ status }), { status });

describe("fetchWithRetry", () => {
  it("returns the first successful response without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200));

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx responses and returns the eventual success", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(502))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("uses the default sleep implementation between retries", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      backoffMs: 0,
      fetchImpl,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry deterministic 4xx responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404));

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the last retryable response when attempts are exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503));

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      attempts: 3,
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries network errors and throws the last one when attempts run out", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("connection refused"));

    await expect(
      fetchWithRetry("https://flex.example/element", {}, {
        attempts: 2,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("connection refused");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("applies exponential backoff between attempts", async () => {
    const delays: number[] = [];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));

    await fetchWithRetry("https://flex.example/element", {}, {
      backoffMs: 100,
      fetchImpl,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });

    expect(delays).toEqual([100, 200]);
  });

  it("does not retry ambiguous gateway statuses when retryOnTimeout is false", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(504))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry("https://flex.example/element", { method: "POST" }, {
      retryOnTimeout: false,
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(504);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("still retries unambiguous 5xx when retryOnTimeout is false", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry("https://flex.example/element", { method: "POST" }, {
      retryOnTimeout: false,
      fetchImpl,
      sleep: noSleep,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws FlexFetchTimeoutError without retrying when retryOnTimeout is false", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );

    await expect(
      fetchWithRetry("https://flex.example/element", { method: "POST" }, {
        timeoutMs: 10,
        retryOnTimeout: false,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: noSleep,
      }),
    ).rejects.toBeInstanceOf(FlexFetchTimeoutError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry network errors when ambiguous retries are disabled", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("connection reset"));

    await expect(
      fetchWithRetry("https://flex.example/element", { method: "POST" }, {
        retryOnTimeout: false,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("connection reset");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries timeouts when retryOnTimeout is enabled", async () => {
    let calls = 0;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return Promise.resolve(jsonResponse(200));
    });

    const res = await fetchWithRetry("https://flex.example/element", {}, {
      timeoutMs: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
