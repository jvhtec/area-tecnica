import { useState } from "react";

import { parseLaSessionFile } from "@/components/sound/amplifier-tool/rack-designer/parse-session-file";
import { useToast } from "@/hooks/use-toast";
import { createCalculatedPowerTable } from "@/features/technical-tools/power/powerCalculations";
import type { PowerElectricalSettings, PowerTable } from "@/features/technical-tools/power/types";

import type { ConsumosComponent } from "./config";
import { buildXmlpPowerTables } from "./xmlpPowerImport";

interface ImportStage {
  name: string;
  number: number;
}

interface UseXmlpPowerImportOptions {
  components: ConsumosComponent[];
  pduOptions: string[];
  getSettings: () => PowerElectricalSettings;
  selectedStage: ImportStage | null;
  onTablesImported: (tables: PowerTable[]) => void;
}

export function useXmlpPowerImport({
  components,
  pduOptions,
  getSettings,
  selectedStage,
  onTablesImported,
}: UseXmlpPowerImportOptions) {
  const [isImportingXmlp, setIsImportingXmlp] = useState(false);
  const { toast } = useToast();

  const importXmlpPower = async (file: File) => {
    if (isImportingXmlp) return;
    if (!file.name.toLowerCase().endsWith(".xmlp")) {
      toast({
        title: "Archivo no compatible",
        description: "Selecciona un proyecto Soundvision (.xmlp).",
        variant: "destructive",
      });
      return;
    }

    setIsImportingXmlp(true);
    try {
      const map = await parseLaSessionFile(file);
      const result = buildXmlpPowerTables(map, components);
      if (result.tables.length === 0) {
        throw new Error(
          result.warnings[0] || "El XMLP no contiene amplificadores reconocibles.",
        );
      }

      const settings = getSettings();
      const firstId = Date.now();
      const builtTables = result.tables.map((table, index) =>
        createCalculatedPowerTable({
          components,
          currentTable: { rows: table.rows, position: table.position },
          id: firstId + index,
          name: table.name,
          pduOptions,
          settings,
          tablePatch: {
            includesHoist: table.includesHoist,
            stageName: selectedStage?.name ?? null,
            stageNumber: selectedStage?.number ?? null,
          },
        }) as PowerTable,
      );

      onTablesImported(builtTables);

      const warningSuffix =
        result.warnings.length > 0
          ? ` Aviso: ${result.warnings[0]}` +
            (result.warnings.length > 1 ? ` (+${result.warnings.length - 1} más)` : "")
          : "";
      toast({
        title: "PDUs extraídos del XMLP",
        description: `${result.tables.length} PDU(s) añadidos.${warningSuffix}`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo extraer el consumo del proyecto Soundvision.";
      toast({ title: "Error al extraer el XMLP", description: message, variant: "destructive" });
    } finally {
      setIsImportingXmlp(false);
    }
  };

  return { isImportingXmlp, importXmlpPower };
}
