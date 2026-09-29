// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";

const { toastMock, apiMock, validateImageFile } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  apiMock: {
    fetchFestivalLogoDisplayUrl: vi.fn(),
    uploadFestivalLogo: vi.fn(),
    deleteFestivalLogo: vi.fn(),
  },
  validateImageFile: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/lib/errorTracking", () => ({ trackError: vi.fn() }));
vi.mock("@/utils/imageOptimization", () => ({ validateImageFile }));
vi.mock("../api", () => apiMock);

import { festivalAssetKeys } from "../keys";
import { useFestivalLogo } from "../hooks/useFestivalLogo";

let queryClient = createTestQueryClient();

const setup = (userId: string | null = "user-1") => {
  queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFestivalLogo("job-1", userId ?? undefined), { wrapper });
};

const image = new File(["x"], "logo.png", { type: "image/png" });

describe("useFestivalLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateImageFile.mockReturnValue({ valid: true });
    apiMock.fetchFestivalLogoDisplayUrl.mockResolvedValue("https://logo/current.png");
    apiMock.uploadFestivalLogo.mockResolvedValue("https://logo/new.png");
    apiMock.deleteFestivalLogo.mockResolvedValue(true);
  });

  it("marks the festival list's logos stale after an upload and after a delete", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/current.png"));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const listLogos = expect.objectContaining({ queryKey: festivalAssetKeys.listLogos() });

    act(() => result.current.uploadLogo(image));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(listLogos));

    invalidate.mockClear();
    act(() => result.current.deleteLogo());
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(listLogos));
  });

  it("loads the current logo", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/current.png"));
  });

  it("rejects an invalid image before uploading", async () => {
    validateImageFile.mockReturnValue({ valid: false, error: "Demasiado grande" });
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).not.toBeNull());

    act(() => result.current.uploadLogo(image));

    expect(apiMock.uploadFestivalLogo).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Demasiado grande", variant: "destructive" }),
    );
  });

  it("requires a signed-in user to upload or delete", async () => {
    const { result } = setup(null);
    await waitFor(() => expect(result.current.logoUrl).not.toBeNull());

    act(() => result.current.uploadLogo(image));
    act(() => result.current.deleteLogo());

    expect(apiMock.uploadFestivalLogo).not.toHaveBeenCalled();
    expect(apiMock.deleteFestivalLogo).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledTimes(2);
  });

  it("shows the new logo right after an upload, without refetching", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/current.png"));

    act(() => result.current.uploadLogo(image));

    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/new.png"));
    expect(apiMock.uploadFestivalLogo).toHaveBeenCalledWith({ jobId: "job-1", file: image, userId: "user-1" });
    expect(apiMock.fetchFestivalLogoDisplayUrl).toHaveBeenCalledTimes(1);
  });

  it("clears the logo after deleting it", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/current.png"));

    act(() => result.current.deleteLogo());

    await waitFor(() => expect(result.current.logoUrl).toBeNull());
  });

  it("reports a failed upload and keeps the current logo", async () => {
    apiMock.uploadFestivalLogo.mockRejectedValue(new Error("Error uploading logo: quota"));
    const { result } = setup();
    await waitFor(() => expect(result.current.logoUrl).toBe("https://logo/current.png"));

    act(() => result.current.uploadLogo(image));

    await waitFor(() => expect(result.current.errorDetails).toContain("quota"));
    expect(result.current.logoUrl).toBe("https://logo/current.png");
  });
});
