import type { WeightComponent, WeightTableRow } from './weightCalculations';
import {
  findWeightComponentByName,
  findXmlpMotorForLoad,
  getXmlpMotorCapacityKg,
  resolveXmlpRiggingRequirement,
  type XmlpRiggingRequirement,
} from './xmlpRiggingRequirements';

interface XmlpEnclosure {
  model: string;
}

interface XmlpArray {
  arrayName: string;
  groupName: string;
  deployment: 'flown' | 'stacked' | 'unknown';
  riggingFrame: string;
  flyingBarSetting?: string;
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
  riggingRequirements: XmlpRiggingRequirement[];
  motorRequirements: InferredMotorRequirement[];
}

const MOTOR_CAPACITY_SAFETY_FACTOR = 1.2;

export interface InferredMotorRequirement {
  canonicalKey: string;
  displayName: string;
  quantity: number;
  sourceArray: string;
  sourceArrayIndex: number;
  requiredCapacityKg: number;
  selectedCapacityKg: number;
}

const formatWeight = (value: number) => Number(value.toFixed(3)).toString();

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
  const riggingRequirements = flysheet.arrays
    .map((array, index) => resolveXmlpRiggingRequirement(array, index))
    .filter((requirement): requirement is XmlpRiggingRequirement => requirement !== null);
  const motorRequirements: InferredMotorRequirement[] = [];
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
        const component = findWeightComponentByName(enclosure.model, components);
        if (!component) {
          unknownModels.add(enclosure.model.trim() || 'modelo sin nombre');
          continue;
        }
        const key = component.id.toString();
        const current = counts.get(key);
        counts.set(key, { component, quantity: (current?.quantity ?? 0) + 1 });
      }

      const riggingRequirement = resolveXmlpRiggingRequirement(array, index);
      const serializedRigging = array.riggingFrame.trim() || array.flyingBarSetting?.trim() || '';
      const riggingComponent = riggingRequirement
        ? findWeightComponentByName(riggingRequirement.canonicalKey, components)
        : undefined;
      if (serializedRigging && !riggingComponent) unknownModels.add(serializedRigging);
      if (riggingComponent && riggingRequirement) {
        const key = riggingComponent.id.toString();
        const current = counts.get(key);
        counts.set(key, {
          component: riggingComponent,
          quantity: (current?.quantity ?? 0) + riggingRequirement.quantity,
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
    const selectedMotor = findXmlpMotorForLoad(requiredMotorCapacity, components);
    if (!selectedMotor) {
      warnings.push(
        `${name}: ningún motor del catálogo puede soportar por sí solo ${formatWeight(loadWeight)} kg con un margen del 20 %; no se importó.`,
      );
      continue;
    }

    const pickupPointCount = getPickupPointCount(array);
    rows.push(componentRow(selectedMotor.component, pickupPointCount));
    motorRequirements.push({
      canonicalKey: selectedMotor.component.name.trim().toUpperCase(),
      displayName: selectedMotor.component.name.trim(),
      quantity: pickupPointCount,
      sourceArray: name,
      sourceArrayIndex: index,
      requiredCapacityKg: requiredMotorCapacity,
      selectedCapacityKg:
        getXmlpMotorCapacityKg(selectedMotor.component.name) ?? selectedMotor.capacityKg,
    });
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

  return { tables, warnings, exactMassTableCount, riggingRequirements, motorRequirements };
}
