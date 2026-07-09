import type { Color, PDFFont, PDFPage } from "pdf-lib";

import type { SoundDocumentationCopyScope } from "@/utils/duplicateSoundDocumentation";

type GeneratedPdfDocument = {
  file_name: string;
  file_path: string;
  file_type: string | null;
};

const isPdfDocument = (doc: Pick<GeneratedPdfDocument, "file_name" | "file_type">) =>
  doc.file_type?.toLowerCase().includes("pdf") || doc.file_name.toLowerCase().endsWith(".pdf");

const formatDateForCopiedPdf = (
  dateValue: string | null | undefined,
  formatStyle: "short" | "long" = "short"
) => {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return formatStyle === "long"
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(parsed)
    : new Intl.DateTimeFormat("en-GB").format(parsed);
};

const drawCenteredPdfText = (
  page: Pick<PDFPage, "drawText" | "getWidth">,
  text: string,
  y: number,
  options: {
    color: Color;
    font: PDFFont;
    maxWidth?: number;
    minSize?: number;
    size: number;
  }
) => {
  const pageWidth = page.getWidth();
  const maxWidth = options.maxWidth ?? pageWidth - 72;
  let size = options.size;

  while (size > (options.minSize ?? 8) && options.font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }

  const textWidth = options.font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    color: options.color,
    font: options.font,
    size,
    x: Math.max(18, (pageWidth - textWidth) / 2),
    y,
  });
};

const getGeneratedPdfHeader = ({
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  const title = targetJobTitle?.trim() || "Trabajo";

  switch (scope) {
    case "power":
      return {
        background: "corporate" as const,
        lines: [
          { text: "Informe de Distribución de Potencia", size: 20, weight: "bold" as const },
          { text: title, size: 14, weight: "regular" as const },
          {
            text: `Fecha del Trabajo: ${formatDateForCopiedPdf(targetJobDate) || "Sin fecha"}`,
            size: 11,
            weight: "regular" as const,
          },
        ],
      };
    case "soundvision":
      return {
        background: "corporate" as const,
        lines: [
          { text: "SOUNDVISION REPORT", size: 20, weight: "bold" as const },
          { text: title, size: 13, weight: "regular" as const },
          {
            text: formatDateForCopiedPdf(targetJobDate, "long") || "No date",
            size: 11,
            weight: "regular" as const,
          },
        ],
      };
    case "material":
      return {
        background: "white" as const,
        lines: [
          { text: "Listado de Material", size: 16, weight: "bold" as const },
          { text: title, size: 12, weight: "regular" as const },
          {
            text: formatDateForCopiedPdf(targetJobDate)
              ? `Fecha del Trabajo: ${formatDateForCopiedPdf(targetJobDate)}`
              : "",
            size: 10,
            weight: "regular" as const,
          },
        ].filter((line) => line.text),
      };
    default:
      return null;
  }
};

const rewriteGeneratedPdfHeader = async ({
  blob,
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  blob: Blob;
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  const header = getGeneratedPdfHeader({ scope, targetJobDate, targetJobTitle });
  if (!header) return blob;

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const corporate = rgb(125 / 255, 1 / 255, 1 / 255);
  const white = rgb(1, 1, 1);
  const dark = rgb(0.12, 0.12, 0.12);
  const topBandHeight = header.background === "corporate" ? 114 : 76;

  pdf.getPages().forEach((page) => {
    const pageHeight = page.getHeight();
    const pageWidth = page.getWidth();
    const bandY = pageHeight - topBandHeight;

    page.drawRectangle({
      x: 0,
      y: bandY,
      width: pageWidth,
      height: topBandHeight,
      color: header.background === "corporate" ? corporate : white,
    });

    const textColor = header.background === "corporate" ? white : corporate;
    const secondaryTextColor = header.background === "corporate" ? white : dark;
    const yPositions =
      header.background === "corporate"
        ? [pageHeight - 55, pageHeight - 82, pageHeight - 104]
        : [pageHeight - 24, pageHeight - 45, pageHeight - 62];

    header.lines.forEach((line, index) => {
      drawCenteredPdfText(page, line.text, yPositions[index] ?? yPositions[yPositions.length - 1], {
        color: index === 0 ? textColor : secondaryTextColor,
        font: line.weight === "bold" ? boldFont : regularFont,
        maxWidth: pageWidth - 72,
        minSize: 7,
        size: line.size,
      });
    });
  });

  const bytes = await pdf.save();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: "application/pdf" });
};

export const maybeRewriteCopiedGeneratedPdf = async ({
  blob,
  doc,
  scope,
  targetJobDate,
  targetJobTitle,
}: {
  blob: Blob;
  doc: GeneratedPdfDocument;
  scope: SoundDocumentationCopyScope;
  targetJobDate?: string | null;
  targetJobTitle?: string | null;
}) => {
  if (!isPdfDocument(doc) || !["power", "soundvision", "material"].includes(scope)) {
    return blob;
  }

  try {
    return await rewriteGeneratedPdfHeader({
      blob,
      scope,
      targetJobDate,
      targetJobTitle,
    });
  } catch (error) {
    console.warn("[duplicateSoundDocumentation] PDF header rewrite failed; copying original PDF", {
      error,
      filePath: doc.file_path,
    });
    return blob;
  }
};
