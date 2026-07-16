import { format, parseISO } from "date-fns";
import type { PDFEmbeddedPage, PDFFont, PDFPage, RGB } from "pdf-lib";

import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import { buildReadableFilename } from "@/utils/fileName";
import {
  loadMotorBrandLogo,
  MOTOR_BRAND_LOGOS,
  resolveMotorBrandKey,
  type MotorBrandKey,
} from "@/utils/pdf/motorBrandLogos";
import {
  loadMotorInspectionChecklists,
  resolveMotorInspectionChecklist,
  type MotorInspectionChecklist,
  type MotorInspectionChecklists,
} from "@/utils/pdf/motorInspectionChecklists";

export const MOTOR_CERTIFICATE_SOURCE = {
  inspectionDate: "2026-05-21",
  nextAnnualInspectionDate: "2027-05-21",
  inspectionProvider: "SATPRO, S.L.U.",
  equipmentOwner: "PRODUCTION SECTOR, S.L.",
  archivedSignedInspectionUrl: "/certificates/revision-motores-2026-pagina-firmada.pdf",
  archivedSignedInspectionSha256: "495BCF394690A7387BF1C1755BCA815756B89924C30DA1F7845F1D0183C406CF",
} as const;

type GenerateMotorCertificatesOptions = {
  units: FlexMotorUnit[];
  jobName?: string | null;
  signedInspectionRecordBytes?: ArrayBuffer | Uint8Array;
  inspectionChecklists?: MotorInspectionChecklists;
  loadBrandLogo?: (brand: MotorBrandKey) => Promise<ArrayBuffer | Uint8Array>;
};

export type GeneratedMotorCertificates = {
  blob: Blob;
  filename: string;
};

type CertificateColors = {
  dark: RGB;
  muted: RGB;
  green: RGB;
  pale: RGB;
  panel: RGB;
  white: RGB;
  grid: RGB;
};

type CertificateFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const TABLE_X = 51;
const TABLE_WIDTHS = [80, 260, 26, 26, 26, 75] as const;
const TABLE_HEADER_HEIGHT = 20;
const TABLE_FONT_SIZE = 7.1;
const TABLE_LINE_HEIGHT = 8.7;

const formatDate = (isoDate: string): string => format(parseISO(isoDate), "dd/MM/yyyy");

const buildFilename = (units: FlexMotorUnit[], jobName?: string | null): string => {
  if (units.length === 1) {
    return buildReadableFilename(["Certificado de motor", units[0].serial]);
  }
  return buildReadableFilename(["Certificados de motores", jobName || `${units.length} motores`]);
};

const loadSignedInspectionRecord = async (
  supplied?: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer | Uint8Array> => {
  if (supplied) return supplied;
  const response = await fetch(MOTOR_CERTIFICATE_SOURCE.archivedSignedInspectionUrl);
  if (!response.ok) throw new Error("No se pudo cargar el acta SATPRO 2026 archivada.");
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

const wrapText = (
  value: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
): string[] => {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const drawLines = (
  page: PDFPage,
  lines: readonly string[],
  x: number,
  topY: number,
  font: PDFFont,
  size: number,
  color: RGB,
  lineHeight: number,
) => {
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: topY - size - (index * lineHeight),
      size,
      font,
      color,
    });
  });
};

const drawCheckbox = (
  page: PDFPage,
  x: number,
  y: number,
  checked: boolean,
  colors: CertificateColors,
) => {
  page.drawRectangle({
    x,
    y,
    width: 9,
    height: 9,
    borderWidth: 0.7,
    borderColor: checked ? colors.green : colors.muted,
  });
  if (!checked) return;

  page.drawLine({
    start: { x: x + 1.5, y: y + 4.4 },
    end: { x: x + 3.7, y: y + 2.1 },
    thickness: 1.35,
    color: colors.green,
  });
  page.drawLine({
    start: { x: x + 3.7, y: y + 2.1 },
    end: { x: x + 7.7, y: y + 7.2 },
    thickness: 1.35,
    color: colors.green,
  });
};

const drawCell = (
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: CertificateColors,
  fill?: RGB,
) => {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 0.35,
    borderColor: colors.grid,
    color: fill,
  });
};

