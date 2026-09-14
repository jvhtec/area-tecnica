// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useJobProducerClaimsMock } = vi.hoisted(() => ({
  useJobProducerClaimsMock: vi.fn(),
}));

vi.mock("@/features/jobs/producer-claims/useJobProducerClaims", () => ({
  useJobProducerClaims: useJobProducerClaimsMock,
}));

import { JobProducerClaims } from "@/components/jobs/producer-claims/JobProducerClaims";

const baseState = {
  claims: [{ job_id: "job-1", producer_id: "producer-1", display_name: "Ana Ruiz" }],
  canClaim: false,
  isClaimedByCurrentUser: false,
  isLoading: false,
  isPending: false,
  toggleClaim: vi.fn(),
};

describe("JobProducerClaims", () => {
  beforeEach(() => useJobProducerClaimsMock.mockReturnValue(baseState));

  it("shows claimed producers without exposing claim controls to other departments", () => {
    render(<JobProducerClaims jobId="job-1" />);
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets an eligible producer claim the job", () => {
    const toggleClaim = vi.fn();
    useJobProducerClaimsMock.mockReturnValue({ ...baseState, claims: [], canClaim: true, toggleClaim });
    render(<JobProducerClaims jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Hacerme cargo" }));
    expect(toggleClaim).toHaveBeenCalledOnce();
  });
});
