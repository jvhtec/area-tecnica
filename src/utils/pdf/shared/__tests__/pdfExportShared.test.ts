import { describe, expect, it } from "vitest";
import { inferPdfImageFormat } from "@/utils/pdf/shared/pdfExportShared";

describe("inferPdfImageFormat", () => {
  it.each([
    ["https://example.com/logo.png?version=2", "PNG"],
    ["https://example.com/logo.JPEG#asset", "JPEG"],
    ["data:image/png;base64,abc", "PNG"],
    ["data:image/jpeg;base64,abc", "JPEG"],
  ] as const)("infers %s", (source, expected) => {
    expect(inferPdfImageFormat(source)).toBe(expected);
  });

  it("uses the requested fallback for URLs without an extension", () => {
    expect(inferPdfImageFormat("https://example.com/image/123", "JPEG")).toBe(
      "JPEG",
    );
  });
});