const drawInspectionTable = (
  page: PDFPage,
  checklist: MotorInspectionChecklist,
  fonts: CertificateFonts,
  colors: CertificateColors,
) => {
  const headings = ["ÁREA", "VERIFICACIÓN", "C", "NC", "N/A", "OBSERVACIONES"];
  let cursorX = TABLE_X;
  const headerBottom = 609 - TABLE_HEADER_HEIGHT;

  headings.forEach((heading, index) => {
    const width = TABLE_WIDTHS[index];
    drawCell(page, cursorX, headerBottom, width, TABLE_HEADER_HEIGHT, colors, colors.pale);
    const centered = index >= 2 && index <= 4;
    const headingWidth = fonts.bold.widthOfTextAtSize(heading, 7.2);
    page.drawText(heading, {
      x: centered ? cursorX + ((width - headingWidth) / 2) : cursorX + 4,
      y: headerBottom + 6,
      size: 7.2,
      font: fonts.bold,
      color: colors.green,
    });
    cursorX += width;
  });

  let rowTop = headerBottom;
  checklist.checks.forEach(({ area, verification }) => {
    const areaLines = wrapText(area, TABLE_WIDTHS[0] - 8, fonts.bold, TABLE_FONT_SIZE);
    const verificationLines = wrapText(
      verification,
      TABLE_WIDTHS[1] - 8,
      fonts.regular,
      TABLE_FONT_SIZE,
    );
    const lineCount = Math.max(areaLines.length, verificationLines.length);
    const rowHeight = Math.max(22, (lineCount * TABLE_LINE_HEIGHT) + 7);
    const rowBottom = rowTop - rowHeight;

    cursorX = TABLE_X;
    TABLE_WIDTHS.forEach((width) => {
      drawCell(page, cursorX, rowBottom, width, rowHeight, colors);
      cursorX += width;
    });

    const textTop = rowTop - ((rowHeight - (lineCount * TABLE_LINE_HEIGHT)) / 2) + 1;
    drawLines(page, areaLines, TABLE_X + 4, textTop, fonts.bold, TABLE_FONT_SIZE, colors.green, TABLE_LINE_HEIGHT);
    drawLines(
      page,
      verificationLines,
      TABLE_X + TABLE_WIDTHS[0] + 4,
      textTop,
      fonts.regular,
      TABLE_FONT_SIZE,
      colors.dark,
      TABLE_LINE_HEIGHT,
    );

    const statusStart = TABLE_X + TABLE_WIDTHS[0] + TABLE_WIDTHS[1];
    const checkboxY = rowBottom + ((rowHeight - 9) / 2);
    drawCheckbox(page, statusStart + ((TABLE_WIDTHS[2] - 9) / 2), checkboxY, true, colors);
    drawCheckbox(
      page,
      statusStart + TABLE_WIDTHS[2] + ((TABLE_WIDTHS[3] - 9) / 2),
      checkboxY,
      false,
      colors,
    );
    drawCheckbox(
      page,
      statusStart + TABLE_WIDTHS[2] + TABLE_WIDTHS[3] + ((TABLE_WIDTHS[4] - 9) / 2),
      checkboxY,
      false,
      colors,
    );
    rowTop = rowBottom;
  });
};

