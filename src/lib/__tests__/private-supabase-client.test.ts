import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturePrivateDataScope, setPrivateDataIdentity } from "../private-data-scope";
import { createPrivateSupabaseClient } from "../private-supabase-client";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));
vi.mock("@/lib/api-config", () => ({ SUPABASE_URL: "https://offline.test", SUPABASE_ANON_KEY: "test-public-key" }));

describe("Supabase requests bound to a private operation", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    setPrivateDataIdentity("account-a", "management:sound");
    getSession.mockResolvedValue({ data: { session: { user: { id: "account-a" }, access_token: "account-a-token" } }, error: null });
    fetchMock.mockReset().mockImplementation(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { setPrivateDataIdentity(null); vi.unstubAllGlobals(); });

  it("pins the JWT even if auth storage changes before the request is sent", async () => {
    const client = await createPrivateSupabaseClient(capturePrivateDataScope());
    getSession.mockResolvedValue({ data: { session: { user: { id: "account-b" }, access_token: "account-b-token" } }, error: null });
    const result = await client.from("festival_artists").select("id");
    expect(result.error).toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer account-a-token");
  });

  it("does not send a queued request after its identity is invalidated", async () => {
    const client = await createPrivateSupabaseClient(capturePrivateDataScope());
    const request = client.from("festival_artists").delete().eq("id", "artist");
    setPrivateDataIdentity("account-b", "management:sound");
    const result = await request;
    expect(result.error).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a session belonging to a different user before constructing a client", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "account-b" }, access_token: "account-b-token" } }, error: null });
    await expect(createPrivateSupabaseClient(capturePrivateDataScope())).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([false, true])("aborts a response body after headers arrived (legacy webview: %s)", async (legacy) => {
    if (legacy) vi.stubGlobal("AbortSignal", { any: undefined });
    let requestSignal!: AbortSignal;
    fetchMock.mockImplementation(async (_input, init) => {
      requestSignal = init.signal;
      return new Response(new ReadableStream({
        start(controller) {
          requestSignal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const client = await createPrivateSupabaseClient(capturePrivateDataScope());
    const request = Promise.resolve(client.from("festival_artists").select("id"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setPrivateDataIdentity("account-b", "management:sound");
    expect(requestSignal.aborted).toBe(true);
    expect((await request).error).not.toBeNull();
  });

  it("preserves successful response bodies in older webviews", async () => {
    vi.stubGlobal("AbortSignal", { any: undefined });
    const client = await createPrivateSupabaseClient(capturePrivateDataScope());
    const result = await client.from("festival_artists").select("id");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
