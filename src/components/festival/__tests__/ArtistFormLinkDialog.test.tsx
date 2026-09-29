// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";

const {
  exportArtistPDFMock,
  generateQRCodeMock,
  getOrCreateTokenMock,
  invokeMock,
  toastMock,
} = vi.hoisted(() => ({
  exportArtistPDFMock: vi.fn(),
  generateQRCodeMock: vi.fn(),
  getOrCreateTokenMock: vi.fn(),
  invokeMock: vi.fn(),
  toastMock: vi.fn(),
}));

const createQueryBuilder = (data: unknown) => {
  const builder = {
    eq: vi.fn(),
    gt: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    select: vi.fn(),
    update: vi.fn(),
  };

  builder.eq.mockReturnValue(builder);
  builder.gt.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  return builder;
};

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: vi.fn((table: string) => createQueryBuilder(
      table === "festival_artists"
        ? { date: "2031-07-10", form_language: "es", name: "Artist One", stage: 1 }
        : null,
    )),
    functions: { invoke: invokeMock },
  },
}));

vi.mock("@/features/festival-forms/formTokens", () => ({
  getOrCreateArtistFormTokenForSend: getOrCreateTokenMock,
}));

vi.mock("@/utils/qrcode", () => ({
  generateQRCode: generateQRCodeMock,
}));

vi.mock("@/utils/artistPdfExport", () => ({
  exportArtistPDF: exportArtistPDFMock,
}));

vi.mock("@/utils/pdf/logoUtils", () => ({
  fetchJobLogo: vi.fn(),
}));

vi.mock("@/utils/festivalGearOptions", () => ({
  fetchFestivalGearOptionsForTemplate: vi.fn(),
}));

import { ArtistFormLinkDialog } from "@/components/festival/ArtistFormLinkDialog";

describe("ArtistFormLinkDialog send-owned token lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportArtistPDFMock.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    generateQRCodeMock.mockResolvedValue("data:image/png;base64,cXI=");
    getOrCreateTokenMock.mockResolvedValue({
      created: true,
      expiresAt: "2031-07-17T12:00:00Z",
      formId: "form-1",
      token: "token-1",
    });
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("does not mint a token when opened and mints it from the send action", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ArtistFormLinkDialog
          open
          onOpenChange={vi.fn()}
          artistId="artist-1"
          artistName="Artist One"
          selectedDate="2031-07-10"
        />
      </QueryClientProvider>,
    );

    await screen.findByText(/El enlace público se creará al enviar/i);
    expect(getOrCreateTokenMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Enviar formulario por email"), "artist@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar formulario + QR" }));

    await waitFor(() => {
      expect(getOrCreateTokenMock).toHaveBeenCalledWith("artist-1");
      expect(invokeMock).toHaveBeenCalledWith(
        "send-corporate-email",
        expect.objectContaining({
          body: expect.objectContaining({
            recipients: { emails: ["artist@example.com"] },
          }),
        }),
      );
    });

    const emailRequest = invokeMock.mock.calls[0]?.[1];
    expect(emailRequest.body.bodyHtml).toContain(
      "/festival/artist-form/token-1?lang=es",
    );
  });
});
