import { describe, expect, it } from "vitest";
import { inferPdfImageFormat, setFontStyle } from "@/utils/pdf/shared/pdfExportShared";
import type { jsPDF } from "jspdf";

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

describe("setFontStyle", () => {
  it("keeps the active font family while changing style", () => {
    const calls: unknown[][] = [];
    const doc = {
      getFont: () => ({ fontName: "SectorSans" }),
      setFont: (...args: unknown[]) => { calls.push(args); },
    } as unknown as jsPDF;

    setFontStyle(doc, "bold");

    expect(calls).toEqual([["SectorSans", "bold"]]);
  });
});
