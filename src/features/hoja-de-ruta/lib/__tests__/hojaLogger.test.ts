import { beforeEach, describe, expect, it, vi } from "vitest";

const { trackError } = vi.hoisted(() => ({ trackError: vi.fn() }));

vi.mock("@/lib/errorTracking", () => ({ trackError }));

describe("Hoja privacy logger", () => {
  beforeEach(() => {
    trackError.mockReset();
    vi.resetModules();
  });

  it("reports only a static operation and recognized error code", async () => {
    const { reportHojaError } = await import("@/features/hoja-de-ruta/lib/hojaLogger");
    const sensitive = Object.assign(
      new Error("DNI 12345678Z, teléfono 600123123"),
      { code: "40001", profile: { dni: "12345678Z" } },
    );

    reportHojaError("document.save", sensitive);

    expect(trackError).toHaveBeenCalledTimes(1);
    const [reportedError, context] = trackError.mock.calls[0];
    expect(reportedError).toMatchObject({
      name: "HojaDeRutaError",
      message: "Hoja de Ruta operation failed",
    });
    expect(context).toEqual({
      system: "documents",
      operation: "document.save",
      causeCode: "40001",
    });
    expect(JSON.stringify([reportedError, context])).not.toContain("12345678Z");
    expect(JSON.stringify([reportedError, context])).not.toContain("600123123");
  });

  it("normalizes unsafe operation names and drops arbitrary error codes", async () => {
    const { reportHojaError } = await import("@/features/hoja-de-ruta/lib/hojaLogger");

    reportHojaError("user-12345678Z", { code: "secret-code" });

    expect(trackError).toHaveBeenCalledWith(
      expect.any(Error),
      { system: "documents", operation: "unknown" },
    );
  });
});
