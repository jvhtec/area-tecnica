import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import type { MotorBrandKey } from "@/utils/pdf/motorBrandLogos";
import { generateMotorInspectionCertificates } from "@/utils/pdf/motorInspectionCertificates";

const logoFileByBrand: Record<MotorBrandKey, string> = {
  chainmaster: "chainmaster.jpg",
  liftket: "liftket.png",
  cm: "cm.jpg",
};

const loadTestBrandLogo = (brand: MotorBrandKey): Promise<Buffer> =>
  readFile(resolve(process.cwd(), "src/assets/motor-brands", logoFileByBrand[brand]));

const unit = (
  id: string,
  serial: string,
  manufacturer = "ChainMaster",
  modelName = "ChainMaster D8+ 750 kg",
): FlexMotorUnit => ({
  id,
  modelId: "model-1",
  modelName,
  manufacturer,
  serial,
  barcode: `BAR-${id}`,
  stencil: null,
  modelNumber: null,
  currentLocation: "Almacén",
  shippedDate: null,
  returnDate: null,
});

const createSignedPage = async (): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText("Página firmada de prueba", { x: 50, y: 800 });
  return pdf.save();
};

describe("generateMotorInspectionCertificates", () => {
  it("creates one branded two-page certificate per selected motor", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717"), unit("2", "J36724", "CM")],
      jobName: "Gira Norte",
      signedMaintenancePageBytes: await createSignedPage(),
      loadBrandLogo: loadTestBrandLogo,
    });

    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("Certificados de motores - Gira Norte");
    expect(result.filename).toBe("Certificados de motores - Gira Norte.pdf");
  });

  it("uses the serial number in a single-certificate filename", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717")],
      signedMaintenancePageBytes: await createSignedPage(),
      loadBrandLogo: loadTestBrandLogo,
    });
    expect(result.filename).toBe("Certificado de motor - J36717.pdf");
  });

  it("supports an unknown manufacturer without requiring a logo", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717", "Fabricante sin logo", "Motor D8+ 750 kg")],
      signedMaintenancePageBytes: await createSignedPage(),
    });
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
  });

  it("continues without branding when a local logo cannot be loaded", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717")],
      signedMaintenancePageBytes: await createSignedPage(),
      loadBrandLogo: vi.fn().mockRejectedValue(new Error("asset unavailable")),
    });

    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
    expect(warning).toHaveBeenCalledWith(
      "No se pudo incrustar el logotipo del fabricante; se generará sin marca.",
      expect.objectContaining({ brand: "chainmaster" }),
    );
    warning.mockRestore();
  });

  it("refuses to generate an empty certificate batch", async () => {
    await expect(generateMotorInspectionCertificates({
      units: [],
      signedMaintenancePageBytes: await createSignedPage(),
    })).rejects.toThrow("Selecciona al menos un motor");
  });
});
