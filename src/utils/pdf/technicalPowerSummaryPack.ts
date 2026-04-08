import parseISO from 'date-fns/parseISO';
import { formatInTimeZone } from 'date-fns-tz';

import { buildReadableFilename } from '@/utils/fileName';
import { getDepartmentLabel } from '@/types/department';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getCompanyLogo } from '@/utils/pdf/logoUtils';
import { normalizeTechnicalPowerDepartments } from '@/utils/technicalPowerTypes';
import type {
  CombinedTechnicalPowerSummaryData,
  DepartmentPowerSummaryData,
  TechnicalPowerDepartment,
} from '@/utils/technicalPowerTypes';

interface GenerateTechnicalPowerSummaryPackInput {
  jobTitle?: string | null;
  jobDate?: string | null;
  jobLocation?: string | null;
  generatedAt?: Date;
  logoUrl?: string;
  includedDepartments?: TechnicalPowerDepartment[];
  summary: CombinedTechnicalPowerSummaryData;
}

const CORPORATE_RED = [125, 1, 1] as const;
const HEADER_HEIGHT = 40;
const CONTENT_START_Y = 68;
const FOOTER_SPACE = 28;
const MADRID_TIMEZONE = 'Europe/Madrid';

const loadImage = (src?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const parseDateValue = (value?: string | null, fallback = new Date()) => {
  if (!value) return fallback;

  const parsedIso = parseISO(value);
  if (!Number.isNaN(parsedIso.getTime())) {
    return parsedIso;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? fallback : parsedDate;
};

const formatMadridDate = (value: Date) =>
  formatInTimeZone(value, MADRID_TIMEZONE, 'dd/MM/yyyy');

const formatDisplayDate = (value?: string | null, fallback = new Date()) =>
  formatMadridDate(parseDateValue(value, fallback));

const formatWatts = (value: number) => `${value.toFixed(2)} W`;
const formatAmps = (value: number) => `${value.toFixed(2)} A`;
const formatKva = (value: number) => `${value.toFixed(2)} kVA`;

const getPageWidth = (doc: any) =>
  doc.internal.pageSize.getWidth?.() ?? doc.internal.pageSize.width;

const getPageHeight = (doc: any) =>
  doc.internal.pageSize.getHeight?.() ?? doc.internal.pageSize.height;

const drawCorporateHeader = ({
  doc,
  title,
  subtitleLines = [],
  headerLogo,
}: {
  doc: any;
  title: string;
  subtitleLines?: string[];
  headerLogo?: HTMLImageElement | null;
}) => {
  const pageWidth = getPageWidth(doc);

  doc.setFillColor(...CORPORATE_RED);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  if (headerLogo) {
    const logoHeight = 8;
    const logoWidth = logoHeight * (headerLogo.width / headerLogo.height);
    try {
      doc.addImage(headerLogo, 'PNG', 10, 5, logoWidth, logoHeight);
    } catch {
      // Ignore logo rendering failures and keep the export flowing.
    }
  }

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth / 2, 18, { align: 'center' });

  if (subtitleLines.length > 0) {
    doc.setFontSize(11);
    subtitleLines.slice(0, 2).forEach((line, index) => {
      doc.text(line, pageWidth / 2, 27 + index * 8, { align: 'center' });
    });
  }
};

const drawFooter = ({
  doc,
  pageNumber,
  companyLogo,
  createdDate,
}: {
  doc: any;
  pageNumber: number;
  companyLogo: HTMLImageElement | null;
  createdDate: string;
}) => {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);

  doc.setPage(pageNumber);

  if (companyLogo) {
    const logoWidth = 50;
    const logoHeight = logoWidth * (companyLogo.height / companyLogo.width);
    const xPosition = (pageWidth - logoWidth) / 2;

    try {
      doc.addImage(
        companyLogo,
        'PNG',
        xPosition,
        pageHeight - 20 - logoHeight,
        logoWidth,
        logoHeight
      );
    } catch {
      // Ignore footer logo failures.
    }
  }

  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  doc.text(`Creado: ${createdDate}`, pageWidth - 10, pageHeight - 10, {
    align: 'right',
  });
};

