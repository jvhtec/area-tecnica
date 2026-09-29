// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";

const { toastMock, apiMock, getOrCreateToken, buildTemplate } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  apiMock: {
    fetchArtistFormLanguage: vi.fn(),
    fetchPendingArtistForm: vi.fn(),
    saveArtistFormLanguage: vi.fn(),
    sendCorporateEmail: vi.fn(),
  },
  getOrCreateToken: vi.fn(),
  buildTemplate: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/lib/errorTracking", () => ({ trackError: vi.fn() }));
vi.mock("@/utils/qrcode", () => ({ generateQRCode: vi.fn().mockResolvedValue("data:image/png;base64,cXI=") }));
vi.mock("../api", () => apiMock);
vi.mock("../formTokens", () => ({ getOrCreateArtistFormTokenForSend: getOrCreateToken }));
vi.mock("../blankTemplatePdf", () => ({ buildArtistBlankTemplatePdf: buildTemplate }));

import { useArtistFormSend } from "../hooks/useArtistFormSend";

const setup = () => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    (props: { open: boolean; artistId: string }) =>
      useArtistFormSend({ open: props.open, artistId: props.artistId, artistName: "Banda" }),
    { wrapper, initialProps: { open: true, artistId: "artist-1" } },
  );
};

describe("useArtistFormSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.fetchArtistFormLanguage.mockResolvedValue("es");
    apiMock.fetchPendingArtistForm.mockResolvedValue(null);
    apiMock.sendCorporateEmail.mockResolvedValue(undefined);
    getOrCreateToken.mockResolvedValue({ created: true, expiresAt: "2031-07-17T12:00:00Z", formId: "f", token: "token-1" });
    buildTemplate.mockResolvedValue({ blob: new Blob(["pdf"]), fileName: "plantilla.pdf" });
  });

  it("shows no link until a form is sent, then the token that was issued", async () => {
    const { result } = setup();
    await waitFor(() => expect(apiMock.fetchPendingArtistForm).toHaveBeenCalledTimes(1));
    expect(result.current.formLink).toBe("");
    expect(getOrCreateToken).not.toHaveBeenCalled();

    act(() => result.current.setRecipientEmails("artista@example.com"));
    await act(async () => {
      await result.current.sendByEmail();
    });

    expect(getOrCreateToken).toHaveBeenCalledWith("artist-1");
    expect(result.current.formLink).toContain("/festival/artist-form/token-1?lang=es");
    expect(apiMock.sendCorporateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: ["artista@example.com"] }),
    );
  });

  it("drops a locally issued link when the dialog is closed and reopened", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(apiMock.fetchPendingArtistForm).toHaveBeenCalledTimes(1));

    act(() => result.current.setRecipientEmails("artista@example.com"));
    await act(async () => {
      await result.current.sendByEmail();
    });
    expect(result.current.formLink).toContain("token-1");

    // The artist submitted the form meanwhile, so the server no longer has a pending one.
    rerender({ open: false, artistId: "artist-1" });
    rerender({ open: true, artistId: "artist-1" });

    await waitFor(() => expect(apiMock.fetchPendingArtistForm).toHaveBeenCalledTimes(2));
    expect(result.current.formLink).toBe("");
  });

  it("shows the server's pending link when reopened and one exists", async () => {
    apiMock.fetchPendingArtistForm.mockResolvedValue({ token: "server-token", expiresAt: "2031-07-20T12:00:00Z" });
    const { result } = setup();

    await waitFor(() => expect(result.current.formLink).toContain("server-token"));
    expect(result.current.formExpiresAt).toBe("2031-07-20T12:00:00Z");
  });
});
