import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/react-query";
import { TransportRequestDialog } from "./TransportRequestDialog";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: { rpc } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("TransportRequestDialog cache isolation", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: [], error: null });
  });
  afterEach(cleanup);

  it.each([null, { id: "existing-request", status: "requested", items: [] }])(
    "opens after a job card cached the summary %j",
    async (summary) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
      });
      const summaryKey = queryKeys.scope("transport-request", "job-1", "sound");
      client.setQueryData(summaryKey, summary);

      render(
        <QueryClientProvider client={client}>
          <TransportRequestDialog open onOpenChange={vi.fn()} jobId="job-1" department="sound" />
        </QueryClientProvider>,
      );

      expect(await screen.findByRole("button", { name: "Crear solicitud" })).toBeInTheDocument();
      expect(rpc).toHaveBeenCalledWith("list_transport_requests", {
        p_job_id: "job-1", p_department: "sound", p_include_closed: false,
      });
      expect(client.getQueryData(summaryKey)).toEqual(summary);
      client.clear();
    },
  );
});