const drawInspectionPage = ({
  page,
  unit,
  checklist,
  signatureSeal,
  fonts,
  colors,
}: {
  page: PDFPage;
  unit: FlexMotorUnit;
  checklist: MotorInspectionChecklist;
  signatureSeal: PDFEmbeddedPage;
  fonts: CertificateFonts;
  colors: CertificateColors;
}) => {
  page.drawRectangle({ x: 0, y: A4_HEIGHT - 36, width: A4_WIDTH, height: 36, color: colors.green });
  page.drawText("REEMISIÓN 2026 · FORMATO ACTUALIZADO", {
    x: 51,
    y: A4_HEIGHT - 23,
    size: 8.5,
    font: fonts.bold,
    color: colors.white,
  });
  page.drawText("REGISTRO TÉCNICO DE INSPECCIÓN", {
    x: 51,
    y: 765,
    size: 18,
    font: fonts.bold,
    color: colors.green,
  });
  page.drawText(checklist.label, { x: 51, y: 744, size: 10, font: fonts.bold, color: colors.muted });

  page.drawRectangle({
    x: 51,
    y: 674,
    width: 493,
    height: 49,
    borderWidth: 1.1,
    borderColor: colors.green,
    color: colors.panel,
  });
  page.drawText("FABRICANTE / MODELO / SERIE", {
    x: 63,
    y: 708,
    size: 6.7,
    font: fonts.bold,
    color: colors.muted,
  });
  page.drawText("REVISIÓN / PRÓXIMA", {
    x: 405,
    y: 708,
    size: 6.7,
    font: fonts.bold,
    color: colors.muted,
  });
  const identity = `${unit.manufacturer || "Fabricante no indicado"} · ${unit.modelName} · ${unit.serial}`;
  page.drawText(truncateTextToWidth(
    identity,
    325,
    (text) => fonts.bold.widthOfTextAtSize(text, 8.3),
  ), {
    x: 63,
    y: 690,
    size: 8.3,
    font: fonts.bold,
    color: colors.dark,
  });
  page.drawText(
    `${formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate)} · ${formatDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate)}`,
    { x: 405, y: 690, size: 8.3, font: fonts.bold, color: colors.dark },
  );

  page.drawText("Fuente:", { x: 51, y: 650, size: 6.8, font: fonts.bold, color: colors.muted });
  drawLines(
    page,
    wrapText(checklist.source, 447, fonts.regular, 6.8),
    78,
    656,
    fonts.regular,
    6.8,
    colors.muted,
    8.2,
  );
  page.drawText("Resultado:", { x: 51, y: 633, size: 6.8, font: fonts.bold, color: colors.muted });
  const resultText = checklist.result.replace(
    "{inspectionDate}",
    formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate),
  );
  drawLines(
    page,
    wrapText(
      resultText,
      441,
      fonts.regular,
      6.8,
    ),
    90,
    639,
    fonts.regular,
    6.8,
    colors.muted,
    8.2,
  );

  drawInspectionTable(page, checklist, fonts, colors);

  page.drawLine({ start: { x: 51, y: 94 }, end: { x: 222, y: 94 }, thickness: 0.6, color: colors.muted });
  page.drawLine({ start: { x: 242, y: 94 }, end: { x: 391, y: 94 }, thickness: 0.6, color: colors.muted });
  page.drawText("Empresa mantenedora: SATPRO S.L.U.", {
    x: 51,
    y: 82,
    size: 6.8,
    font: fonts.regular,
    color: colors.muted,
  });
  page.drawText(`Fecha: ${formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate)}`, {
    x: 242,
    y: 82,
    size: 6.8,
    font: fonts.regular,
    color: colors.muted,
  });
  page.drawPage(signatureSeal, { x: 427, y: 60, width: 106, height: 96 });
  page.drawText("Firma y sello SATPRO", {
    x: 436,
    y: 49,
    size: 6.8,
    font: fonts.regular,
    color: colors.muted,
  });

  page.drawText("Reemitido desde el acta SATPRO 2026; firma y sello reproducidos con autorización de SATPRO.", {
    x: 51,
    y: 28,
    size: 6.2,
    font: fonts.bold,
    color: colors.green,
  });
  page.drawText(`Origen archivado · SHA-256 ${MOTOR_CERTIFICATE_SOURCE.archivedSignedInspectionSha256}`, {
    x: 51,
    y: 17,
    size: 5.7,
    font: fonts.regular,
    color: colors.muted,
  });
  page.drawText("Página 2 de 2", {
    x: 496,
    y: 17,
    size: 6.3,
    font: fonts.bold,
    color: colors.muted,
  });
};

