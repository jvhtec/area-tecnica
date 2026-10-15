// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadPdfBlob } from "../downloadPdfBlob";

describe("downloadPdfBlob", () => {
  const url = "blob:https://app.test/generated-report";

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => url),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dispatches a download, removes the anchor, and defers blob revocation", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.href).toBe(url);
      expect(this.download).toBe("Power Report.pdf");
    });
    const before = window.location.href;
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });

    downloadPdfBlob(pdf, "Power Report.pdf");

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(pdf);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="Power Report.pdf"]')).toBeNull();
    expect(window.location.href).toBe(before);
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);

    expect(window.URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });

  it("cleans up the anchor and URL when the browser refuses the download", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });

    expect(() => downloadPdfBlob(new Blob(["%PDF"]), "Weights.pdf")).toThrow("download blocked");
    expect(document.querySelector('a[download="Weights.pdf"]')).toBeNull();
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });
});
