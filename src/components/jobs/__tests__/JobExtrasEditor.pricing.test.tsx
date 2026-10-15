// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogOptions: [] as Array<{ enabled?: boolean } | undefined>,
}));

vi.mock("@/hooks/useJobExtras", () => ({
  useJobExtras: () => ({
    data: [
      { job_id: "job-1", technician_id: "tech-1", extra_type: "day_off", quantity: 2, status: "approved", updated_at: "" },
      { job_id: "job-1", technician_id: "tech-1", extra_type: "conduccion", quantity: 1, status: "pending", updated_at: "" },
    ],
    isLoading: false,
  }),
  useUpsertJobExtra: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useRateExtrasCatalog", () => ({
  useRateExtrasCatalog: (options?: { enabled?: boolean }) => {
    mocks.catalogOptions.push(options);
    return {
      data: options?.enabled === false ? [] : [{ extra_type: "day_off", amount_eur: 99 }],
      isLoading: false,
    };
  },
}));

import { JobExtrasEditor } from "@/components/jobs/JobExtrasEditor";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("JobExtrasEditor pricing", () => {
  beforeEach(() => {
    mocks.catalogOptions = [];
  });

  it("prices a technician's own extras from the payout breakdown, never the rate catalog", () => {
    render(
      <JobExtrasEditor
        jobId="job-1"
        technicianId="tech-1"
        technicianName="Ana"
        extrasBreakdown={{
          items: [{ extra_type: "day_off", quantity: 2, unit_eur: 50, amount_eur: 100 }],
          total_eur: 100,
        }}
      />,
      { wrapper },
    );

    // The catalog is management-only under RLS, so the query must stay off.
    expect(mocks.catalogOptions.every((options) => options?.enabled === false)).toBe(true);
    expect(screen.getByText(/2 × 50\s€/)).toBeInTheDocument();
    // The pending extra has no approved price yet: show the quantity, no €0.
    expect(screen.queryByText(/1 × 0\s€/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0\s€ each/)).not.toBeInTheDocument();
  });

  it("keeps catalog pricing for managers", () => {
    render(
      <JobExtrasEditor jobId="job-1" technicianId="tech-1" technicianName="Ana" isManager />,
      { wrapper },
    );

    expect(mocks.catalogOptions.every((options) => options?.enabled === true)).toBe(true);
    expect(screen.getAllByText(/99\s€/).length).toBeGreaterThan(0);
  });
});
