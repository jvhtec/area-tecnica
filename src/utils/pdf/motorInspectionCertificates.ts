import type { FlexMotorUnit } from "@/services/flexMotorUnits";
import { buildReadableFilename } from "@/utils/fileName";

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

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const formatDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

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

  for (const unit of units) {
    const page = output.addPage([A4_WIDTH, A4_HEIGHT]);
    const dark = rgb(0.12, 0.14, 0.16);
    const muted = rgb(0.38, 0.42, 0.46);
    const green = rgb(0.10, 0.42, 0.28);

    page.drawPage(logo, { x: 45, y: 765, width: 140, height: 65 });
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
      y: 355,
      width: A4_WIDTH - 110,
      height: 195,
      borderWidth: 1.2,
      borderColor: green,
      color: rgb(0.975, 0.98, 0.976),
    });
    page.drawText("MODELO", { x: 78, y: 505, size: 9, font: bold, color: muted });
    page.drawText(unit.modelName.slice(0, 62), { x: 78, y: 478, size: 15, font: bold, color: dark });
    page.drawText("N.º DE SERIE", { x: 78, y: 425, size: 9, font: bold, color: muted });
    page.drawText(unit.serial, { x: 78, y: 390, size: 22, font: bold, color: dark });
    if (unit.barcode) {
      page.drawText(`Código Flex: ${unit.barcode}`, { x: 330, y: 392, size: 9, font: regular, color: muted });
    }

    page.drawText("Revisión realizada", { x: 78, y: 305, size: 9, font: bold, color: muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.inspectionDate), {
      x: 78,
      y: 282,
      size: 13,
      font: bold,
      color: dark,
    });
    page.drawText("Próxima revisión anual", { x: 320, y: 305, size: 9, font: bold, color: muted });
    page.drawText(formatDate(MOTOR_CERTIFICATE_SOURCE.nextAnnualInspectionDate), {
      x: 320,
      y: 282,
      size: 13,
      font: bold,
      color: dark,
    });
    page.drawText("Las operaciones realizadas y la firma de la empresa mantenedora constan en la página siguiente.", {
      x: 78,
      y: 220,
      size: 9,
      font: regular,
      color: dark,
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
