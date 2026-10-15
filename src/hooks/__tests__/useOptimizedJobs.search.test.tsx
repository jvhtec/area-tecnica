// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type Call = { op: string; args: unknown[] };

const state = vi.hoisted(() => ({
  queries: [] as Array<{ select: string; calls: Call[] }>,
  /** 1,000 non-matching search rows, then one matching row on page 2. */
  searchRows: [] as Array<{ id: string; title: string; location: null }>,
}));

vi.mock("@/hooks/useSubscription", () => ({ useMultiTableSubscription: () => undefined }));
vi.mock("@/features/jobs/producer-claims/producerClaims", () => ({ fetchJobProducerClaims: async () => [] }));
vi.mock("@/lib/supabase", () => {
  const from = () => {
    const query = { select: "", calls: [] as Call[] };
    state.queries.push(query);
    const builder: Record<string, unknown> = {};
    const result = () => {
      const isSearch = query.select.startsWith("id, title");
      if (!isSearch) {
        const ids = (query.calls.find((c) => c.op === "in" && c.args[0] === "id")?.args[1] ?? []) as string[];
        return { data: ids.map((id) => ({ id, title: `Job ${id}`, start_time: "2026-10-15T08:00:00Z", tour_id: null })), error: null };
      }
      const range = query.calls.find((c) => c.op === "range")?.args as [number, number];
      return { data: state.searchRows.slice(range[0], range[1] + 1), error: null };
    };
    for (const op of ["eq", "in", "gte", "lte", "order", "range"]) {
      builder[op] = (...args: unknown[]) => {
        query.calls.push({ op, args });
        return builder;
      };
    }
    builder.select = (columns: string) => {
      query.select = columns;
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return builder;
  };
  return { supabase: { from } };
});

import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useOptimizedJobs search", () => {
  it("pages through the whole department before matching, past the 1,000-row API cap", async () => {
    state.queries = [];
    state.searchRows = [
      ...Array.from({ length: 1000 }, (_, index) => ({ id: `filler-${index}`, title: "Otro evento", location: null })),
      { id: "target", title: "Concierto Sánchez", location: null },
    ];

    const { result } = renderHook(
      () => useOptimizedJobs("sound", undefined, undefined, true, { search: "sanchez" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((job) => job.id)).toEqual(["target"]);

    const searchPages = state.queries.filter((q) => q.select.startsWith("id, title"));
    expect(searchPages.map((q) => q.calls.find((c) => c.op === "range")?.args)).toEqual([[0, 999], [1000, 1999]]);
    expect(searchPages.every((q) => q.calls.some((c) => c.op === "order" && c.args[0] === "id"))).toBe(true);
  });
});
