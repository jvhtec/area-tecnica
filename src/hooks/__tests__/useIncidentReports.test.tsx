// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";

import { createIncidentReport } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useIncidentReports } from "../useIncidentReports";

describe("useIncidentReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  const createWrapper = () => {
    const queryClient = createTestQueryClient();

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it("loads reports and maps uploader profiles onto them", async () => {
    const report = createIncidentReport({
      uploaded_by: "tech-1",
      uploaded_by_profile: undefined,
    });
    const reportsBuilder = createMockQueryBuilder({ data: [report], error: null });
    const profilesBuilder = createMockQueryBuilder({
      data: [{ id: "tech-1", first_name: "Pat", last_name: "Jones" }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "job_documents") {
        return reportsBuilder;
      }
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useIncidentReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.reports).toHaveLength(1);
    });

    expect(result.current.reports[0].uploaded_by_profile).toEqual({
      id: "tech-1",
      first_name: "Pat",
      last_name: "Jones",
    });
    expect(reportsBuilder.like).toHaveBeenCalledWith("file_path", "incident-reports/%");
    expect(profilesBuilder.in).toHaveBeenCalledWith("id", ["tech-1"]);
  });

  it("deletes storage and database records, then broadcasts and invalidates", async () => {
    const report = createIncidentReport({ id: "incident-1", file_path: "incident-reports/file.pdf" });
    const reportsBuilder = createMockQueryBuilder({ data: [report], error: null });
    const profilesBuilder = createMockQueryBuilder({
      data: [{ id: "tech-1", first_name: "Pat", last_name: "Jones" }],
      error: null,
    });
    const deleteBuilder = createMockQueryBuilder({ data: null, error: null });
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockSupabase.storage.from.mockReturnValue({
      remove: removeMock,
      download: vi.fn().mockResolvedValue({ data: new Blob(["test"]), error: null }),
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "job_documents") {
        return {
          ...reportsBuilder,
          delete: vi.fn(() => deleteBuilder),
        };
      }
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useIncidentReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.reports).toHaveLength(1);
    });

    act(() => {
      result.current.deleteReport("incident-1");
    });

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith(["incident-reports/file.pdf"]);
      expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "incident-1");
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("push", {
        body: {
          action: "broadcast",
          type: "document.deleted",
          job_id: report.job_id,
          file_name: report.file_name,
        },
      });
    });
  });

  it("downloads a report, triggers the anchor flow, and shows a success toast", async () => {
    const report = createIncidentReport({ id: "incident-1", file_name: "incident.pdf" });
    const reportsBuilder = createMockQueryBuilder({ data: [report], error: null });
    const profilesBuilder = createMockQueryBuilder({
      data: [{ id: "tech-1", first_name: "Pat", last_name: "Jones" }],
      error: null,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:report"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn(),
    });

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: new Blob(["pdf"]), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "job_documents") {
        return reportsBuilder;
      }
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useIncidentReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.reports).toHaveLength(1);
    });

    await act(async () => {
      await result.current.downloadReport(report as any);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Descarga iniciada",
      }),
    );
  });

  it("shows a destructive toast when the download fails", async () => {
    const report = createIncidentReport({ id: "incident-1" });
    const reportsBuilder = createMockQueryBuilder({ data: [report], error: null });
    const profilesBuilder = createMockQueryBuilder({
      data: [{ id: "tech-1", first_name: "Pat", last_name: "Jones" }],
      error: null,
    });

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: null, error: new Error("download failed") }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "job_documents") {
        return reportsBuilder;
      }
      if (table === "profiles") {
        return profilesBuilder;
      }

      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useIncidentReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.reports).toHaveLength(1);
    });

    await act(async () => {
      await result.current.downloadReport(report as any);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        variant: "destructive",
      }),
    );
  });
});
