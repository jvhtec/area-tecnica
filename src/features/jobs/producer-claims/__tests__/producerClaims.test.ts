import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import {
  __resetProducerCandidatesCacheForTests,
  fetchProducerCandidates,
  mergeProducerClaimsIntoContacts,
} from "@/features/jobs/producer-claims/producerClaims";

const claims = [
  {
    job_id: "job-1",
    producer_id: "producer-1",
    display_name: "Ana Ruiz",
  },
  {
    job_id: "job-1",
    producer_id: "producer-2",
    display_name: "Luis Pérez",
  },
];

describe("producer claims", () => {
  it("adds claimed producers to generated-document contacts", () => {
    const contacts = mergeProducerClaimsIntoContacts([], claims);

    expect(contacts).toEqual([
      { name: "Ana Ruiz", role: "Producción", technician_id: "producer-1" },
      { name: "Luis Pérez", role: "Producción", technician_id: "producer-2" },
    ]);
  });

  it("does not duplicate a producer already present in document contacts", () => {
    const contacts = mergeProducerClaimsIntoContacts(
      [{ name: "Ana Ruiz", role: "Producción", technician_id: "producer-1" }],
      claims,
    );

    expect(contacts).toHaveLength(2);
  });
});

describe("fetchProducerCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    __resetProducerCandidatesCacheForTests();
  });

  it("exposes only id/display name/department, filtered to production department aliases", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [
        { id: "p-1", first_name: "Ana", last_name: "Ruiz", nickname: null, department: "production", role: "management" },
        { id: "p-2", first_name: "Luis", last_name: "Pérez", nickname: null, department: "Producción", role: "technician" },
        { id: "s-1", first_name: "Sam", last_name: "Sound", nickname: null, department: "sound", role: "technician" },
      ],
      error: null,
    });

    const candidates = await fetchProducerCandidates();

    expect(candidates).toEqual([
      { id: "p-1", displayName: "Ana Ruiz" },
      { id: "p-2", displayName: "Luis Pérez" },
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_profile_directory", { p_profile_ids: null });
  });

  it("deduplicates concurrent requests across cards into a single directory call", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ id: "p-1", first_name: "Ana", last_name: "Ruiz", nickname: null, department: "production" }],
      error: null,
    });

    const [first, second] = await Promise.all([fetchProducerCandidates(), fetchProducerCandidates()]);

    expect(first).toBe(second);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("resets the cache on failure so the next call retries", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(fetchProducerCandidates()).rejects.toThrow("boom");

    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ id: "p-1", first_name: "Ana", last_name: "Ruiz", nickname: null, department: "production" }],
      error: null,
    });
    const candidates = await fetchProducerCandidates();

    expect(candidates).toEqual([{ id: "p-1", displayName: "Ana Ruiz" }]);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });
});
