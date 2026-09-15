// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthState } from "@/test/fixtures";

const { useOptimizedAuthMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: () => useOptimizedAuthMock(),
}));

const {
  fetchJobProducerClaimsMock,
  claimJobForProducerMock,
  releaseJobForProducerMock,
  fetchProducerCandidatesMock,
} = vi.hoisted(() => ({
  fetchJobProducerClaimsMock: vi.fn(),
  claimJobForProducerMock: vi.fn(),
  releaseJobForProducerMock: vi.fn(),
  fetchProducerCandidatesMock: vi.fn(),
}));

vi.mock("@/features/jobs/producer-claims/producerClaims", () => ({
  fetchJobProducerClaims: fetchJobProducerClaimsMock,
  claimJobForProducer: claimJobForProducerMock,
  releaseJobForProducer: releaseJobForProducerMock,
  fetchProducerCandidates: fetchProducerCandidatesMock,
}));

import { useJobProducerClaims } from "@/features/jobs/producer-claims/useJobProducerClaims";

const claim = { job_id: "job-1", producer_id: "producer-1", display_name: "Ana Ruiz" };
const claimList = [claim];
const emptyClaims: typeof claimList = [];

describe("useJobProducerClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJobProducerClaimsMock.mockResolvedValue([]);
    fetchProducerCandidatesMock.mockResolvedValue([]);
  });

  it("skips fetching claims and candidates for a dry-hire job", async () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "management", userDepartment: "production" }),
    );

    const { result } = renderHook(() => useJobProducerClaims("job-1", "dryhire"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.claims).toEqual([]);
    expect(result.current.canClaim).toBe(false);
    expect(result.current.canAssign).toBe(false);
    expect(fetchJobProducerClaimsMock).not.toHaveBeenCalled();
    expect(fetchProducerCandidatesMock).not.toHaveBeenCalled();
  });

  it("allows self-claim for any production-department user regardless of role", async () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "technician", userDepartment: "production" }),
    );

    const { result } = renderHook(() => useJobProducerClaims("job-1", "single"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canClaim).toBe(true);
    expect(result.current.canAssign).toBe(false);
  });

  it("allows assignment only for management users in the production department, not admin", async () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "admin", userDepartment: "production" }),
    );
    const { result: adminResult } = renderHook(() => useJobProducerClaims("job-1", "single"));
    await waitFor(() => expect(adminResult.current.isLoading).toBe(false));
    expect(adminResult.current.canAssign).toBe(false);

    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "management", userDepartment: "production" }),
    );
    const { result: managementResult } = renderHook(() => useJobProducerClaims("job-2", "single"));
    await waitFor(() => expect(managementResult.current.isLoading).toBe(false));
    expect(managementResult.current.canAssign).toBe(true);
  });

  it("excludes the current user and already-claimed users from assignable candidates", async () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "management", userDepartment: "production" }),
    );
    fetchProducerCandidatesMock.mockResolvedValue([
      { id: "user-1", displayName: "Self User" },
      { id: "producer-1", displayName: "Ana Ruiz" },
      { id: "producer-9", displayName: "Marta Soto" },
    ]);

    const { result } = renderHook(() => useJobProducerClaims("job-1", "single", claimList));

    await waitFor(() => {
      expect(result.current.candidates).toEqual([
        { id: "producer-9", displayName: "Marta Soto" },
      ]);
    });
  });

  it("assigns a candidate and refreshes claims", async () => {
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({ user: { id: "user-1" }, userRole: "management", userDepartment: "production" }),
    );
    claimJobForProducerMock.mockResolvedValue(undefined);
    fetchJobProducerClaimsMock.mockResolvedValue([claim]);

    const { result } = renderHook(() => useJobProducerClaims("job-1", "single", emptyClaims));

    await act(async () => {
      result.current.assignProducer("producer-1");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(claimJobForProducerMock).toHaveBeenCalledWith("job-1", "producer-1");
      expect(result.current.claims).toEqual([claim]);
    });
  });
});
