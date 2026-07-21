import { useState } from "react";

import { parseLaSessionFile } from "@/components/sound/amplifier-tool/rack-designer/parse-session-file";
import { useToast } from "@/hooks/use-toast";
import type { PowerElectricalSettings, PowerTable } from "@/features/technical-tools/power/types";

import type { ConsumosComponent } from "./config";
import { createPrebuiltMonitorPdu } from "./monitorPduPreset";
import { buildCalculatedXmlpPowerRequirements } from "./xmlpPowerRequirements";

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
  onMonitorPduCreated: (table: PowerTable) => void;
}

export function useXmlpPowerImport({
  components,
  pduOptions,
  getSettings,
  selectedStage,
  onTablesImported,
  onMonitorPduCreated,
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
      const result = buildCalculatedXmlpPowerRequirements({
        map,
        components,
        pduOptions,
        settings: getSettings(),
        firstId: Date.now(),
        stage: selectedStage,
      });
      if (result.tables.length === 0) {
        throw new Error(
          result.warnings[0] || "El XMLP no contiene amplificadores reconocibles.",
        );
      }

      onTablesImported(result.tables);

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

  const addPrebuiltMonitorPdu = () => {
    try {
      onMonitorPduCreated(
        createPrebuiltMonitorPdu({
          components,
          id: Date.now(),
          pduOptions,
          settings: getSettings(),
          stage: selectedStage,
        }),
      );
      toast({ title: "Éxito", description: "PDU de Monitores añadida sin posición." });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo añadir la PDU de Monitores.",
        variant: "destructive",
      });
    }
  };

  return { isImportingXmlp, importXmlpPower, addPrebuiltMonitorPdu };
}
