import { createCalculatedPowerTable } from "@/features/technical-tools/power/powerCalculations";
import type {
  PowerElectricalSettings,
  PowerTable,
  PowerTableRow,
} from "@/features/technical-tools/power/types";

import type { ConsumosComponent } from "./config";

export const MONITOR_PDU_NAME = "Monitores";

const MONITOR_PDU_COMPONENT_NAMES = [
  "Control Mon (L)",
  "RF Rack",
  "Backline",
  "Varios",
] as const;

const normalizeComponentName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const findComponent = (name: string, components: ConsumosComponent[]) => {
  const normalized = normalizeComponentName(name);
  return components.find(
    (component) => normalizeComponentName(component.name) === normalized,
  );
};

export const buildMonitorPduRows = (components: ConsumosComponent[]) => {
  const rows: PowerTableRow[] = [];
  const missingComponents: string[] = [];

  for (const componentName of MONITOR_PDU_COMPONENT_NAMES) {
    const component = findComponent(componentName, components);
    if (!component) {
      missingComponents.push(componentName);
      continue;
    }
    rows.push({
      quantity: "1",
      componentId: component.id.toString(),
      watts: component.watts.toString(),
      componentName: component.name,
    });
  }

  return { rows, missingComponents };
};

export const createPrebuiltMonitorPdu = ({
  components,
  id,
  pduOptions,
  settings,
  stage,
}: {
  components: ConsumosComponent[];
  id: number | string;
  pduOptions: string[];
  settings: PowerElectricalSettings;
  stage: { name: string; number: number } | null;
}): PowerTable => {
  const { rows, missingComponents } = buildMonitorPduRows(components);
  if (missingComponents.length > 0) {
    throw new Error(
      `Falta el componente "${missingComponents[0]}" en el catálogo de consumos.`,
    );
  }

  return createCalculatedPowerTable({
    components,
    currentTable: { rows, position: undefined },
    id,
    name: MONITOR_PDU_NAME,
    pduOptions,
    settings,
    tablePatch: {
      includesHoist: false,
      stageName: stage?.name ?? null,
      stageNumber: stage?.number ?? null,
    },
  }) as PowerTable;
};
