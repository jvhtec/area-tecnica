import { useState } from 'react';

import { parseLaSessionFile } from '@/components/sound/amplifier-tool/rack-designer/parse-session-file';
import { useToast } from '@/hooks/use-toast';

import type { WeightComponent } from './weightCalculations';
import { buildXmlpWeightTables } from './xmlpWeightImport';

interface ImportStage {
  name: string;
  number: number;
}

export interface XmlpCalculatorTable {
  name: string;
  baseName: string;
  rows: Array<{
    id: string;
    quantity: string;
    componentId: string;
    weight: string;
    componentName: string;
    totalWeight: number;
  }>;
  totalWeight: number;
  id: number;
  stageName: string | null;
  stageNumber: number | null;
  dualMotors: boolean;
  riggingPoints: string;
  clusterId: string;
  cablePick: boolean;
  cablePickWeight: string;
}

interface UseXmlpWeightImportOptions<Component extends WeightComponent> {
  components: Component[];
  existingTableIds: number[];
  selectedStage: ImportStage | null;
  onTablesImported: (tables: XmlpCalculatorTable[]) => void;
}

const createImportId = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function useXmlpWeightImport<Component extends WeightComponent>({
  components,
  existingTableIds,
  selectedStage,
  onTablesImported,
}: UseXmlpWeightImportOptions<Component>) {
  const [isImportingXmlp, setIsImportingXmlp] = useState(false);
  const { toast } = useToast();

  const importXmlpWeights = async (file: File) => {
    if (isImportingXmlp) return;
    if (!file.name.toLowerCase().endsWith('.xmlp')) {
      toast({
        title: 'Archivo no compatible',
        description: 'Selecciona un proyecto Soundvision (.xmlp).',
        variant: 'destructive',
      });
      return;
    }

    setIsImportingXmlp(true);
    try {
      const map = await parseLaSessionFile(file);
      if (!map.flysheet?.arrays.length) {
        throw new Error('El proyecto no contiene arrays compatibles con la calculadora de pesos.');
      }

      const result = buildXmlpWeightTables(map.flysheet, components);
      if (result.tables.length === 0) {
        throw new Error(result.warnings[0] || 'El XMLP no contiene pesos utilizables.');
      }

      const firstId = Math.max(Date.now(), ...existingTableIds.map((id) => id + 1));
      const importKey = `${firstId}`;
      onTablesImported(result.tables.map((table, index) => ({
        name: table.name,
        baseName: table.name,
        rows: table.rows.map((row) => ({ ...row, id: createImportId('xmlp-row') })),
        totalWeight: table.totalWeight,
        id: firstId + index,
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
        dualMotors: table.dualMotors,
        riggingPoints: '',
        clusterId: `${importKey}-${index}`,
        cablePick: false,
        cablePickWeight: '100',
      })));

      const derivedCount = result.tables.length - result.exactMassTableCount;
      const warningSuffix = result.warnings.length > 0
        ? ` Aviso: ${result.warnings[0]}` +
          (result.warnings.length > 1 ? ` (+${result.warnings.length - 1} más)` : '')
        : '';
      toast({
        title: 'Pesos extraídos del XMLP',
        description:
          `${result.tables.length} array(s) añadidos (${result.exactMassTableCount} con peso XMLP` +
          ` y ${derivedCount} derivados del catálogo).${warningSuffix}`,
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudo extraer el peso del proyecto Soundvision.';
      toast({ title: 'Error al extraer el XMLP', description: message, variant: 'destructive' });
    } finally {
      setIsImportingXmlp(false);
    }
  };

  return { isImportingXmlp, importXmlpWeights };
}
