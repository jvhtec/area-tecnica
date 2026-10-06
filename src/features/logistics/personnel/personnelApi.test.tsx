// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useInvalidatePersonnel } from "./personnelApi";
vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: {} }));
describe("personnel save refresh", () => {
  it("invalidates the cached day panel as well as calendars and driver assignments", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const keys = [["today-logistics", "2026-10-05"], ["logistics-events"], ["transport_driver_assignments", "matrix"]];
    keys.forEach(key => client.setQueryData(key, []));
    const { result, unmount } = renderHook(() => useInvalidatePersonnel(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(async () => { await result.current(); });
    keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    unmount(); client.clear();
  });
});
