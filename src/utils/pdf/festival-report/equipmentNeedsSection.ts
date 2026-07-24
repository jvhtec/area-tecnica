import type jsPDF from 'jspdf';
import type { EquipmentNeeds } from '@/utils/gearComparisonService';
import {
  FESTIVAL_INK,
  FESTIVAL_SOFT,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from './tokens';
import { drawFestivalSectionHeading } from './chrome';
import { drawFestivalNilState } from './components';

interface NeedGroup {
  label: string;
  items: string[];
}

/**
 * Flattens the comparison service's shape into named groups. Zero-quantity
 * entries are filtered here rather than rendered as an empty row totalling 0.
 */
export const collectEquipmentNeedGroups = (needs: EquipmentNeeds): NeedGroup[] => {
  const groups: NeedGroup[] = [];

  const critical: string[] = [];
  for (const console of needs.consoles.foh) {
    if (console.additionalQuantity > 0) {
      critical.push(`Consola FOH ${console.model}: ${console.additionalQuantity} ud. adicionales (${console.requiredBy.join(', ')})`);
    }
  }
  for (const console of needs.consoles.monitor) {
    if (console.additionalQuantity > 0) {
      critical.push(`Consola de monitores ${console.model}: ${console.additionalQuantity} ud. adicionales (${console.requiredBy.join(', ')})`);
    }
  }
  for (const wireless of needs.wireless) {
    const parts: string[] = [];
    if (wireless.additionalChannels > 0) parts.push(`${wireless.additionalChannels} canales`);
    if (wireless.additionalHH > 0) parts.push(`${wireless.additionalHH} de mano`);
    if (wireless.additionalBP > 0) parts.push(`${wireless.additionalBP} petacas`);
    if (parts.length > 0) {
      critical.push(`Microfonía inalámbrica ${wireless.model}: ${parts.join(', ')} (${wireless.requiredBy.join(', ')})`);
    }
  }
  for (const iem of needs.iem) {
    const parts: string[] = [];
    if (iem.additionalChannels > 0) parts.push(`${iem.additionalChannels} canales`);
    if (iem.additionalBP > 0) parts.push(`${iem.additionalBP} petacas`);
    if (parts.length > 0) {
      critical.push(`IEM ${iem.model}: ${parts.join(', ')} (${iem.requiredBy.join(', ')})`);
    }
  }
  if (critical.length > 0) groups.push({ label: 'Crítico', items: critical });

  const infrastructure: Array<[string, { additionalQuantity: number; requiredBy: string[] }]> = [
    ['CAT6', needs.infrastructure.cat6],
    ['HMA', needs.infrastructure.hma],
    ['Coaxial', needs.infrastructure.coax],
    ['OpticalCON DUO', needs.infrastructure.opticalcon_duo],
    ['Analógicas', needs.infrastructure.analog],
  ];
  const infraItems = infrastructure
    .filter(([, entry]) => entry.additionalQuantity > 0)
    .map(([label, entry]) => `Tiradas ${label}: ${entry.additionalQuantity} adicionales (${entry.requiredBy.join(', ')})`);
  if (infraItems.length > 0) groups.push({ label: 'Infraestructura', items: infraItems });

  const micItems = needs.microphones
    .filter((mic) => mic.additionalQuantity > 0)
    .map((mic) => `${mic.model}: ${mic.additionalQuantity} ud. adicionales (${mic.requiredBy.join(', ')})`);
  if (micItems.length > 0) groups.push({ label: 'Microfonía', items: micItems });

  if (needs.monitors.additionalQuantity > 0) {
    groups.push({
      label: 'Monitores',
      items: [`${needs.monitors.additionalQuantity} monitores adicionales (${needs.monitors.requiredBy.join(', ')})`],
    });
  }

  const extras: Array<[string, { additionalStages: number; requiredBy: string[] }]> = [
    ['Side fills', needs.extras.sideFills],
    ['Drum fills', needs.extras.drumFills],
    ['Cabinas de DJ', needs.extras.djBooths],
  ];
  const extraItems = extras
    .filter(([, entry]) => entry.additionalStages > 0)
    .map(([label, entry]) => `${label}: ${entry.additionalStages} escenarios (${entry.requiredBy.join(', ')})`);
  if (extraItems.length > 0) groups.push({ label: 'Extras', items: extraItems });

  return groups;
};

/**
 * Renders the additional-equipment findings as a numbered list: each shortfall
 * in one sentence, with what it is required by. The document surfaces the
 * problem rather than leaving it to be reconstructed from five separate pages.
 */
export const drawEquipmentNeedsSection = (
  doc: jsPDF,
  geo: FestivalGeometry,
  needs: EquipmentNeeds,
  y: number,
  sectionNumber: number,
  ensureSpace: (required: number, current: number) => number,
): number => {
  const { mm } = geo;
  const groups = collectEquipmentNeedGroups(needs);

  let cursor = ensureSpace(20 * mm, y);
  cursor = drawFestivalSectionHeading(doc, geo, 'Material adicional necesario', cursor, sectionNumber);

  if (groups.length === 0) {
    return drawFestivalNilState(
      doc,
      geo,
      cursor,
      'Todos los requerimientos se cubren con el inventario actual. No hay material pendiente de contratar.',
    );
  }

  let index = 1;
  for (const group of groups) {
    cursor = ensureSpace(10 * mm, cursor);
    setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6, 'bold');
    doc.text(group.label.toUpperCase(), geo.left, cursor, { charSpace: 0.22 * mm });
    cursor += 4.6 * mm;

    for (const item of group.items) {
      setFestivalText(doc, FESTIVAL_INK, 7.4);
      const lines = doc.splitTextToSize(item, geo.contentWidth - 9 * mm) as string[];
      cursor = ensureSpace(lines.length * 3.4 * mm + 2 * mm, cursor);

      setFestivalMonoText(doc, FESTIVAL_SOFT, 6, 'bold');
      doc.text(String(index).padStart(2, '0'), geo.left, cursor);
      setFestivalText(doc, FESTIVAL_INK, 7.4);
      doc.text(lines, geo.left + 9 * mm, cursor, { lineHeightFactor: 1.25 });

      cursor += lines.length * 3.4 * mm + 1.6 * mm;
      index += 1;
    }
    cursor += 2 * mm;
  }

  return cursor;
};
