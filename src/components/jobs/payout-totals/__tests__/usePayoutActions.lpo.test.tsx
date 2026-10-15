import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: {} }));
vi.mock("@/hooks/useJobPayoutOverride", () => ({
  useSetTechnicianPayoutOverride: () => ({ mutate: vi.fn() }),
  useRemoveTechnicianPayoutOverride: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/useToggleTechnicianPayoutApproval", () => ({
  useToggleTechnicianPayoutApproval: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/job-payout-email", () => ({
  sendJobPayoutEmails: mocks.send,
  prepareJobPayoutEmailContext: mocks.prepare,
}));
vi.mock("@/lib/tour-payout-email", () => ({
  sendTourJobEmails: vi.fn(),
  prepareTourJobEmailContext: vi.fn(),
}));
vi.mock("@/utils/rates-pdf-export", () => ({
  generateJobPayoutPDF: vi.fn(),
  generateRateQuotePDF: vi.fn(),
}));

import { usePayoutActions } from "@/components/jobs/payout-totals/usePayoutActions";
import type { JobPayoutTotals } from "@/types/jobExtras";

const payout = {
  job_id: "job-1",
  technician_id: "tech-1",
  payout_approved: true,
  total_eur: 100,
} as unknown as JobPayoutTotals;

const profile = { id: "tech-1", email: "tech@example.com", first_name: "Ana", last_name: "García" };

const emptyContext = {
  job: { id: "job-1" },
  payouts: [],
  profiles: [],
  lpoMap: new Map(),
  timesheetMap: new Map(),
  attachments: [],
  missingEmails: [],
};

describe("usePayoutActions LPO freshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ success: true, error: null, response: { results: [] }, missingEmails: [], context: emptyContext });
    mocks.prepare.mockResolvedValue(emptyContext);
  });

  const render = () => renderHook(() => usePayoutActions({
    jobId: "job-1",
    isTourDate: false,
    jobMeta: null,
    standardPayoutTotals: [payout],
    visibleTourQuotes: [],
    payoutTotals: [payout],
    profilesWithEmail: [profile] as never,
    profileMap: new Map([["tech-1", profile]]) as never,
    getTechName: () => "Ana",
    getTechOverride: () => undefined,
  }));

  it("lets the e-mail builder read LPO numbers from the database on every send", async () => {
    const { result } = render();

    await act(async () => {
      await result.current.handleSendEmails();
      await result.current.handleSendEmails();
    });

    expect(mocks.send).toHaveBeenCalledTimes(2);
    for (const [input] of mocks.send.mock.calls) {
      expect(input.lpoMap).toBeUndefined();
      expect(input.existingContext).toBeUndefined();
    }
  });

  it("does not pass a cached LPO map to the single-technician send or the preview", async () => {
    const { result } = render();

    await act(async () => {
      await result.current.handleSendEmailForTech("tech-1", true);
      await result.current.handlePreviewEmails();
    });

    expect(mocks.send.mock.calls[0][0].lpoMap).toBeUndefined();
    expect(mocks.prepare.mock.calls[0][0].lpoMap).toBeUndefined();
  });
});
