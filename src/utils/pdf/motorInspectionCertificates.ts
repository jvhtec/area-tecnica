import type { Color, PDFFont, PDFPage } from "pdf-lib";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import { buildPdfFilename } from "@/utils/pdf/shared/pdfExportShared";

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
};

export type GeneratedMotorCertificates = {
  blob: Blob;
  filename: string;
};

type WrappedTextOptions = {
  color: Color;
  font: PDFFont;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  x: number;
  y: number;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const TEXT_COLOR = { r: 0.12, g: 0.14, b: 0.16 };
const MUTED_COLOR = { r: 0.38, g: 0.42, b: 0.46 };
const ACCENT_COLOR = { r: 0.10, g: 0.42, b: 0.28 };

const formatSpanishDate = (isoDate: string, long: boolean): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  if (!long) return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${day} de ${months[month - 1]} de ${year}`;
};

const splitTextToLines = (
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const drawWrappedText = (
  page: PDFPage,
  text: string,
  options: WrappedTextOptions,
): number => {
  const lines = splitTextToLines(text, options.font, options.fontSize, options.maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.fontSize,
      font: options.font,
      color: options.color,
    });
  });
  return options.y - lines.length * options.lineHeight;
};

const buildFilename = (units: FlexMotorUnit[], jobName?: string | null): string => {
  if (units.length === 1) {
    return buildPdfFilename(["Certificado de motor", units[0].serial], "Certificado de motor");
  }
  return buildPdfFilename(
    ["Certificados de motores", jobName || `${units.length} motores`],
    "Certificados de motores",
  );
};

async function loadSignedMaintenancePage(
  supplied?: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer | Uint8Array> {
  if (supplied) return supplied;

  const response = await fetch(MOTOR_CERTIFICATE_SOURCE.signedMaintenancePageUrl);
  if (!response.ok) {
    throw new Error("No se pudo cargar la página firmada del certificado maestro.");
  }
  return response.arrayBuffer();
}

export async function generateMotorInspectionCertificates({
  units,
  jobName,
  signedMaintenancePageBytes,
}: GenerateMotorCertificatesOptions): Promise<GeneratedMotorCertificates> {
  if (units.length === 0) {
    throw new Error("Selecciona al menos un motor para generar certificados.");
  }

  const [{ PDFDocument, StandardFonts, rgb }, sourceBytes] = await Promise.all([
    import("pdf-lib"),
    loadSignedMaintenancePage(signedMaintenancePageBytes),
  ]);
  const signedPagePdf = await PDFDocument.load(sourceBytes);
  if (signedPagePdf.getPageCount() !== 1) {
    throw new Error("La plantilla firmada del certificado no contiene exactamente una página.");
  }

  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const sourcePage = signedPagePdf.getPage(0);
  const logoCrop = await output.embedPage(sourcePage, {
    left: 45,
    bottom: 770,
    right: 185,
    top: 835,
  });

  output.setTitle(buildFilename(units, jobName).replace(/\.pdf$/i, ""));
  output.setAuthor(MOTOR_CERTIFICATE_SOURCE.inspectionProvider);
  output.setCreator("Área Técnica - Sector Pro");
  output.setSubject("Certificado individual de revisión de motor eléctrico");
  output.setKeywords(["motor", "revisión", "mantenimiento", "SATPRO", "Sector Pro"]);

  for (const unit of units) {
    const page = output.addPage([A4_WIDTH, A4_HEIGHT]);

    page.drawPage(logoCrop, { x: 45, y: 765, width: 140, height: 65 });
    page.drawLine({
      start: { x: 52, y: 758 },
      end: { x: A4_WIDTH - 52, y: 758 },
      thickness: 0.7,
      color: rgb(0.84, 0.85, 0.86),
    });

    page.drawText(`En Sevilla a ${formatSpanishDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate, true)}.`, {
      x: 55,
      y: 718,
      size: 12,
      font: regular,
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
    });

    drawWrappedText(
      page,
      `La empresa ${MOTOR_CERTIFICATE_SOURCE.inspectionProvider} ha realizado las labores de chequeo y mantenimiento del motor eléctrico indicado a continuación, propiedad de ${MOTOR_CERTIFICATE_SOURCE.equipmentOwner}.`,
      {
        color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
        font: regular,
        fontSize: 12,
        lineHeight: 18,
        maxWidth: A4_WIDTH - 110,
        x: 55,
        y: 676,
      },
    );

    page.drawRectangle({
      x: 55,
      y: 345,
      width: A4_WIDTH - 110,
      height: 235,
      borderWidth: 1.2,
      borderColor: rgb(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b),
      color: rgb(0.975, 0.98, 0.976),
    });
    const headingWidth = bold.widthOfTextAtSize("CERTIFICADO INDIVIDUAL DE REVISIÓN", 14);
    page.drawText("CERTIFICADO INDIVIDUAL DE REVISIÓN", {
      x: (A4_WIDTH - headingWidth) / 2,
      y: 543,
      size: 14,
      font: bold,
      color: rgb(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b),
    });

    page.drawText("MOTOR ELÉCTRICO", {
      x: 78,
      y: 500,
      size: 9,
      font: bold,
      color: rgb(MUTED_COLOR.r, MUTED_COLOR.g, MUTED_COLOR.b),
    });
    drawWrappedText(page, unit.modelName, {
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
      font: bold,
      fontSize: 16,
      lineHeight: 21,
      maxWidth: A4_WIDTH - 156,
      x: 78,
      y: 478,
    });

    page.drawText("N.º DE SERIE", {
      x: 78,
      y: 420,
      size: 9,
      font: bold,
      color: rgb(MUTED_COLOR.r, MUTED_COLOR.g, MUTED_COLOR.b),
    });
    page.drawText(unit.serial, {
      x: 78,
      y: 389,
      size: 22,
      font: bold,
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
    });
    if (unit.barcode) {
      const barcodeText = `Código Flex: ${unit.barcode}`;
      page.drawText(barcodeText, {
        x: A4_WIDTH - 78 - regular.widthOfTextAtSize(barcodeText, 9),
        y: 390,
        size: 9,
        font: regular,
        color: rgb(MUTED_COLOR.r, MUTED_COLOR.g, MUTED_COLOR.b),
      });
    }

    page.drawText("Revisión realizada", {
      x: 78,
      y: 302,
      size: 9,
      font: bold,
      color: rgb(MUTED_COLOR.r, MUTED_COLOR.g, MUTED_COLOR.b),
    });
    page.drawText(formatSpanishDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate, false), {
      x: 78,
      y: 280,
      size: 13,
      font: bold,
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
    });
    page.drawText("Próxima revisión anual", {
      x: 320,
      y: 302,
      size: 9,
      font: bold,
      color: rgb(MUTED_COLOR.r, MUTED_COLOR.g, MUTED_COLOR.b),
    });
    page.drawText(formatSpanishDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate, false), {
      x: 320,
      y: 280,
      size: 13,
      font: bold,
      color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
    });

    drawWrappedText(
      page,
      "Las operaciones realizadas y la firma de la empresa mantenedora constan en la página siguiente.",
      {
        color: rgb(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b),
        font: regular,
        fontSize: 10,
        lineHeight: 15,
        maxWidth: A4_WIDTH - 156,
        x: 78,
        y: 230,
      },
    );

    page.drawLine({
      start: { x: 52, y: 78 },
      end: { x: A4_WIDTH - 52, y: 78 },
      thickness: 0.7,
      color: rgb(0.84, 0.85, 0.86),
    });
    const footer = "SATPRO, S.L.  C/ Juan Carlos I nº 25, 41220 Burguillos (Sevilla)  954 738388  ·  info@satpro.es";
    page.drawText(footer, {
      x: (A4_WIDTH - regular.widthOfTextAtSize(footer, 8)) / 2,
      y: 56,
      size: 8,
      font: regular,
      color: rgb(0.56, 0.58, 0.60),
    });

    const [signedPage] = await output.copyPages(signedPagePdf, [0]);
    output.addPage(signedPage);
  }

  const bytes = await output.save();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return {
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    filename: buildFilename(units, jobName),
  };
}
