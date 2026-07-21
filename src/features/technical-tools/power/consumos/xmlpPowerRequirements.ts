import type { NwmMap } from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { createCalculatedPowerTable } from '@/features/technical-tools/power/powerCalculations';
import type {
  PowerElectricalSettings,
  PowerTable,
} from '@/features/technical-tools/power/types';

import type { ConsumosComponent } from './config';
import { buildXmlpPowerTables } from './xmlpPowerImport';

export interface InferredPduRequirement {
  canonicalKey: string;
  displayName: string;
  quantity: number;
  sourceTable: string;
  recommendedPdu: string | null;
  currentPerPhase: number | null;
  warning?: string;
}

export interface CalculatedXmlpPowerResult {
  tables: PowerTable[];
  pduRequirements: InferredPduRequirement[];
  warnings: string[];
}

interface BuildCalculatedXmlpPowerOptions {
  map: Pick<NwmMap, 'units' | 'groups'>;
  components: ConsumosComponent[];
  pduOptions: string[];
  settings: PowerElectricalSettings;
  firstId?: number;
  stage?: { name: string; number: number } | null;
}

/**
 * Shared XMLP power adapter. Consumos consumes its calculated tables while the
 * Flex planner consumes only the structured PDU requirements.
 */
export function buildCalculatedXmlpPowerRequirements({
  map,
  components,
  pduOptions,
  settings,
  firstId = 1,
  stage = null,
}: BuildCalculatedXmlpPowerOptions): CalculatedXmlpPowerResult {
  const built = buildXmlpPowerTables(map, components);
  const tables = built.tables.map((table, index) =>
    createCalculatedPowerTable({
      components,
      currentTable: { rows: table.rows, position: table.position },
      id: firstId + index,
      name: table.name,
      pduOptions,
      settings,
      tablePatch: {
        includesHoist: table.includesHoist,
        stageName: stage?.name ?? null,
        stageNumber: stage?.number ?? null,
      },
    }) as PowerTable,
  );

  const warnings = [...built.warnings];
  const pduRequirements = tables.map((table): InferredPduRequirement => {
    const recommendedPdu = table.pduType?.trim() || null;
    const warning = recommendedPdu
      ? undefined
      : `${table.name}: la carga no tiene una PDU compatible dentro del límite de planificación del 80 %.`;
    if (warning) warnings.push(warning);
    return {
      canonicalKey: recommendedPdu
        ? `PDU ${recommendedPdu.toUpperCase()}`
        : `PDU SIN RECOMENDACIÓN (${table.name.toUpperCase()})`,
      displayName: recommendedPdu ?? 'PDU sin recomendación',
      quantity: 1,
      sourceTable: table.name,
      recommendedPdu,
      currentPerPhase:
        typeof table.currentPerPhase === 'number' && Number.isFinite(table.currentPerPhase)
          ? table.currentPerPhase
          : null,
      warning,
    };
  });

  return { tables, pduRequirements, warnings: [...new Set(warnings)] };
}