const departmentTableBody = (department: DepartmentPowerSummaryData) =>
  department.rows.length > 0
    ? department.rows.map((row) => [
        row.name,
        row.pduLabel || 'N/A',
        row.positionLabel || 'N/A',
        formatWatts(row.totalWatts),
        formatAmps(row.currentPerPhase),
        row.notes || '',
      ])
    : [['Sin datos guardados', '-', '-', formatWatts(0), formatAmps(0), '']];

const drawTotalsBox = ({
  doc,
  yPosition,
  title,
  lines,
  onPageBreak,
}: {
  doc: any;
  yPosition: number;
  title: string;
  lines: string[];
  onPageBreak?: () => void;
}) => {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const requiredHeight = 18 + lines.length * 7;

  if (yPosition + requiredHeight > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    onPageBreak?.();
    yPosition = CONTENT_START_Y;
  }

  doc.setFillColor(245, 245, 250);
  doc.rect(14, yPosition - 6, pageWidth - 28, requiredHeight, 'F');
  doc.setFontSize(13);
  doc.setTextColor(...CORPORATE_RED);
  doc.text(title, 18, yPosition + 2);

  let lineY = yPosition + 10;
  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);

  lines.forEach((line) => {
    doc.text(line, 18, lineY);
    lineY += 7;
  });
};

export const buildTechnicalPowerSummaryPackFilename = (
  jobTitle?: string | null
) =>
  buildReadableFilename(
    ['Resumen Potencia Tecnica', jobTitle || 'Trabajo'],
    'pdf'
  );

