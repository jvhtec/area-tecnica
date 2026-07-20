import {
  toAmpModel,
  type NwmMap,
  type SoundvisionFlysheetArray,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { SOUND_CONSUMOS_CONFIG } from '@/features/technical-tools/power/consumos/departmentConfigs';
import { buildCalculatedXmlpPowerRequirements } from '@/features/technical-tools/power/consumos/xmlpPowerRequirements';
import {
  getPowerPduOptions,
  getVoltageForPhase,
} from '@/features/technical-tools/power/powerCalculations';
import { soundWeightComponents } from '@/features/technical-tools/weights/soundWeightComponents';
import { buildXmlpWeightTables } from '@/features/technical-tools/weights/xmlpWeightImport';
import { normalizeXmlpEquipmentName } from '@/features/technical-tools/weights/xmlpRiggingRequirements';

export type XmlpFlexCategoryKey =
  | 'pa_mains'
  | 'pa_downfill'
  | 'pa_outfill'
  | 'pa_subs'
  | 'pa_frontfill'
  | 'pa_delays'
  | 'pa_amp';

export type XmlpFlexSource =
  | 'xmlp-speaker'
  | 'xmlp-rigging'
  | 'xmlp-amplifier'
  | 'derived-amplifier-packaging'
  | 'pesos-motor'
  | 'consumos-pdu';

export type XmlpFlexMappingStatus =
  | 'mapped'
  | 'missing-resource-id'
  | 'missing-equipment'
  | 'ambiguous';

export const XMLP_FLEX_GROUP_ORDER: XmlpFlexCategoryKey[] = [
  'pa_mains',
  'pa_downfill',
  'pa_outfill',
  'pa_subs',
  'pa_frontfill',
  'pa_delays',
  'pa_amp',
];

export const XMLP_FLEX_GROUP_LABELS: Record<XmlpFlexCategoryKey, string> = {
  pa_mains: 'Sistema de PA',
  pa_downfill: 'Downfill',
  pa_outfill: 'Outfill',
  pa_subs: 'Subwoofers',
  pa_frontfill: 'Frontfill',
  pa_delays: 'Delays',
  pa_amp: 'Amplificación',
};

export interface XmlpEquipmentRow {
  id: string;
  name: string;
  department: string;
  category: string | null;
  resource_id: string | null;
}

export interface XmlpFlexCandidate {
  id: string;
  canonicalKey: string;
  displayName: string;
  quantity: number;
  flexCategoryKey: XmlpFlexCategoryKey | null;
  sources: XmlpFlexSource[];
  sourceArrays: string[];
  equipmentId: string | null;
  equipmentName: string | null;
  resourceId: string | null;
  inference: 'explicit' | 'derived';
  mappingStatus: XmlpFlexMappingStatus;
  expectedDepartment: string;
  expectedCategories: string[];
  warning?: string;
}

export interface XmlpFlexExportGroup {
  flexCategoryKey: XmlpFlexCategoryKey;
  label: string;
  items: XmlpFlexCandidate[];
}

export interface XmlpFlexMissingMapping {
  canonicalKey: string;
  displayName: string;
  sources: XmlpFlexSource[];
  requestedQuantity: number;
  sourceArrays: string[];
  expectedDepartment: string;
  expectedCategories: string[];
  reason: string;
}

export interface XmlpFlexExportPlan {
  groups: XmlpFlexExportGroup[];
  unassignedItems: XmlpFlexCandidate[];
  missingMappings: XmlpFlexMissingMapping[];
  warnings: string[];
}

export interface XmlpArrayClassification {
  category: XmlpFlexCategoryKey | null;
  warning?: string;
}

const normalizedTokens = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

const hasToken = (tokens: string[], ...words: string[]) =>
  tokens.some((token) => words.some((word) => token === word || token.startsWith(word)));

const SUB_MODELS = new Set(['KS28', 'K1SB', 'SB18', 'SB15', 'SB10', 'SB28']);
const FULL_RANGE_MODELS = new Set([
  'K1',
  'K2',
  'K3',
  'KARA',
  'KARAII',
  'KIVA',
  'TFS900H',
  'TFA600',
  'TFS550H',
  'TFS550L',
]);

const explicitCategory = (value: string): XmlpFlexCategoryKey | null => {
  const tokens = normalizedTokens(value);
  if (hasToken(tokens, 'DOWNFILL') || hasToken(tokens, 'DOWN') || value.match(/DOWN\s+FILL/i)) {
    return 'pa_downfill';
  }
  if (hasToken(tokens, 'OUTFILL', 'SIDEFILL') || hasToken(tokens, 'OUT', 'SIDE') || tokens.includes('OF')) {
    return 'pa_outfill';
  }
  if (hasToken(tokens, 'FRONTFILL') || hasToken(tokens, 'FRONT') || tokens.includes('FF')) {
    return 'pa_frontfill';
  }
  if (hasToken(tokens, 'DELAY') || tokens.includes('DLY')) return 'pa_delays';
  if (hasToken(tokens, 'SUBWOOFER') || hasToken(tokens, 'SUB') || tokens.includes('SB')) {
    return 'pa_subs';
  }
  if (hasToken(tokens, 'MAIN', 'MAINS', 'SYSTEM', 'SISTEMA') || tokens.includes('PA')) {
    return 'pa_mains';
  }
  return null;
};

export function classifyXmlpArray(array: SoundvisionFlysheetArray): XmlpArrayClassification {
  const models = new Set(array.enclosures.map((box) => normalizeXmlpEquipmentName(box.model)));
  const hasSubs = [...models].some((model) => SUB_MODELS.has(model) || model.endsWith('SB'));
  const hasFullRange = [...models].some((model) => FULL_RANGE_MODELS.has(model));
  const mixedWarning =
    hasSubs && hasFullRange
      ? `${array.arrayName || array.groupName}: mezcla sospechosa de subgraves y recintos full-range.`
      : undefined;

  const fromArrayName = explicitCategory(array.arrayName);
  if (fromArrayName) return { category: fromArrayName, warning: mixedWarning };
  const fromGroupName = explicitCategory(array.groupName);
  if (fromGroupName) return { category: fromGroupName, warning: mixedWarning };
  if (hasSubs && !hasFullRange) return { category: 'pa_subs', warning: mixedWarning };

  const nameTokens = normalizedTokens(`${array.arrayName} ${array.groupName}`);
  const hasSide = nameTokens.some((token) => ['L', 'R', 'C', 'LEFT', 'RIGHT', 'CENTER'].includes(token));
  const namesKnownModel = [...models].some((model) =>
    normalizeXmlpEquipmentName(`${array.arrayName} ${array.groupName}`).includes(model),
  );
  if (hasFullRange && (hasSide || namesKnownModel)) {
    return { category: 'pa_mains', warning: mixedWarning };
  }

  return {
    category: null,
    warning:
      mixedWarning ??
      `${array.arrayName || array.groupName}: no se pudo asignar el array a un grupo Flex de forma segura.`,
  };
}

export function calculateLaAmplifierPackaging(compatibleAmplifierCount: number) {
  const safeCount = Math.max(0, Math.floor(compatibleAmplifierCount));
  return {
    laRackQuantity: Math.floor(safeCount / 3),
    laCaseQuantity: safeCount % 3,
  };
}

interface XmlpEquipmentAlias {
  canonicalKey: string;
  acceptedNames: string[];
  departments: string[];
  categories: string[];
}

const aliases: XmlpEquipmentAlias[] = [
  { canonicalKey: 'K1', acceptedNames: ["L'Acoustics K1", 'K1'], departments: ['sound'], categories: ['speakers', 'pa_mains'] },
  { canonicalKey: 'K1-SB', acceptedNames: ["L'Acoustics K1-SB", 'K1-SB'], departments: ['sound'], categories: ['speakers', 'pa_subs'] },
  { canonicalKey: 'K2', acceptedNames: ["L'Acoustics K2", 'K2'], departments: ['sound'], categories: ['speakers', 'pa_mains'] },
  { canonicalKey: 'K3', acceptedNames: ["L'Acoustics K3", 'K3'], departments: ['sound'], categories: ['speakers', 'pa_mains'] },
  { canonicalKey: 'KARA II', acceptedNames: ["L'Acoustics Kara", "L'Acoustics Kara II", 'Kara', 'Kara II'], departments: ['sound'], categories: ['speakers', 'pa_mains'] },
  { canonicalKey: 'KIVA', acceptedNames: ["L'Acoustics Kiva", 'Kiva'], departments: ['sound'], categories: ['speakers', 'pa_mains'] },
  { canonicalKey: 'KS28', acceptedNames: ["L'Acoustics KS28", 'KS28'], departments: ['sound'], categories: ['speakers', 'pa_subs'] },
  { canonicalKey: 'LA12X', acceptedNames: ["L'Acoustics LA12X", 'LA12X'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'LA8', acceptedNames: ["L'Acoustics LA8", 'LA8'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'LA4X', acceptedNames: ["L'Acoustics LA4X", 'LA4X'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'LA4', acceptedNames: ["L'Acoustics LA4", 'LA4'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'PLM20000D', acceptedNames: ['PLM 20000DP', 'PLM20000D'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'LA-RAK II', acceptedNames: ["L'Acoustics LA-RAK II", 'LA-RAK II'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'LA-CASE', acceptedNames: ["L'Acoustics LA-CASE II", 'LA-CASE II'], departments: ['sound'], categories: ['amplificacion', 'pa_amp'] },
  { canonicalKey: 'BUMPER K1', acceptedNames: ['Dual K1 Rigging Flight Case', 'K1 Rigging Flight Case'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'BUMPER K2', acceptedNames: ['Dual K2 Rigging Flight Case'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'BUMPER K3', acceptedNames: ['K3-BUMP'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'BUMPER KARA', acceptedNames: ['Dual Kara Rigging Flight Case'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'BUMPER KIVA', acceptedNames: ["L'Acoustics KIBU", 'KIBU'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'BUMPER KS28', acceptedNames: ['KS28 BUMP'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'MOTOR 2T', acceptedNames: ['Motor Elevacion 2T D8+ - 25 m'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'MOTOR 1T', acceptedNames: ['Motor Electrico de Elevación ChainMaster D8 1000kg - 30 m'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'MOTOR 750KG', acceptedNames: ['Motor Elevacion ChainMaster D8+ 750kg - 24 m'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'MOTOR 500KG', acceptedNames: ['Motor Electrico de Elevacion   500 KG  - 25 m'], departments: ['lights'], categories: ['rigging'] },
  { canonicalKey: 'PDU CEE32A 3P+N+G', acceptedNames: ['PDU Sound CEE32A 3P+N+G'], departments: ['sound'], categories: ['pa_amp'] },
  { canonicalKey: 'PDU CEE63A 3P+N+G MAIN', acceptedNames: ['PDU Sound Main CEE63A 3P+N+G'], departments: ['sound'], categories: ['pa_amp'] },
  { canonicalKey: 'PDU CEE63A 3P+N+G MONITORES', acceptedNames: ['PDU Sound Monitores CEE63A 3P+N+G'], departments: ['sound'], categories: ['pa_amp'] },
  { canonicalKey: 'PDU CEE125A 3P+N+G', acceptedNames: ['PDU Sound CEE125A 3P+N+G'], departments: ['sound'], categories: ['pa_amp'] },
];

const canonicalSpeaker = (model: string) => {
  const normalized = normalizeXmlpEquipmentName(model);
  if (normalized === 'KARA' || normalized === 'KARAII') return 'KARA II';
  if (normalized === 'K1SB') return 'K1-SB';
  return normalized;
};

const aliasFor = (canonicalKey: string) =>
  aliases.find((entry) => entry.canonicalKey === canonicalKey);

interface RawCandidate {
  canonicalKey: string;
  displayName: string;
  quantity: number;
  flexCategoryKey: XmlpFlexCategoryKey | null;
  source: XmlpFlexSource;
  sourceArrays: string[];
  inference: 'explicit' | 'derived';
  warning?: string;
}

function resolveCandidate(raw: RawCandidate, equipment: XmlpEquipmentRow[]): XmlpFlexCandidate {
  const alias = aliasFor(raw.canonicalKey);
  const base = {
    id: `${raw.flexCategoryKey ?? 'unassigned'}:${raw.canonicalKey}:${raw.source}`,
    ...raw,
    sources: [raw.source],
    equipmentId: null,
    equipmentName: null,
    resourceId: null,
    expectedDepartment: alias?.departments.join(', ') ?? 'sound/lights',
    expectedCategories: alias?.categories ?? [],
  };
  if (!alias) return { ...base, mappingStatus: 'missing-equipment' };

  const accepted = new Set(alias.acceptedNames.map(normalizeXmlpEquipmentName));
  const matches = equipment.filter(
    (row) =>
      accepted.has(normalizeXmlpEquipmentName(row.name)) &&
      alias.departments.includes(row.department) &&
      row.category !== null &&
      alias.categories.includes(row.category),
  );
  const resources = new Set(matches.map((row) => row.resource_id).filter(Boolean));
  if (matches.length > 1 && resources.size > 1) {
    return {
      ...base,
      mappingStatus: 'ambiguous',
      warning: raw.warning ?? `Hay ${matches.length} recursos físicos aprobados para ${raw.canonicalKey}.`,
    };
  }
  const match = matches[0];
  if (!match) return { ...base, mappingStatus: 'missing-equipment' };
  if (!match.resource_id) {
    return {
      ...base,
      equipmentId: match.id,
      equipmentName: match.name,
      mappingStatus: 'missing-resource-id',
    };
  }
  return {
    ...base,
    equipmentId: match.id,
    equipmentName: match.name,
    resourceId: match.resource_id,
    mappingStatus: 'mapped',
  };
}

const mergeCandidates = (candidates: XmlpFlexCandidate[]) => {
  const merged = new Map<string, XmlpFlexCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.flexCategoryKey ?? 'unassigned'}:${candidate.resourceId ?? candidate.canonicalKey}:${candidate.mappingStatus}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...candidate, sourceArrays: [...candidate.sourceArrays], sources: [...candidate.sources] });
      continue;
    }
    existing.quantity += candidate.quantity;
    existing.sourceArrays = [...new Set([...existing.sourceArrays, ...candidate.sourceArrays])];
    existing.sources = [...new Set([...existing.sources, ...candidate.sources])];
    existing.inference =
      existing.inference === 'derived' || candidate.inference === 'derived' ? 'derived' : 'explicit';
    existing.warning = [existing.warning, candidate.warning].filter(Boolean).join(' ' ) || undefined;
  }
  return [...merged.values()].map((candidate, index) => ({ ...candidate, id: `${candidate.id}:${index}` }));
};

const pduCanonicalKey = (pdu: string, sourceTable: string) => {
  const normalized = pdu.toUpperCase();
  if (normalized.includes('CEE63A')) {
    return sourceTable.toUpperCase().includes('MONITOR')
      ? 'PDU CEE63A 3P+N+G MONITORES'
      : 'PDU CEE63A 3P+N+G MAIN';
  }
  return `PDU ${normalized}`;
};

export function buildXmlpFlexExportPlan(
  map: NwmMap,
  equipment: XmlpEquipmentRow[],
): XmlpFlexExportPlan {
  const raw: RawCandidate[] = [];
  const warnings: string[] = [];
  const flysheet = map.flysheet;
  const classifications = flysheet?.arrays.map(classifyXmlpArray) ?? [];

  flysheet?.arrays.forEach((array, index) => {
    const classification = classifications[index];
    if (classification.warning) warnings.push(classification.warning);
    const arrayName = array.arrayName.trim() || array.groupName.trim() || `Array ${index + 1}`;
    const counts = new Map<string, number>();
    for (const enclosure of array.enclosures) {
      const canonicalKey = canonicalSpeaker(enclosure.model);
      counts.set(canonicalKey, (counts.get(canonicalKey) ?? 0) + 1);
    }
    for (const [canonicalKey, quantity] of counts) {
      raw.push({
        canonicalKey,
        displayName: canonicalKey,
        quantity,
        flexCategoryKey: classification.category,
        source: 'xmlp-speaker',
        sourceArrays: [arrayName],
        inference: 'explicit',
        warning: classification.warning,
      });
    }
  });

  if (flysheet) {
    const weights = buildXmlpWeightTables(flysheet, soundWeightComponents);
    warnings.push(...weights.warnings);
    for (const rigging of weights.riggingRequirements) {
      raw.push({
        canonicalKey: rigging.canonicalKey,
        displayName: rigging.displayName,
        quantity: rigging.quantity,
        flexCategoryKey: classifications[rigging.sourceArrayIndex]?.category ?? null,
        source: 'xmlp-rigging',
        sourceArrays: [rigging.sourceArray],
        inference: 'explicit',
        warning: classifications[rigging.sourceArrayIndex]?.warning,
      });
    }
    for (const motor of weights.motorRequirements) {
      raw.push({
        canonicalKey: motor.canonicalKey,
        displayName: motor.displayName,
        quantity: motor.quantity,
        flexCategoryKey: classifications[motor.sourceArrayIndex]?.category ?? null,
        source: 'pesos-motor',
        sourceArrays: [motor.sourceArray],
        inference: 'derived',
        warning: classifications[motor.sourceArrayIndex]?.warning,
      });
    }
  }

  const uniqueUnits = [...new Map(map.units.map((unit) => [unit.octet, unit])).values()];
  const ampCounts = new Map<string, number>();
  let compatibleLaAmplifierCount = 0;
  for (const unit of uniqueUnits) {
    const model = toAmpModel(unit.model);
    const canonicalKey = model === 'OTRO' ? normalizeXmlpEquipmentName(unit.model) : model;
    ampCounts.set(canonicalKey, (ampCounts.get(canonicalKey) ?? 0) + 1);
    if (['LA4', 'LA4X', 'LA8', 'LA12X'].includes(model)) compatibleLaAmplifierCount += 1;
  }
  for (const [canonicalKey, quantity] of ampCounts) {
    raw.push({
      canonicalKey,
      displayName: canonicalKey,
      quantity,
      flexCategoryKey: 'pa_amp',
      source: 'xmlp-amplifier',
      sourceArrays: ['Unidades físicas XMLP'],
      inference: 'explicit',
    });
  }

  const packaging = calculateLaAmplifierPackaging(compatibleLaAmplifierCount);
  if (packaging.laRackQuantity > 0) {
    raw.push({ canonicalKey: 'LA-RAK II', displayName: 'LA-RAK II', quantity: packaging.laRackQuantity, flexCategoryKey: 'pa_amp', source: 'derived-amplifier-packaging', sourceArrays: ['Total amplificadores L-Acoustics XMLP'], inference: 'derived' });
  }
  if (packaging.laCaseQuantity > 0) {
    raw.push({ canonicalKey: 'LA-CASE', displayName: 'LA-CASE', quantity: packaging.laCaseQuantity, flexCategoryKey: 'pa_amp', source: 'derived-amplifier-packaging', sourceArrays: ['Resto amplificadores L-Acoustics XMLP'], inference: 'derived' });
  }

  const power = buildCalculatedXmlpPowerRequirements({
    map,
    components: SOUND_CONSUMOS_CONFIG.components,
    pduOptions: getPowerPduOptions('sound', 'three'),
    settings: {
      safetyMargin: SOUND_CONSUMOS_CONFIG.defaultSafetyMargin,
      phaseMode: 'three',
      voltage: getVoltageForPhase('three'),
      powerFactor: SOUND_CONSUMOS_CONFIG.defaultPowerFactor,
    },
  });
  warnings.push(...power.warnings);
  for (const pdu of power.pduRequirements) {
    raw.push({
      canonicalKey: pdu.recommendedPdu
        ? pduCanonicalKey(pdu.recommendedPdu, pdu.sourceTable)
        : pdu.canonicalKey,
      displayName: pdu.displayName,
      quantity: pdu.quantity,
      flexCategoryKey: 'pa_amp',
      source: 'consumos-pdu',
      sourceArrays: [pdu.sourceTable],
      inference: 'derived',
      warning: pdu.warning,
    });
  }

  const resolved = mergeCandidates(raw.map((candidate) => resolveCandidate(candidate, equipment)));
  for (const candidate of resolved) {
    if (candidate.flexCategoryKey === null) {
      candidate.mappingStatus = 'ambiguous';
      candidate.warning =
        candidate.warning ?? 'El array necesita una asignación de grupo antes de poder enviarse.';
    }
  }
  const canonicalKeysByResource = new Map<string, Set<string>>();
  for (const candidate of resolved) {
    if (!candidate.resourceId) continue;
    const keys = canonicalKeysByResource.get(candidate.resourceId) ?? new Set<string>();
    keys.add(candidate.canonicalKey);
    canonicalKeysByResource.set(candidate.resourceId, keys);
  }
  for (const candidate of resolved) {
    const keys = candidate.resourceId
      ? canonicalKeysByResource.get(candidate.resourceId)
      : undefined;
    if (!keys || keys.size < 2) continue;
    candidate.mappingStatus = 'ambiguous';
    candidate.warning = `El resource_id ${candidate.resourceId} está asignado a identidades canónicas distintas (${[...keys].join(', ')}).`;
    warnings.push(candidate.warning);
  }
  const groups = XMLP_FLEX_GROUP_ORDER.map((flexCategoryKey) => ({
    flexCategoryKey,
    label: XMLP_FLEX_GROUP_LABELS[flexCategoryKey],
    items: resolved.filter((item) => item.flexCategoryKey === flexCategoryKey),
  }));
  const unassignedItems = resolved.filter((item) => item.flexCategoryKey === null);
  const missingMappings = resolved
    .filter((item) => item.mappingStatus !== 'mapped')
    .map((item) => ({
      canonicalKey: item.canonicalKey,
      displayName: item.displayName,
      sources: item.sources,
      requestedQuantity: item.quantity,
      sourceArrays: item.sourceArrays,
      expectedDepartment: item.expectedDepartment,
      expectedCategories: item.expectedCategories,
      reason:
        item.mappingStatus === 'ambiguous'
          ? item.warning ?? 'Más de un recurso físico coincide.'
          : item.mappingStatus === 'missing-resource-id'
            ? 'La fila de equipment no tiene resource_id.'
            : 'No existe una fila equipment exacta dentro del departamento y categoría aprobados.',
    }));

  return { groups, unassignedItems, missingMappings, warnings: [...new Set(warnings)] };
}
