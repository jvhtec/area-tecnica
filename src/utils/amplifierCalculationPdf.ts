import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AmplifierResults } from '@/components/sound/amplifier-tool/types';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportFolios,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import {
  drawReportEntryHeading,
  drawReportHeadlineFigure,
  drawReportTotals,
} from '@/utils/pdf/report-system/blocks';

/** The subsystem keys the amplifier tool works in, named for the reader. */
const SECTION_LABELS: Record<string, string> = {
  mains: 'Mains',
  outs: 'Outs',
  subs: 'Subs',
  fronts: 'Front fills',
  delays: 'Delays',
  other: 'Otros',
};

const sectionLabel = (section: string): string =>
  SECTION_LABELS[section] ?? section.charAt(0).toUpperCase() + section.slice(1);

export const generateAmplifierPdf = async (results: AmplifierResults): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  await loadReportIssuerMark();

  const issuedOn = new Date();
  const activeSections = Object.entries(results.perSection).filter(
    ([, data]) => data.totalAmps > 0,
  );

  const chrome: ReportChromeOptions = {
    kind: 'amplifier',
    kindLabel: 'Necesidades de amplificación',
    eventTitle: 'Necesidades de amplificación',
    contextLabel: format(issuedOn, 'dd/MM/yyyy'),
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: 'Necesidades de amplificación',
    subtitle: `Cálculo emitido el ${format(issuedOn, 'PPP', { locale: es })}`,
    meta: [
      { label: 'Subsistemas', value: String(activeSections.length) },
      { label: 'Racks LA-RAK', value: String(results.completeRaks) },
      { label: 'Amplificadores', value: String(results.totalAmplifiersNeeded) },
    ],
  });

  // The figure the whole calculation exists to produce leads the page.
  let y = drawReportHeadlineFigure(doc, geo, contentTop, {
    label: 'Amplificadores necesarios',
    value: String(results.totalAmplifiersNeeded),
    support: `${results.completeRaks} ${results.completeRaks === 1 ? 'rack completo' : 'racks completos'} más ${results.looseAmplifiers} ${results.looseAmplifiers === 1 ? 'unidad suelta' : 'unidades sueltas'}.`,
  });

  const breakIfShort = (cursor: number, needed: number): number => {
    if (cursor <= geo.contentBottom - needed) return cursor;
    doc.addPage();
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    return pageGeo.contentTop;
  };

  y = drawReportSectionHeading(doc, geo, 'Detalle por subsistema', y + 4, 1);

  activeSections.forEach(([section, data]) => {
    y = breakIfShort(y, 34);
    y = drawReportEntryHeading(
      doc,
      geo,
      `${sectionLabel(section)}${data.mirrored ? ' · Simétrico' : ''}`,
      y,
      `${data.totalAmps} ${data.totalAmps === 1 ? 'amplificador' : 'amplificadores'}`,
    );

    autoTable(doc, {
      startY: y,
      head: [['Configuración de cajas']],
      body: data.details.map((detail) => [detail]),
      ...reportTableDefaults(geo, { fontSize: 7.2 }),
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawReportRunningHead(doc, chrome);
      },
    });

    y = getLastAutoTableY(doc, y) + 8;
  });

  y = breakIfShort(y, 40);
  drawReportTotals(doc, geo, y, {
    heading: 'Resumen',
    lines: [
      { label: 'Racks LA-RAK completos', value: String(results.completeRaks) },
      { label: 'Amplificadores sueltos', value: String(results.looseAmplifiers) },
      { label: 'Racks PLM', value: String(results.plmRacks) },
    ],
    total: { label: 'Amplificadores necesarios', value: String(results.totalAmplifiersNeeded) },
  });

  stampReportFolios(doc);

  return doc.output('blob');
};
