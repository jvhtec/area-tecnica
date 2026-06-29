// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEntityListQuery, useEntityMutation } from "@/hooks/useEntityQueries";
import { queryClient } from "@/lib/react-query";

type WidgetRow = {
  id: string;
  name: string;
};

type WidgetMutation = {
  id?: string;
  isDelete?: boolean;
  name?: string;
  [key: string]: unknown;
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useEntityQueries", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds list query URLs from filter values", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "widget-1", name: "Main" }]));

    const { result } = renderHook(
      () =>
        useEntityListQuery<WidgetRow>("widgets", {
          page: 2,
          active: true,
          search: "main stage",
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: "widget-1", name: "Main" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/widgets?page=2&active=true&search=main%20stage", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("routes create, update, and delete mutations to the expected REST methods", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "widget-1", name: "Created" }))
      .mockResolvedValueOnce(jsonResponse({ id: "widget-1", name: "Updated" }))
      .mockResolvedValueOnce(jsonResponse({ id: "widget-1", name: "Deleted" }));
    const onSuccess = vi.fn();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useEntityMutation<WidgetRow, WidgetMutation>("widgets", {
          onSuccessInvalidation: ["widgets", "widget-summary"],
          onSuccess,
          retry: false,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ name: "Created" });
      await result.current.mutateAsync({ id: "widget-1", name: "Updated" });
      await result.current.mutateAsync({ id: "widget-1", isDelete: true });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/widgets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Created" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/widgets/widget-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ id: "widget-1", name: "Updated" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/widgets/widget-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["widgets"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["widget-summary"] });
  });

  it("restores optimistic data and calls onError when a mutation fails", async () => {
    const previousData: WidgetRow = { id: "widget-1", name: "Before" };
    queryClient.setQueryData(["widgets"], previousData);
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "boom" }, { status: 500, statusText: "Nope" }));
    const onError = vi.fn();
    const optimisticUpdate = vi.fn((variables: WidgetMutation) => {
      queryClient.setQueryData(["widgets"], { id: variables.id, name: variables.name });
    });

    const { result } = renderHook(
      () =>
        useEntityMutation<WidgetRow, WidgetMutation>("widgets", {
          optimisticUpdate,
          onError,
          retry: false,
        }),
      { wrapper },
    );

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ id: "widget-1", name: "Broken" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(queryClient.getQueryData(["widgets"])).toEqual(previousData);
    expect(optimisticUpdate).toHaveBeenCalledWith({ id: "widget-1", name: "Broken" });
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      { id: "widget-1", name: "Broken" },
      { previousData },
      expect.objectContaining({ client: expect.any(Object) }),
    );
  });
});