export const generateTechnicalPowerSummaryPack = async ({
  jobTitle,
  jobDate,
  jobLocation,
  generatedAt = new Date(),
  logoUrl,
  includedDepartments,
  summary,
}: GenerateTechnicalPowerSummaryPackInput): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const [headerLogo, companyLogo] = await Promise.all([
    loadImage(logoUrl),
    getCompanyLogo(),
  ]);

  const doc = new jsPDF();
  const displayDate = formatDisplayDate(jobDate, generatedAt);
  const createdDate = formatMadridDate(generatedAt);
  const departmentsToInclude = (
    normalizeTechnicalPowerDepartments(includedDepartments || []).length > 0
      ? normalizeTechnicalPowerDepartments(includedDepartments || [])
      : Object.values(summary.departments)
          .filter((department) => department.rows.length > 0)
          .map((department) => department.department)
  ).map((department) => summary.departments[department]);

  const includedDepartmentLabels = departmentsToInclude.map((department) =>
    getDepartmentLabel(department.department)
  );
  const totalSystemWatts = departmentsToInclude.reduce(
    (sum, department) => sum + department.totalWatts,
    0
  );
  const totalSystemAmps = departmentsToInclude.reduce(
    (sum, department) => sum + department.totalAmps,
    0
  );
  const totalSystemKva = departmentsToInclude.reduce(
    (sum, department) => sum + department.totalKva,
    0
  );

  drawCorporateHeader({
    doc,
    title: 'Resumen Tecnico de Potencia',
    subtitleLines: [
      jobTitle || 'Trabajo sin titulo',
      jobLocation || displayDate,
    ],
    headerLogo,
  });

  const pageWidth = getPageWidth(doc);

  doc.setFontSize(18);
  doc.setTextColor(...CORPORATE_RED);
  doc.text(jobTitle || 'Trabajo sin titulo', pageWidth / 2, 92, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(51, 51, 51);
  doc.text(`Fecha del trabajo: ${displayDate}`, pageWidth / 2, 106, {
    align: 'center',
  });
  doc.text(
    `Ubicacion: ${jobLocation || 'Sin ubicacion'}`,
    pageWidth / 2,
    116,
    { align: 'center', maxWidth: pageWidth - 50 }
  );
  doc.text(
    `Departamentos incluidos: ${
      includedDepartmentLabels.length > 0 ? includedDepartmentLabels.join(', ') : 'Sin datos'
    }`,
    pageWidth / 2,
    128,
    { align: 'center', maxWidth: pageWidth - 50 }
  );

  drawTotalsBox({
    doc,
    yPosition: 154,
    title: 'Totales globales',
    lines: [
      `Potencia total: ${formatWatts(totalSystemWatts)}`,
      `Corriente total: ${formatAmps(totalSystemAmps)}`,
      `Potencia aparente total: ${formatKva(totalSystemKva)}`,
    ],
    onPageBreak: () => {
      drawCorporateHeader({
        doc,
        title: 'Resumen Tecnico de Potencia',
        subtitleLines: [
          jobTitle || 'Trabajo sin titulo',
          jobLocation || displayDate,
        ],
        headerLogo,
      });
    },
  });

  departmentsToInclude.forEach((department) => {
    const departmentName = getDepartmentLabel(department.department);
    doc.addPage();

    autoTable(doc, {
      startY: CONTENT_START_Y,
      head: [['Nombre Cuadro', 'PDU', 'Posición', 'Potencia', 'Corriente', 'Notas']],
      body: departmentTableBody(department),
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 5,
        lineColor: [220, 220, 230],
        lineWidth: 0.1,
        textColor: [51, 51, 51],
      },
      headStyles: {
        fillColor: [...CORPORATE_RED],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255],
      },
      margin: { top: CONTENT_START_Y, bottom: FOOTER_SPACE, left: 14, right: 14 },
      didDrawPage: () => {
        const subtitleLines = [
          jobTitle || 'Trabajo sin titulo',
          department.safetyMargin !== null
            ? `${departmentName} · Margen de seguridad ${department.safetyMargin}%`
            : departmentName,
        ];

        drawCorporateHeader({
          doc,
          title: 'Resumen Tecnico de Potencia',
          subtitleLines,
          headerLogo,
        });
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? CONTENT_START_Y;
    drawTotalsBox({
      doc,
      yPosition: finalY + 12,
      title: `Totales ${departmentName.toLowerCase()}`,
      lines: [
        `Potencia total: ${formatWatts(department.totalWatts)}`,
        `Corriente total: ${formatAmps(department.totalAmps)}`,
        `Potencia aparente total: ${formatKva(department.totalKva)}`,
      ],
      onPageBreak: () => {
        const subtitleLines = [
          jobTitle || 'Trabajo sin titulo',
          department.safetyMargin !== null
            ? `${departmentName} · Margen de seguridad ${department.safetyMargin}%`
            : departmentName,
        ];

        drawCorporateHeader({
          doc,
          title: 'Resumen Tecnico de Potencia',
          subtitleLines,
          headerLogo,
        });
      },
    });
  });

  doc.addPage();
  autoTable(doc, {
    startY: CONTENT_START_Y,
    head: [['Departamento', 'Potencia total', 'Corriente total', 'Potencia aparente']],
    body: departmentsToInclude.map((department) => [
      getDepartmentLabel(department.department),
      formatWatts(department.totalWatts),
      formatAmps(department.totalAmps),
      formatKva(department.totalKva),
    ]),
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      lineColor: [220, 220, 230],
      lineWidth: 0.1,
      textColor: [51, 51, 51],
    },
    headStyles: {
      fillColor: [...CORPORATE_RED],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 255],
    },
    margin: { top: CONTENT_START_Y, bottom: FOOTER_SPACE, left: 14, right: 14 },
    didDrawPage: () => {
      drawCorporateHeader({
        doc,
        title: 'Resumen Tecnico de Potencia',
        subtitleLines: [jobTitle || 'Trabajo sin titulo', 'Totales comparativos'],
        headerLogo,
      });
    },
  });

  drawTotalsBox({
    doc,
    yPosition: ((doc as any).lastAutoTable?.finalY ?? CONTENT_START_Y) + 12,
    title: 'Total del sistema',
    lines: [
      `Potencia total: ${formatWatts(totalSystemWatts)}`,
      `Corriente total: ${formatAmps(totalSystemAmps)}`,
      `Potencia aparente total: ${formatKva(totalSystemKva)}`,
    ],
    onPageBreak: () => {
      drawCorporateHeader({
        doc,
        title: 'Resumen Tecnico de Potencia',
        subtitleLines: [jobTitle || 'Trabajo sin titulo', 'Totales comparativos'],
        headerLogo,
      });
    },
  });

  const totalPages = doc.internal.pages.length - 1;
  for (let page = 1; page <= totalPages; page += 1) {
    drawFooter({ doc, pageNumber: page, companyLogo, createdDate });
  }

  return doc.output('blob');
};
