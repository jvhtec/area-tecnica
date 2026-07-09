import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertAllowedStorageSourceUrl,
  fetchMemoriaSource,
  getSupportedImageFormat,
  isPdfBytes,
  parseMemoriaRequestInput,
  SourceByteBudget,
} from "./memoriaInput.ts";

const projectUrl = "https://project.supabase.co";
const signedSource = `${projectUrl}/storage/v1/object/sign/memoria-tecnica/report.pdf?token=opaque-token`;

afterEach(() => vi.unstubAllGlobals());

describe("memoria PDF security boundary", () => {
  it("only accepts this project's supported Storage object URLs", () => {
    expect(assertAllowedStorageSourceUrl(signedSource, projectUrl)).toBe(signedSource);
    expect(() => assertAllowedStorageSourceUrl("https://example.com/report.pdf", projectUrl)).toThrow(
      "Source must be a Supabase Storage object URL",
    );
    expect(() => assertAllowedStorageSourceUrl(
      `${projectUrl}/storage/v1/object/sign/memoria-tecnica/report.pdf`,
      projectUrl,
    )).toThrow("Signed storage URLs require a token");
    expect(() => assertAllowedStorageSourceUrl(
      `${projectUrl}/rest/v1/profiles`,
      projectUrl,
    )).toThrow("Source must be a Supabase Storage object URL");
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
    }, projectUrl, ["material"])).toThrow("Unsupported document key");
    expect(() => parseMemoriaRequestInput({
      projectName: "\u0000",
      documentUrls: { material: signedSource },
    }, projectUrl, ["material"])).toThrow("projectName must be");
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
});
