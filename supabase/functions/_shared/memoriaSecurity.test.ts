import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertAllowedStorageSourceUrl,
  fetchMemoriaSource,
  getSupportedImageFormat,
  isPdfBytes,
  MAX_MEMORIA_PDF_BYTES,
  parseMemoriaRequestInput,
  reportMemoriaDocumentFailure,
  SourceByteBudget,
} from "./memoriaInput.ts";

const projectUrl = "https://project.supabase.co";
const signedSource = `${projectUrl}/storage/v1/object/sign/memoria-tecnica/report.pdf?token=opaque-token`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("memoria PDF security boundary", () => {
  it("only accepts this project's supported Storage object URLs", () => {
    expect(assertAllowedStorageSourceUrl(signedSource, projectUrl)).toBe(signedSource);
    expect(() => assertAllowedStorageSourceUrl("https://example.com/report.pdf", projectUrl)).toThrow(
      "El origen debe ser una URL de objeto de Supabase Storage",
    );
    expect(() => assertAllowedStorageSourceUrl(
      `${projectUrl}/storage/v1/object/sign/memoria-tecnica/report.pdf`,
      projectUrl,
    )).toThrow("Las URL firmadas de almacenamiento requieren un token");
    expect(() => assertAllowedStorageSourceUrl(
      `${projectUrl}/rest/v1/profiles`,
      projectUrl,
    )).toThrow("El origen debe ser una URL de objeto de Supabase Storage");
  });

  it("whitelists document keys and rejects malformed request values", () => {
    expect(parseMemoriaRequestInput({
      projectName: "Festival Norte",
      documentUrls: { material: signedSource },
      logoUrl: null,
    }, projectUrl, ["material"])).toEqual({
      projectName: "Festival Norte",
      documentUrls: { material: signedSource },
      logoUrl: null,
    });

    expect(() => parseMemoriaRequestInput({
      projectName: "Festival Norte",
      documentUrls: { arbitrary: signedSource },
    }, projectUrl, ["material"])).toThrow("Clave de documento no admitida");
    expect(() => parseMemoriaRequestInput({
      projectName: "\u0000",
      documentUrls: { material: signedSource },
    }, projectUrl, ["material"])).toThrow("El nombre del proyecto debe ser");
  });

  it("bounds source downloads and preserves only PDF/image signatures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))));

    const bytes = await fetchMemoriaSource(signedSource, new SourceByteBudget(10));
    expect(isPdfBytes(bytes)).toBe(true);
    expect(getSupportedImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(getSupportedImageFormat(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("jpg");
    expect(getSupportedImageFormat(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4, 5]))));
    await expect(fetchMemoriaSource(signedSource, new SourceByteBudget(4))).rejects.toMatchObject({
      status: 413,
      code: "source_total_too_large",
    });
  });

  it("accepts the diagnosed 16.53 MiB PDF below the new 20 MiB limit", async () => {
    const diagnosedSoundVisionBytes = 17_336_566;
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        headers: { "content-length": String(diagnosedSoundVisionBytes) },
      })
    ));

    await expect(
      fetchMemoriaSource(signedSource, new SourceByteBudget()),
    ).resolves.toHaveLength(5);
    expect(MAX_MEMORIA_PDF_BYTES).toBe(20 * 1024 * 1024);
  });

  it("rejects and records a PDF above 20 MiB without logging its signed URL", async () => {
    const oversizedBytes = MAX_MEMORIA_PDF_BYTES + 1;
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        headers: { "content-length": String(oversizedBytes) },
      })
    ));

    const sourceError = await fetchMemoriaSource(
      signedSource,
      new SourceByteBudget(),
    ).catch((error) => error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reported = reportMemoriaDocumentFailure(
      "generate-memoria-tecnica",
      "soundvision",
      "Informe SoundVision",
      sourceError,
    );

    expect(reported).toMatchObject({
      status: 413,
      code: "source_too_large",
      message: "El documento «Informe SoundVision» supera el límite de 20 MB",
    });
    expect(consoleError).toHaveBeenCalledWith("memoria_document_rejected", {
      actualBytes: oversizedBytes,
      attemptedBytes: undefined,
      code: "source_too_large",
      documentKey: "soundvision",
      documentLabel: "Informe SoundVision",
      functionName: "generate-memoria-tecnica",
      maxBytes: MAX_MEMORIA_PDF_BYTES,
      message: "El documento «Informe SoundVision» supera el límite de 20 MB",
      measurement: "content-length",
      status: 413,
      usedBytes: undefined,
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("opaque-token");
  });
});
