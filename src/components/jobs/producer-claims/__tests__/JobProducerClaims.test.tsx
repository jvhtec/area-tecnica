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
  canAssign: false,
  candidates: [] as { id: string; displayName: string }[],
  isAssigning: false,
  assignProducer: vi.fn(),
};

describe("JobProducerClaims", () => {
  beforeEach(() => useJobProducerClaimsMock.mockReturnValue(baseState));

  it("renders nothing for a dry-hire job regardless of state", () => {
    const { container } = render(<JobProducerClaims jobId="job-1" jobType="dryhire" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders safely for an unknown or absent job type", () => {
    render(<JobProducerClaims jobId="job-1" jobType={undefined} />);
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();

    render(<JobProducerClaims jobId="job-1" jobType="some-unexpected-type" />);
    expect(screen.getAllByText("Ana Ruiz").length).toBeGreaterThan(0);
  });

  it("shows claimed producers without exposing claim controls to other departments", () => {
    render(<JobProducerClaims jobId="job-1" jobType="single" />);
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("puts the full joined producer names on the name span for truncation", () => {
    useJobProducerClaimsMock.mockReturnValue({
      ...baseState,
      claims: [
        { job_id: "job-1", producer_id: "producer-1", display_name: "Ana Ruiz" },
        { job_id: "job-1", producer_id: "producer-2", display_name: "Luis Pérez" },
      ],
    });
    render(<JobProducerClaims jobId="job-1" jobType="single" />);
    expect(screen.getByText("Ana Ruiz, Luis Pérez")).toHaveAttribute("title", "Ana Ruiz, Luis Pérez");
  });

  it("lets an eligible producer claim the job and shows the exact self-claim hover copy", () => {
    const toggleClaim = vi.fn();
    useJobProducerClaimsMock.mockReturnValue({ ...baseState, claims: [], canClaim: true, toggleClaim });
    render(<JobProducerClaims jobId="job-1" jobType="single" />);

    const button = screen.getByRole("button", { name: "Hacerme cargo" });
    expect(button).toHaveAttribute(
      "title",
      "¿Estás seguro de que quieres hacerte cargo de este marrón?",
    );
    fireEvent.click(button);
    expect(toggleClaim).toHaveBeenCalledOnce();
  });

  it("shows the release label once claimed by the current user", () => {
    useJobProducerClaimsMock.mockReturnValue({ ...baseState, canClaim: true, isClaimedByCurrentUser: true });
    render(<JobProducerClaims jobId="job-1" jobType="single" />);
    expect(screen.getByRole("button", { name: "Dejar de llevarlo" })).toBeInTheDocument();
  });

  it("lets a management production user assign the job to another candidate", async () => {
    const assignProducer = vi.fn();
    useJobProducerClaimsMock.mockReturnValue({
      ...baseState,
      canAssign: true,
      candidates: [{ id: "producer-9", displayName: "Marta Soto" }],
      assignProducer,
    });
    render(<JobProducerClaims jobId="job-1" jobType="single" />);

    const trigger = screen.getByRole("combobox", { name: "Asignar a otro usuario de producción" });
    expect(trigger).toHaveAttribute("title", "Pasarle el marrón a otro");
    fireEvent.change(trigger, { target: { value: "producer-9" } });
    expect(assignProducer).toHaveBeenCalledWith("producer-9");
  });

  it("does not show assign controls for non-management or non-production users", () => {
    render(<JobProducerClaims jobId="job-1" jobType="single" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
