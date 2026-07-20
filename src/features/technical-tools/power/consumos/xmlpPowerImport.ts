import { toAmpModel } from "@/components/sound/amplifier-tool/rack-designer/nwm-import";
import type { PowerTableRow } from "@/features/technical-tools/power/types";
import type { ConsumosComponent } from "./config";

interface XmlpAmpUnit {
  octet: number;
  model: string;
}

interface XmlpAmpGroup {
  name: string;
  role: string;
  members: number[];
}

export interface XmlpAmpMap {
  units: XmlpAmpUnit[];
  groups: XmlpAmpGroup[];
}

export interface XmlpPowerBuiltTable {
  name: string;
  rows: PowerTableRow[];
  includesHoist: boolean;
  position?: string;
}

export interface XmlpPowerImportResult {
  tables: XmlpPowerBuiltTable[];
  warnings: string[];
}

type Side = "L" | "R" | "C";
type Section = "PA" | "SIDE" | "DELAY" | "OTHER";

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const findComponent = (name: string, components: ConsumosComponent[]) => {
  const normalized = normalizeName(name);
  return components.find((component) => normalizeName(component.name) === normalized);
};

const sideFromName = (name: string): Side => {
  const last = name.trim().slice(-1).toUpperCase();
  return last === "L" ? "L" : last === "R" ? "R" : "C";
};

// SIDE is checked before the generic PA pattern so "SIDEFILL" (which also
// contains "FILL") is not misclassified as a front/out fill.
function classifySection(groupName: string): Section {
  const normalized = normalizeName(groupName);
  if (/SIDE/.test(normalized)) return "SIDE";
  if (/DELAY/.test(normalized)) return "DELAY";
  if (/MAIN|SUB|OUT|FRONT|FILL/.test(normalized)) return "PA";
  return "OTHER";
}

const appendRow = (rows: PowerTableRow[], component: ConsumosComponent, quantity: number) => {
  rows.push({
    quantity: quantity.toString(),
    componentId: component.id.toString(),
    watts: component.watts.toString(),
    componentName: component.name,
  });
};

const countAmpsByComponent = (
  units: XmlpAmpUnit[],
  components: ConsumosComponent[],
  warnings: string[],
) => {
  const counts = new Map<string, { component: ConsumosComponent; quantity: number }>();
  for (const unit of units) {
    const ampModel = toAmpModel(unit.model);
    const component = findComponent(ampModel, components);
    if (!component) {
      warnings.push(
        `Amplificador con modelo "${unit.model}" sin equivalencia en el catálogo de consumos; no se incluyó.`,
      );
      continue;
    }
    const key = component.id.toString();
    const current = counts.get(key);
    counts.set(key, { component, quantity: (current?.quantity ?? 0) + 1 });
  }
  return counts;
};

const rowsFromCounts = (counts: Map<string, { component: ConsumosComponent; quantity: number }>) => {
  const rows: PowerTableRow[] = [];
  for (const { component, quantity } of counts.values()) appendRow(rows, component, quantity);
  return rows;
};

const addExtraRow = (
  rows: PowerTableRow[],
  componentName: string,
  quantity: number,
  components: ConsumosComponent[],
  warnings: string[],
  contextLabel: string,
) => {
  const component = findComponent(componentName, components);
  if (!component) {
    warnings.push(
      `No se encontró el componente "${componentName}" en el catálogo; no se añadió esa fila a ${contextLabel}.`,
    );
    return;
  }
  appendRow(rows, component, quantity);
};

/**
 * Builds Consumos PDU tables from an imported Soundvision `.xmlp` amplifier
 * map. Mains/subs/outfills/front fills are merged by side into "Main L" /
 * "Main R" PDUs (hoist power required); sidefill amps are merged into a
 * single stage PDU with the usual monitor-world extras; each delay group
 * keeps its own PDU, exactly as named in the session file.
 */
export function buildXmlpPowerTables(
  map: XmlpAmpMap,
  components: ConsumosComponent[],
): XmlpPowerImportResult {
  const warnings: string[] = [];
  const unitByOctet = new Map(map.units.map((unit) => [unit.octet, unit]));
  const sourceGroups = map.groups.filter((group) => group.role === "source");

  // First source group wins for amps that appear in multiple overlapping groups.
  const assignedGroup = new Map<number, string>();
  for (const group of sourceGroups) {
    for (const octet of group.members) {
      if (unitByOctet.has(octet) && !assignedGroup.has(octet)) {
        assignedGroup.set(octet, group.name);
      }
    }
  }

  const unitsByGroup = new Map<string, XmlpAmpUnit[]>();
  for (const [octet, groupName] of assignedGroup) {
    const unit = unitByOctet.get(octet)!;
    if (!unitsByGroup.has(groupName)) unitsByGroup.set(groupName, []);
    unitsByGroup.get(groupName)!.push(unit);
  }

  const paUnitsBySide: Record<"L" | "R", XmlpAmpUnit[]> = { L: [], R: [] };
  const sidefillUnits: XmlpAmpUnit[] = [];
  const delayGroups: Array<{ name: string; units: XmlpAmpUnit[] }> = [];

  for (const [groupName, units] of unitsByGroup) {
    const section = classifySection(groupName);
    if (section === "PA") {
      const side = sideFromName(groupName);
      if (side === "C") {
        warnings.push(
          `No se pudo determinar el lado (L/R) del grupo "${groupName}"; no se importó.`,
        );
        continue;
      }
      paUnitsBySide[side].push(...units);
    } else if (section === "SIDE") {
      sidefillUnits.push(...units);
    } else if (section === "DELAY") {
      delayGroups.push({ name: groupName, units });
    } else {
      warnings.push(
        `Grupo "${groupName}" no coincide con mains/subs/outfills/frontfills/sidefill/delay; sus amplificadores no se incluyeron.`,
      );
    }
  }

  const tables: XmlpPowerBuiltTable[] = [];

  (["L", "R"] as const).forEach((side) => {
    const units = paUnitsBySide[side];
    if (units.length === 0) return;
    const rows = rowsFromCounts(countAmpsByComponent(units, components, warnings));
    addExtraRow(rows, "Varios", 1, components, warnings, `Main ${side}`);
    if (rows.length === 0) return;
    tables.push({
      name: `Main ${side}`,
      rows,
      includesHoist: true,
      position: side === "L" ? "DOSL" : "DOSR",
    });
  });

  if (sidefillUnits.length > 0) {
    const rows = rowsFromCounts(countAmpsByComponent(sidefillUnits, components, warnings));
    const extras: Array<[string, number]> = [
      ["Control Mon (L)", 1],
      ["RF Rack", 1],
      ["Backline", 1],
      ["Varios", 1],
    ];
    for (const [name, quantity] of extras) {
      addExtraRow(rows, name, quantity, components, warnings, "Sidefill");
    }
    if (rows.length > 0) {
      tables.push({ name: "Sidefill", rows, includesHoist: false });
    }
  }

  for (const { name, units } of delayGroups) {
    const rows = rowsFromCounts(countAmpsByComponent(units, components, warnings));
    addExtraRow(rows, "Varios", 1, components, warnings, `"${name}"`);
    if (rows.length === 0) continue;
    tables.push({ name: name.trim() || `Delay ${tables.length + 1}`, rows, includesHoist: false });
  }

  return { tables, warnings: [...new Set(warnings)] };
}
