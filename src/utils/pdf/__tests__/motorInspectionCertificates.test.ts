import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import type { MotorBrandKey } from "@/utils/pdf/motorBrandLogos";
import {
  loadMotorInspectionChecklists,
  type MotorInspectionChecklists,
} from "@/utils/pdf/motorInspectionChecklists";
import {
  generateMotorInspectionCertificates,
  MOTOR_CERTIFICATE_SOURCE,
} from "@/utils/pdf/motorInspectionCertificates";

const logoFileByBrand: Record<MotorBrandKey, string> = {
  chainmaster: "chainmaster.jpg",
  liftket: "liftket.png",
  cm: "cm.jpg",
};

const loadTestBrandLogo = (brand: MotorBrandKey): Promise<Buffer> =>
  readFile(resolve(process.cwd(), "src/assets/motor-brands", logoFileByBrand[brand]));

const loadTestChecklists = async (): Promise<MotorInspectionChecklists> => {
  const value: unknown = JSON.parse(await readFile(resolve(
    process.cwd(),
    "public/certificates/motor-inspection-checklists-2026.json",
  ), "utf8"));
  const fetchDocument = vi.fn().mockResolvedValue({ ok: true, json: async () => value });
  return loadMotorInspectionChecklists(fetchDocument as unknown as typeof fetch);
};

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

const createSignedPage = async (pageCount = 1): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  Array.from({ length: pageCount }, (_, index) => {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText(`Página firmada de prueba ${index + 1}`, { x: 50, y: 800 });
  });
  return pdf.save();
};

describe("generateMotorInspectionCertificates", () => {
  it("creates one branded signed two-page certificate per selected motor", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717"), unit("2", "J36724", "CM")],
      jobName: "Gira Norte",
      signedInspectionRecordBytes: await createSignedPage(),
      inspectionChecklists: await loadTestChecklists(),
      loadBrandLogo: loadTestBrandLogo,
    });

    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("Certificados de motores - Gira Norte");
    expect(pdf.getAuthor()).toBe("SATPRO, S.L.U.");
    expect(pdf.getSubject()).toContain("reemitido desde el acta SATPRO 2026");
    expect(result.filename).toBe("Certificados de motores - Gira Norte.pdf");
  });

  it("uses the serial number in a single-certificate filename", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717")],
      signedInspectionRecordBytes: await createSignedPage(),
      inspectionChecklists: await loadTestChecklists(),
      loadBrandLogo: loadTestBrandLogo,
    });
    expect(result.filename).toBe("Certificado de motor - J36717.pdf");
  });

  it("supports an unknown manufacturer without requiring a logo", async () => {
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717", "Fabricante sin logo", "Motor D8+ 750 kg")],
      signedInspectionRecordBytes: await createSignedPage(),
      inspectionChecklists: await loadTestChecklists(),
    });
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
  });

  it("continues without branding when a local logo cannot be loaded", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await generateMotorInspectionCertificates({
      units: [unit("1", "J36717")],
      signedInspectionRecordBytes: await createSignedPage(),
      inspectionChecklists: await loadTestChecklists(),
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
      signedInspectionRecordBytes: await createSignedPage(),
    })).rejects.toThrow("Selecciona al menos un motor");
  });

  it("rejects an archived source that is not exactly one page", async () => {
    await expect(generateMotorInspectionCertificates({
      units: [unit("1", "J36717")],
      signedInspectionRecordBytes: await createSignedPage(2),
      inspectionChecklists: await loadTestChecklists(),
      loadBrandLogo: loadTestBrandLogo,
    })).rejects.toThrow("no contiene exactamente una página");
  });

  it("keeps a 12-row manufacturer checklist for every supported brand", async () => {
    const { generic, ...manufacturerChecklists } = await loadTestChecklists();
    expect(Object.keys(manufacturerChecklists)).toEqual(["chainmaster", "liftket", "cm"]);
    Object.values(manufacturerChecklists).forEach((checklist) => {
      expect(checklist.checks).toHaveLength(12);
      expect(checklist.source).not.toHaveLength(0);
      expect(checklist.manufacturerSpecific).toBe(true);
    });
    expect(generic.manufacturerSpecific).toBe(false);
  });

  it("rejects a malformed checklist document", async () => {
    const fetchDocument = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "2026.1", campaignYear: 2026, checklists: {} }),
    });
    await expect(loadMotorInspectionChecklists(fetchDocument as unknown as typeof fetch))
      .rejects.toThrow("no es válido");
  });

  it("pins the archived SATPRO record to its documented checksum", async () => {
    const bytes = await readFile(resolve(
      process.cwd(),
      "public/certificates/revision-motores-2026-pagina-firmada.pdf",
    ));
    const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    expect(hash).toBe(MOTOR_CERTIFICATE_SOURCE.archivedSignedInspectionSha256);
  });
});
