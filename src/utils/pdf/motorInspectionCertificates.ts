import { format, parseISO } from "date-fns";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import { buildReadableFilename } from "@/utils/fileName";
import {
  loadMotorBrandLogo,
  MOTOR_BRAND_LOGOS,
  resolveMotorBrandKey,
  type MotorBrandKey,
} from "@/utils/pdf/motorBrandLogos";

export const MOTOR_CERTIFICATE_SOURCE = {
  inspectionDate: "2026-05-21",
  nextAnnualInspectionDate: "2027-05-21",
  inspectionProvider: "SATPRO, S.L.U.",
  equipmentOwner: "PRODUCTION SECTOR, S.L.",
  signedMaintenancePageUrl: "/certificates/revision-motores-2026-pagina-firmada.pdf",
} as const;

type GenerateMotorCertificatesOptions = {
  units: FlexMotorUnit[];
  jobName?: string | null;
  signedMaintenancePageBytes?: ArrayBuffer | Uint8Array;
  loadBrandLogo?: (brand: MotorBrandKey) => Promise<ArrayBuffer | Uint8Array>;
};

export type GeneratedMotorCertificates = {
  blob: Blob;
  filename: string;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const formatDate = (isoDate: string): string => format(parseISO(isoDate), "dd/MM/yyyy");

const buildFilename = (units: FlexMotorUnit[], jobName?: string | null): string => {
  if (units.length === 1) {
    return buildReadableFilename(["Certificado de motor", units[0].serial]);
  }
  return buildReadableFilename(["Certificados de motores", jobName || `${units.length} motores`]);
};

const loadSignedPage = async (
  supplied?: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer | Uint8Array> => {
  if (supplied) return supplied;
  const response = await fetch(MOTOR_CERTIFICATE_SOURCE.signedMaintenancePageUrl);
  if (!response.ok) throw new Error("No se pudo cargar la página firmada del certificado maestro.");
  return response.arrayBuffer();
};

/** Fits an image within a bounded area without upscaling it. */
const fitImage = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
};

/** Truncates PDF text to a measured width while keeping the result explicit. */
const truncateTextToWidth = (
  value: string,
  maxWidth: number,
  measureText: (text: string) => number,
): string => {
  if (measureText(value) <= maxWidth) return value;

  const suffix = "...";
  let end = value.length;
  while (end > 0 && measureText(`${value.slice(0, end).trimEnd()}${suffix}`) > maxWidth) {
    end -= 1;
  }
  return `${value.slice(0, end).trimEnd()}${suffix}`;
};

/** Generates one identity page plus the signed maintenance page for every selected motor. */
export async function generateMotorInspectionCertificates({
  units,
  jobName,
  signedMaintenancePageBytes,
  loadBrandLogo = loadMotorBrandLogo,
}: GenerateMotorCertificatesOptions): Promise<GeneratedMotorCertificates> {
  if (units.length === 0) {
    throw new Error("Selecciona al menos un motor para generar certificados.");
  }

  const [{ PDFDocument, StandardFonts, rgb }, sourceBytes] = await Promise.all([
    import("pdf-lib"),
    loadSignedPage(signedMaintenancePageBytes),
  ]);
  const signedPdf = await PDFDocument.load(sourceBytes);
  if (signedPdf.getPageCount() !== 1) {
    throw new Error("La plantilla firmada del certificado no contiene exactamente una página.");
  }

  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const logo = await output.embedPage(signedPdf.getPage(0), {
    left: 45,
    bottom: 770,
    right: 185,
    top: 835,
  });
  output.setTitle(buildFilename(units, jobName).replace(/\.pdf$/i, ""));

  const requiredBrands = new Set(
    units
      .map((unit) => resolveMotorBrandKey(unit.manufacturer, unit.modelName))
      .filter((brand): brand is MotorBrandKey => brand !== null),
  );
  const embeddedBrandLogos = new Map<MotorBrandKey, Awaited<ReturnType<typeof output.embedPng>>>();
  for (const brand of requiredBrands) {
    const asset = MOTOR_BRAND_LOGOS[brand];
    try {
      const bytes = await loadBrandLogo(brand);
      const embedded = asset.mimeType === "image/png"
        ? await output.embedPng(bytes)
        : await output.embedJpg(bytes);
      embeddedBrandLogos.set(brand, embedded);
    } catch (error) {
      console.warn("No se pudo incrustar el logotipo del fabricante; se generará sin marca.", {
        brand,
        error,
      });
    }
  }

  for (const unit of units) {
    const page = output.addPage([A4_WIDTH, A4_HEIGHT]);
    const dark = rgb(0.12, 0.14, 0.16);
    const muted = rgb(0.38, 0.42, 0.46);
    const green = rgb(0.10, 0.42, 0.28);

    page.drawPage(logo, { x: 45, y: 765, width: 140, height: 65 });
    const brand = resolveMotorBrandKey(unit.manufacturer, unit.modelName);
    const brandLogo = brand ? embeddedBrandLogos.get(brand) : undefined;

    page.drawText("CERTIFICADO INDIVIDUAL DE REVISIÓN", {
      x: 55,
      y: 700,
      size: 18,
      font: bold,
      color: green,
    });
    page.drawText("MOTOR ELÉCTRICO", { x: 55, y: 672, size: 12, font: bold, color: muted });
    page.drawText(
      `${MOTOR_CERTIFICATE_SOURCE.inspectionProvider} certifica la revisión y el mantenimiento del motor indicado,`,
      { x: 55, y: 625, size: 11, font: regular, color: dark },
    );
    page.drawText(`propiedad de ${MOTOR_CERTIFICATE_SOURCE.equipmentOwner}.`, {
      x: 55,
      y: 606,
      size: 11,
      font: regular,
      color: dark,
    });

    page.drawRectangle({
      x: 55,
      y: 335,
      width: A4_WIDTH - 110,
      height: 215,
      borderWidth: 1.2,
      borderColor: green,
      color: rgb(0.975, 0.98, 0.976),
    });
    let manufacturerMaxWidth = A4_WIDTH - 156;
    if (brandLogo) {
      const dimensions = fitImage(brandLogo.width, brandLogo.height, 140, 38);
      const logoX = A4_WIDTH - 78 - dimensions.width;
      page.drawImage(brandLogo, {
        x: logoX,
        y: 530 - dimensions.height,
        width: dimensions.width,
        height: dimensions.height,
      });
      manufacturerMaxWidth = Math.max(120, logoX - 94);
    }
    page.drawText("FABRICANTE", { x: 78, y: 510, size: 9, font: bold, color: muted });
    const manufacturer = unit.manufacturer || "No indicado en Flex";
    page.drawText(truncateTextToWidth(
      manufacturer,
      manufacturerMaxWidth,
      (text) => bold.widthOfTextAtSize(text, 13),
    ), {
      x: 78,
      y: 486,
      size: 13,
      font: bold,
      color: dark,
    });
    page.drawText("MODELO", { x: 78, y: 447, size: 9, font: bold, color: muted });
    page.drawText(unit.modelName.slice(0, 62), { x: 78, y: 423, size: 13, font: bold, color: dark });
    page.drawText("N.º DE SERIE", { x: 78, y: 382, size: 9, font: bold, color: muted });
    page.drawText(unit.serial, { x: 78, y: 350, size: 22, font: bold, color: dark });
    if (unit.barcode) {
      page.drawText(`Código Flex: ${unit.barcode}`, { x: 330, y: 352, size: 9, font: regular, color: muted });
    }

    page.drawText("Revisión realizada", { x: 78, y: 292, size: 9, font: bold, color: muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate), {
      x: 78,
      y: 269,
      size: 13,
      font: bold,
      color: dark,
    });
    page.drawText("Próxima revisión anual", { x: 320, y: 292, size: 9, font: bold, color: muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate), {
      x: 320,
      y: 269,
      size: 13,
      font: bold,
      color: dark,
    });
    page.drawText("Las operaciones realizadas y la firma de la empresa mantenedora constan en la página siguiente.", {
      x: 78,
      y: 210,
      size: 9,
      font: regular,
      color: dark,
    });
    page.drawText("Marca y modelo obtenidos del registro de inventario de Flex.", {
      x: 78,
      y: 194,
      size: 8,
      font: regular,
      color: muted,
    });

    const [signedPage] = await output.copyPages(signedPdf, [0]);
    output.addPage(signedPage);
  }

  const bytes = await output.save();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return {
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    filename: buildFilename(units, jobName),
  };
}
