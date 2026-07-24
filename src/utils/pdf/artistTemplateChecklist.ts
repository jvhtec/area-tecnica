import { formatFrequencyBand } from '@/lib/frequencyBands';
import type { PdfFestivalGearOptions } from '@/utils/pdf/artistPdfTypes';

type Translate = (es: string, en: string) => string;

/**
 * Builds the "tick what you need" rows for the blank artist form: one row per
 * item the festival can supply, grouped by category, with what is in stock.
 */
export const buildFestivalOptionChecklistRows = (
  options: PdfFestivalGearOptions,
  tx: Translate,
  checklist: string,
): string[][] => {
  const rows: string[][] = [];

  const pushGroup = (
    categoryLabel: string,
    items: Array<{ label: string; availability: string }>,
  ) => {
    if (items.length === 0) {
      rows.push([categoryLabel, tx('Sin opciones cargadas', 'No options loaded'), '—']);
      return;
    }

    items.forEach((item, index) => {
      rows.push([
        index === 0 ? categoryLabel : '',
        `${checklist} ${item.label}`,
        item.availability,
      ]);
    });
  };

  const stockLabel = (quantity: number): string =>
    quantity > 0
      ? `${tx('Disponibles', 'Available')}: ${quantity}`
      : tx('Sin stock', 'Out of stock');

  const bandSuffix = (band: unknown): string => {
    const formatted = formatFrequencyBand(band as never);
    return formatted ? `  ·  ${formatted}` : '';
  };

  pushGroup(
    tx('Consolas FOH', 'FOH consoles'),
    (options.fohConsoles || []).map((item) => ({
      label: item.model,
      availability: stockLabel(item.quantity),
    })),
  );

  pushGroup(
    tx('Consolas MON', 'MON consoles'),
    (options.monConsoles || []).map((item) => ({
      label: item.model,
      availability: stockLabel(item.quantity),
    })),
  );

  pushGroup(
    tx('Sistemas RF', 'Wireless systems'),
    (options.wirelessSystems || []).map((system) => ({
      label: system.model,
      availability: `${tx('Canales', 'Channels')} ${system.quantity_ch || 0}  ·  ${tx('Mano', 'HH')} ${system.quantity_hh || 0}  ·  ${tx('Petacas', 'BP')} ${system.quantity_bp || 0}${bandSuffix(system.band)}`,
    })),
  );

  pushGroup(
    tx('Sistemas IEM', 'IEM systems'),
    (options.iemSystems || []).map((system) => ({
      label: system.model,
      availability: `${tx('Canales', 'Channels')} ${system.quantity_hh || 0}  ·  ${tx('Petacas', 'Bodypacks')} ${system.quantity_bp || 0}${bandSuffix(system.band)}`,
    })),
  );

  return rows;
};
