import type { WeightComponent, WeightTableRow } from './weightCalculations';

interface XmlpEnclosure {
  model: string;
}

interface XmlpArray {
  arrayName: string;
  groupName: string;
  riggingFrame: string;
  pickupConfiguration: string;
  totalMassKg: number | null;
  frontLoadKg: number | null;
  rearLoadKg: number | null;
  enclosures: XmlpEnclosure[];
}

interface XmlpFlysheet {
  arrays: XmlpArray[];
}

export interface ImportedXmlpWeightTable {
  name: string;
  rows: Array<WeightTableRow & { componentName: string; totalWeight: number }>;
  totalWeight: number;
  dualMotors: boolean;
  usedExactXmlpMass: boolean;
}

export interface XmlpWeightImportResult {
  tables: ImportedXmlpWeightTable[];
  warnings: string[];
  exactMassTableCount: number;
}

const normalizeModel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const RIGGING_FRAME_ALIASES: Array<{ pattern: RegExp; component: string }> = [
  { pattern: /K1.*(?:BUMP|BAR)/, component: 'BUMPER K1' },
  { pattern: /K2.*(?:BUMP|BAR)/, component: 'BUMPER K2' },
  { pattern: /K3.*(?:BUMP|BAR)/, component: 'BUMPER K3' },
  { pattern: /KARA.*(?:BUMP|MINIBU|BAR)/, component: 'BUMPER KARA' },
  { pattern: /KIVA.*(?:BUMP|BAR)/, component: 'BUMPER KIVA' },
  { pattern: /KS28.*(?:BUMP|OUTRIG|BAR)/, component: 'BUMPER KS28' },
  { pattern: /TFS900.*(?:BUMP|BAR)/, component: 'BUMPER TFS900' },
  { pattern: /TFS550.*(?:BUMP|BAR)/, component: 'BUMPER TFS550' },
];

const formatWeight = (value: number) => Number(value.toFixed(3)).toString();

const findComponentByName = <Component extends WeightComponent>(
  name: string,
  components: Component[],
): Component | undefined => {
  const normalized = normalizeModel(name);
  return components.find((component) => normalizeModel(component.name) === normalized);
};

const findRiggingComponent = <Component extends WeightComponent>(
  riggingFrame: string,
  components: Component[],
): Component | undefined => {
  const exact = findComponentByName(riggingFrame, components);
  if (exact) return exact;

  const normalized = normalizeModel(riggingFrame);
  const alias = RIGGING_FRAME_ALIASES.find(({ pattern }) => pattern.test(normalized));
  return alias ? findComponentByName(alias.component, components) : undefined;
};

const hasDualMotors = (array: XmlpArray) => {
  if (array.frontLoadKg !== null && array.rearLoadKg !== null) return true;
  if (/\bF:\s*[^/]+\/\s*R:/i.test(array.pickupConfiguration)) return true;

  const positions = array.pickupConfiguration.match(/^Posiciones:\s*(.+)$/i)?.[1]
    ?.split('/')
    .map((position) => position.trim())
    .filter(Boolean);
  return Boolean(positions && positions.length > 1);
};

const summarizeArray = (array: XmlpArray) => {
  const counts = new Map<string, number>();
  for (const enclosure of array.enclosures) {
    const model = enclosure.model.trim() || 'Recinto sin modelo';
    counts.set(model, (counts.get(model) ?? 0) + 1);
  }
  const parts = [...counts].map(([model, count]) => `${count}× ${model}`);
  if (array.riggingFrame.trim()) parts.push(array.riggingFrame.trim());
  return parts.join(' + ');
};

const exactMassRow = (array: XmlpArray, totalMassKg: number) => {
  const summary = summarizeArray(array);
  const componentName = summary ? `Peso total XMLP (${summary})` : 'Peso total XMLP';
  return {
    quantity: '1',
    componentId: '',
    componentName,
    weight: formatWeight(totalMassKg),
    totalWeight: totalMassKg,
  };
};

const componentRow = <Component extends WeightComponent>(component: Component, quantity: number) => ({
  quantity: quantity.toString(),
  componentId: component.id.toString(),
  componentName: component.name.trim(),
  weight: formatWeight(component.weight),
  totalWeight: quantity * component.weight,
});

/**
 * Converts normalized Soundvision arrays into calculator tables. Serialized
 * XMLP mass is authoritative; catalog weights are used only when it is absent.
 */
export function buildXmlpWeightTables<Component extends WeightComponent>(
  flysheet: XmlpFlysheet,
  components: Component[],
): XmlpWeightImportResult {
  const tables: ImportedXmlpWeightTable[] = [];
  const warnings: string[] = [];
  let exactMassTableCount = 0;

  for (const [index, array] of flysheet.arrays.entries()) {
    const name = array.arrayName.trim() || array.groupName.trim() || `Array ${index + 1}`;
    const totalMassKg = array.totalMassKg;
    const hasExactMass = totalMassKg !== null && Number.isFinite(totalMassKg) && totalMassKg > 0;

    if (hasExactMass) {
      tables.push({
        name,
        rows: [exactMassRow(array, totalMassKg)],
        totalWeight: totalMassKg,
        dualMotors: hasDualMotors(array),
        usedExactXmlpMass: true,
      });
      exactMassTableCount += 1;
      continue;
    }

    const counts = new Map<string, { component: Component; quantity: number }>();
    const unknownModels = new Set<string>();
    for (const enclosure of array.enclosures) {
      const component = findComponentByName(enclosure.model, components);
      if (!component) {
        unknownModels.add(enclosure.model.trim() || 'modelo sin nombre');
        continue;
      }
      const key = component.id.toString();
      const current = counts.get(key);
      counts.set(key, { component, quantity: (current?.quantity ?? 0) + 1 });
    }

    const riggingFrame = array.riggingFrame.trim();
    const riggingComponent = riggingFrame
      ? findRiggingComponent(riggingFrame, components)
      : undefined;
    if (riggingFrame && !riggingComponent) unknownModels.add(riggingFrame);
    if (riggingComponent) {
      const key = riggingComponent.id.toString();
      const current = counts.get(key);
      counts.set(key, {
        component: riggingComponent,
        quantity: (current?.quantity ?? 0) + 1,
      });
    }

    if (unknownModels.size > 0) {
      warnings.push(
        `${name}: sin peso XMLP y sin equivalencia segura para ${[...unknownModels].join(', ')}; no se importó.`,
      );
      continue;
    }

    const rows = [...counts.values()].map(({ component, quantity }) =>
      componentRow(component, quantity),
    );
    const totalWeight = rows.reduce((sum, row) => sum + row.totalWeight, 0);
    if (rows.length === 0 || totalWeight <= 0) {
      warnings.push(`${name}: el XMLP no contiene un peso utilizable; no se importó.`);
      continue;
    }

    rows.push({
      quantity: '0',
      componentId: '',
      componentName: 'Revisar motores y cableado (no incluidos en el peso derivado)',
      weight: '0',
      totalWeight: 0,
    });
    warnings.push(`${name}: peso derivado del catálogo; revisa motores y cableado.`);
    tables.push({
      name,
      rows,
      totalWeight,
      dualMotors: hasDualMotors(array),
      usedExactXmlpMass: false,
    });
  }

  return { tables, warnings, exactMassTableCount };
}
