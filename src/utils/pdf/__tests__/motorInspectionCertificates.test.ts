import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import { generateMotorInspectionCertificates } from "@/utils/pdf/motorInspectionCertificates";

const unit = (id: string, serial: string): FlexMotorUnit => ({
  id,
  modelId: "model-1",
  modelName: "Motor eléctrico de elevación ChainMaster D8+ 750 kg - 24 m",
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
  it("creates one two-page certificate per selected motor", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717"), unit("2", "J36724")],
      jobName: "Gira Norte",
      signedMaintenancePageBytes: await createSignedPage(),
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
    });
    expect(result.filename).toBe("Certificado de motor - J36717.pdf");
  });

  it("refuses to generate an empty certificate batch", async () => {
    await expect(generateMotorInspectionCertificates({
      units: [],
      signedMaintenancePageBytes: await createSignedPage(),
    })).rejects.toThrow("Selecciona al menos un motor");
  });
});
