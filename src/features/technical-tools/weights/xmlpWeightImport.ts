import type { WeightComponent, WeightTableRow } from './weightCalculations';

interface XmlpEnclosure {
  model: string;
}

interface XmlpArray {
  arrayName: string;
  groupName: string;
  deployment: 'flown' | 'stacked' | 'unknown';
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
  { pattern: /^MBUMP$/, component: 'BUMPER KARA' },
  { pattern: /KARA.*(?:BUMP|MINIBU|BAR)/, component: 'BUMPER KARA' },
  { pattern: /KIVA.*(?:BUMP|BAR)/, component: 'BUMPER KIVA' },
  { pattern: /KS28.*(?:BUMP|OUTRIG|BAR)/, component: 'BUMPER KS28' },
  { pattern: /TFS900.*(?:BUMP|BAR)/, component: 'BUMPER TFS900' },
  { pattern: /TFS550.*(?:BUMP|BAR)/, component: 'BUMPER TFS550' },
];
const MOTOR_CAPACITY_SAFETY_FACTOR = 1.2;

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

const getPickupPointCount = (array: XmlpArray) => {
  const serializedLoadCount = [array.frontLoadKg, array.rearLoadKg]
    .filter((load) => load !== null).length;
  const labeledPickupCount = array.pickupConfiguration
    .match(/\b(?:F|R|PB)\s*:/gi)?.length ?? 0;
  const positions = array.pickupConfiguration.match(/^Posiciones:\s*(.+)$/i)?.[1]
    ?.split('/')
    .map((position) => position.trim())
    .filter(Boolean);
  const explicitMotorCount = Number.parseInt(
    array.pickupConfiguration.match(/\b(\d+)\s*motor(?:es)?\b/i)?.[1] ?? '',
    10,
  );

  return Math.max(
    1,
    serializedLoadCount,
    labeledPickupCount,
    positions?.length ?? 0,
    Number.isFinite(explicitMotorCount) ? explicitMotorCount : 0,
  );
};

const getMotorCapacityKg = (componentName: string) => {
  const match = normalizeModel(componentName).match(/^MOTOR(\d+)(T|KG)$/);
  if (!match) return null;

  const capacity = Number.parseInt(match[1], 10);
  return match[2] === 'T' ? capacity * 1000 : capacity;
};

const findMotorForLoad = <Component extends WeightComponent>(
  loadKg: number,
  components: Component[],
) => components
  .map((component) => ({ component, capacityKg: getMotorCapacityKg(component.name) }))
  .filter((candidate): candidate is { component: Component; capacityKg: number } =>
    candidate.capacityKg !== null && candidate.capacityKg >= loadKg)
  .sort((left, right) => left.capacityKg - right.capacityKg)[0]?.component;

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
    if (array.deployment !== 'flown') continue;

    const name = array.arrayName.trim() || array.groupName.trim() || `Array ${index + 1}`;
    const totalMassKg = array.totalMassKg;
    const hasExactMass = totalMassKg !== null && Number.isFinite(totalMassKg) && totalMassKg > 0;
    let rows: ImportedXmlpWeightTable['rows'];
    let loadWeight: number;

    if (hasExactMass) {
      rows = [exactMassRow(array, totalMassKg)];
      loadWeight = totalMassKg;
    } else {
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

      rows = [...counts.values()].map(({ component, quantity }) =>
        componentRow(component, quantity),
      );
      loadWeight = rows.reduce((sum, row) => sum + row.totalWeight, 0);
      if (rows.length === 0 || loadWeight <= 0) {
        warnings.push(`${name}: el XMLP no contiene un peso utilizable; no se importó.`);
        continue;
      }
    }

    // Select against 120% of the complete suspended load even when two pickup
    // points share it, so either motor independently includes the safety margin.
    const requiredMotorCapacity = loadWeight * MOTOR_CAPACITY_SAFETY_FACTOR;
    const motor = findMotorForLoad(requiredMotorCapacity, components);
    if (!motor) {
      warnings.push(
        `${name}: ningún motor del catálogo puede soportar por sí solo ${formatWeight(loadWeight)} kg con un margen del 20 %; no se importó.`,
      );
      continue;
    }

    const pickupPointCount = getPickupPointCount(array);
    rows.push(componentRow(motor, pickupPointCount));
    const totalWeight = rows.reduce((sum, row) => sum + row.totalWeight, 0);
    if (!hasExactMass) warnings.push(`${name}: peso derivado del catálogo; revisa el cableado.`);
    tables.push({
      name,
      rows,
      totalWeight,
      dualMotors: pickupPointCount > 1,
      usedExactXmlpMass: hasExactMass,
    });
    if (hasExactMass) exactMassTableCount += 1;
  }

  return { tables, warnings, exactMassTableCount };
}