/** Generates an identity page and a signed manufacturer-specific inspection record per motor. */
export async function generateMotorInspectionCertificates({
  units,
  jobName,
  signedInspectionRecordBytes,
  inspectionChecklists,
  loadBrandLogo = loadMotorBrandLogo,
}: GenerateMotorCertificatesOptions): Promise<GeneratedMotorCertificates> {
  if (units.length === 0) {
    throw new Error("Selecciona al menos un motor para generar certificados.");
  }

  const [{ PDFDocument, StandardFonts, rgb }, sourceBytes, checklists] = await Promise.all([
    import("pdf-lib"),
    loadSignedInspectionRecord(signedInspectionRecordBytes),
    inspectionChecklists ?? loadMotorInspectionChecklists(),
  ]);
  const signedPdf = await PDFDocument.load(sourceBytes);
  if (signedPdf.getPageCount() !== 1) {
    throw new Error("El acta SATPRO 2026 archivada no contiene exactamente una página.");
  }

  const output = await PDFDocument.create();
  const fonts = {
    regular: await output.embedFont(StandardFonts.Helvetica),
    bold: await output.embedFont(StandardFonts.HelveticaBold),
  } satisfies CertificateFonts;
  const colors = {
    dark: rgb(0.12, 0.14, 0.16),
    muted: rgb(0.38, 0.42, 0.46),
    green: rgb(0.10, 0.42, 0.28),
    pale: rgb(0.91, 0.95, 0.92),
    panel: rgb(0.975, 0.98, 0.976),
    white: rgb(1, 1, 1),
    grid: rgb(0.66, 0.71, 0.68),
  } satisfies CertificateColors;
  const sourcePage = signedPdf.getPage(0);
  const issuerLogo = await output.embedPage(sourcePage, {
    left: 45,
    bottom: 770,
    right: 185,
    top: 835,
  });
  const signatureSeal = await output.embedPage(sourcePage, {
    left: 24,
    bottom: 218,
    right: 130,
    top: 314,
  });
  const title = buildFilename(units, jobName).replace(/\.pdf$/i, "");
  output.setTitle(title);
  output.setSubject("Certificado individual de revisión de motor reemitido desde el acta SATPRO 2026.");
  output.setAuthor(MOTOR_CERTIFICATE_SOURCE.inspectionProvider);

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
    page.drawPage(issuerLogo, { x: 45, y: 765, width: 140, height: 65 });
    const brand = resolveMotorBrandKey(unit.manufacturer, unit.modelName);
    const brandLogo = brand ? embeddedBrandLogos.get(brand) : undefined;

    page.drawText("CERTIFICADO INDIVIDUAL DE REVISIÓN", {
      x: 55,
      y: 700,
      size: 18,
      font: fonts.bold,
      color: colors.green,
    });
    page.drawText("MOTOR ELÉCTRICO", { x: 55, y: 672, size: 12, font: fonts.bold, color: colors.muted });
    page.drawText(
      `${MOTOR_CERTIFICATE_SOURCE.inspectionProvider} certifica la revisión y el mantenimiento del motor indicado,`,
      { x: 55, y: 625, size: 11, font: fonts.regular, color: colors.dark },
    );
    page.drawText(`propiedad de ${MOTOR_CERTIFICATE_SOURCE.equipmentOwner}.`, {
      x: 55,
      y: 606,
      size: 11,
      font: fonts.regular,
      color: colors.dark,
    });

    page.drawRectangle({
      x: 55,
      y: 335,
      width: A4_WIDTH - 110,
      height: 215,
      borderWidth: 1.2,
      borderColor: colors.green,
      color: colors.panel,
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
    page.drawText("FABRICANTE", { x: 78, y: 510, size: 9, font: fonts.bold, color: colors.muted });
    const manufacturer = unit.manufacturer || "No indicado en Flex";
    page.drawText(truncateTextToWidth(
      manufacturer,
      manufacturerMaxWidth,
      (text) => fonts.bold.widthOfTextAtSize(text, 13),
    ), {
      x: 78,
      y: 486,
      size: 13,
      font: fonts.bold,
      color: colors.dark,
    });
    page.drawText("MODELO", { x: 78, y: 447, size: 9, font: fonts.bold, color: colors.muted });
    page.drawText(unit.modelName.slice(0, 62), {
      x: 78,
      y: 423,
      size: 13,
      font: fonts.bold,
      color: colors.dark,
    });
    page.drawText("N.º DE SERIE", { x: 78, y: 382, size: 9, font: fonts.bold, color: colors.muted });
    page.drawText(unit.serial, { x: 78, y: 350, size: 22, font: fonts.bold, color: colors.dark });
    if (unit.barcode) {
      page.drawText(`Código Flex: ${unit.barcode}`, {
        x: 330,
        y: 352,
        size: 9,
        font: fonts.regular,
        color: colors.muted,
      });
    }

    page.drawText("Revisión realizada", { x: 78, y: 292, size: 9, font: fonts.bold, color: colors.muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate), {
      x: 78,
      y: 269,
      size: 13,
      font: fonts.bold,
      color: colors.dark,
    });
    page.drawText("Próxima revisión anual", { x: 320, y: 292, size: 9, font: fonts.bold, color: colors.muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate), {
      x: 320,
      y: 269,
      size: 13,
      font: fonts.bold,
      color: colors.dark,
    });
    page.drawText("Las operaciones realizadas y la firma de la empresa mantenedora constan en la página siguiente.", {
      x: 78,
      y: 210,
      size: 9,
      font: fonts.regular,
      color: colors.dark,
    });
    page.drawText("Marca y modelo obtenidos del registro de inventario de Flex.", {
      x: 78,
      y: 194,
      size: 8,
      font: fonts.regular,
      color: colors.muted,
    });

    const inspectionPage = output.addPage([A4_WIDTH, A4_HEIGHT]);
    drawInspectionPage({
      page: inspectionPage,
      unit,
      checklist: resolveMotorInspectionChecklist(checklists, brand),
      signatureSeal,
      fonts,
      colors,
    });
  }

  const bytes = await output.save();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return {
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    filename: buildFilename(units, jobName),
  };
}
