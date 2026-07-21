import type { WeightComponent } from './weightCalculations';

export interface XmlpRiggingArray {
  arrayName: string;
  groupName: string;
  riggingFrame: string;
  flyingBarSetting?: string;
}

export interface XmlpRiggingRequirement {
  canonicalKey: string;
  displayName: string;
  quantity: number;
  sourceArray: string;
  sourceArrayIndex: number;
  serializedValue: string;
}

export const normalizeXmlpEquipmentName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const RIGGING_FRAME_ALIASES: Array<{ pattern: RegExp; canonicalKey: string }> = [
  { pattern: /K1(?:BUMP|BAR)/, canonicalKey: 'BUMPER K1' },
  { pattern: /K2(?:BUMP|BAR)/, canonicalKey: 'BUMPER K2' },
  { pattern: /K3(?:BUMP|BAR)/, canonicalKey: 'BUMPER K3' },
  { pattern: /^MBUMP$/, canonicalKey: 'BUMPER KARA' },
  { pattern: /KARA(?:BUMP|MINIBU|BAR)/, canonicalKey: 'BUMPER KARA' },
  { pattern: /KIVA(?:BUMP|BAR)/, canonicalKey: 'BUMPER KIVA' },
  { pattern: /KS28(?:BUMP|OUTRIG|BAR)/, canonicalKey: 'BUMPER KS28' },
  { pattern: /TFS900(?:BUMP|BAR)/, canonicalKey: 'BUMPER TFS900' },
  { pattern: /TFS550(?:BUMP|BAR)/, canonicalKey: 'BUMPER TFS550' },
];

const serializedQuantity = (value: string) => {
  const match = value.match(/(?:^|\s)(\d+)\s*[x×]\s*/i);
  if (!match) return 1;
  const quantity = Number.parseInt(match[1], 10);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const aliasFor = (value: string) => {
  const normalized = normalizeXmlpEquipmentName(value);
  return RIGGING_FRAME_ALIASES.find(({ pattern }) => pattern.test(normalized))?.canonicalKey;
};

/**
 * Resolves the one serialized rigging-frame requirement for an XMLP array.
 * Both Pesos and Flex consume this function so aliases and explicit quantities
 * such as `2x K2-BAR` cannot drift between the two outputs.
 */
export function resolveXmlpRiggingRequirement(
  array: XmlpRiggingArray,
  sourceArrayIndex: number,
): XmlpRiggingRequirement | null {
  const values = [array.riggingFrame, array.flyingBarSetting ?? '']
    .map((value) => value.trim())
    .filter(Boolean);

  const resolved = values
    .map((value) => ({ value, canonicalKey: aliasFor(value) }))
    .filter(
      (entry): entry is { value: string; canonicalKey: string } =>
        entry.canonicalKey !== undefined,
    );
  const first = resolved[0];
  if (first) {
    const matchingValues = resolved.filter((entry) => entry.canonicalKey === first.canonicalKey);
    const quantity = Math.max(...matchingValues.map((entry) => serializedQuantity(entry.value)));
    const serialized = matchingValues.find((entry) => serializedQuantity(entry.value) === quantity)!;
    return {
      canonicalKey: first.canonicalKey,
      displayName: first.canonicalKey,
      quantity,
      sourceArray: array.arrayName.trim() || array.groupName.trim() || `Array ${sourceArrayIndex + 1}`,
      sourceArrayIndex,
      serializedValue: serialized.value,
    };
  }

  return null;
}

export function findWeightComponentByName<Component extends WeightComponent>(
  name: string,
  components: Component[],
): Component | undefined {
  const normalized = normalizeXmlpEquipmentName(name);
  return components.find(
    (component) => normalizeXmlpEquipmentName(component.name) === normalized,
  );
}

export function getXmlpMotorCapacityKg(componentName: string) {
  const match = normalizeXmlpEquipmentName(componentName).match(/^MOTOR(\d+)(T|KG)$/);
  if (!match) return null;
  const capacity = Number.parseInt(match[1], 10);
  return match[2] === 'T' ? capacity * 1000 : capacity;
}

export function findXmlpMotorForLoad<Component extends WeightComponent>(
  loadKg: number,
  components: Component[],
) {
  return components
    .map((component) => ({ component, capacityKg: getXmlpMotorCapacityKg(component.name) }))
    .filter(
      (candidate): candidate is { component: Component; capacityKg: number } =>
        candidate.capacityKg !== null && candidate.capacityKg >= loadKg,
    )
    .sort((left, right) => left.capacityKg - right.capacityKg)[0];
}
