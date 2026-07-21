import {
  toAmpModel,
  type NwmGroup,
  type NwmUnit,
} from "@/components/sound/amplifier-tool/rack-designer/nwm-import";
import type { PowerTableRow } from "@/features/technical-tools/power/types";
import type { ConsumosComponent } from "./config";
import { buildMonitorPduRows, MONITOR_PDU_NAME } from "./monitorPduPreset";

type XmlpAmpUnit = Pick<NwmUnit, "octet" | "model">;
type XmlpAmpGroup = Pick<NwmGroup, "name" | "role" | "members">;

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

// Session-file group names come straight from whoever built the Soundvision
// project, so they show up in every case (SIDE, Side, side), split on spaces,
// hyphens or underscores, and are often abbreviated or truncated (SIDE for
// "sidefill", DLY/DEL for "delay"). Tokenizing on word boundaries \u2014 rather
// than searching the whole raw string \u2014 keeps a compound name like
// "SIDEFILL" from matching the PA keyword "FILL" out of position.
const tokenize = (name: string): string[] =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

const MIN_PARTIAL_TOKEN_LENGTH = 3;

// True when `token` is the keyword itself, a truncated prefix of it (e.g.
// "SID" or "DEL" for "DELAY"), or the keyword is a prefix of a compound token
// (e.g. "SIDEFILL", "OUTFILL"). The length guard keeps short side/number
// tokens ("L", "R", "1") from spuriously prefix-matching a keyword.
const tokenMatchesKeyword = (token: string, keyword: string) =>
  token === keyword ||
  (token.length >= MIN_PARTIAL_TOKEN_LENGTH && keyword.startsWith(token)) ||
  (keyword.length >= MIN_PARTIAL_TOKEN_LENGTH && token.startsWith(keyword));

const PA_KEYWORDS = ["MAIN", "SUB", "OUT", "FRONT", "FILL"];
const SIDE_KEYWORDS = ["SIDE", "MONITOR"];
const PA_ALIASES = new Set(["PA", "FF", "OF"]);
const SIDE_ALIASES = new Set(["SF"]);
// Vowel-dropped shorthand that isn't a prefix of the full word, so it can't
// be caught by tokenMatchesKeyword's prefix check.
const DELAY_ALIASES = new Set(["DLY"]);

// SIDE and DELAY are checked before the generic PA pattern so "SIDEFILL"
// (which also starts a compound containing "FILL") is not misclassified as a
// front/out fill.
function classifySection(groupName: string): Section {
  const tokens = tokenize(groupName);
  if (
    tokens.some(
      (token) =>
        SIDE_ALIASES.has(token) ||
        SIDE_KEYWORDS.some((keyword) => tokenMatchesKeyword(token, keyword)),
    )
  ) {
    return "SIDE";
  }
  if (
    tokens.some((token) => tokenMatchesKeyword(token, "DELAY") || DELAY_ALIASES.has(token))
  ) {
    return "DELAY";
  }
  if (
    tokens.some(
      (token) =>
        PA_ALIASES.has(token) ||
        PA_KEYWORDS.some((keyword) => tokenMatchesKeyword(token, keyword)),
    )
  ) {
    return "PA";
  }
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

// Counts amplifier hardware units (LA12X, LA8, …) driving each PDU — never
// the loudspeaker enclosures/boxes those amps power. `unit.model` comes from
// the amp channel's own `<model>` tag in the session file (parseXmlpXml
// defaults it to "LA12X" when that tag is absent, since that's virtually
// always the true amp on a modern K/Kara/KS session), not from the box/preset
// name a channel happens to be driving.
const countAmpsByComponent = (
  units: XmlpAmpUnit[],
  components: ConsumosComponent[],
  warnings: string[],
) => {
  const counts = new Map<string, { component: ConsumosComponent; quantity: number }>();
  for (const unit of units) {
    const ampModel = toAmpModel(unit.model);
    // The bundled planning catalog has no separate LA4 row. Reuse the LA4X
    // planning entry so an older session never loses that amplifier entirely.
    const catalogModel = ampModel === "LA4" ? "LA4X" : ampModel;
    const component = findComponent(catalogModel, components);
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
 * single "Monitores" stage PDU with the usual monitor-world extras; each
 * delay group keeps its own PDU, exactly as named in the session file.
 */
export function buildXmlpPowerTables(
  map: XmlpAmpMap,
  components: ConsumosComponent[],
): XmlpPowerImportResult {
  const warnings: string[] = [];
  const unitByOctet = new Map(map.units.map((unit) => [unit.octet, unit]));
  const sourceGroups = map.groups.filter((group) => group.role === "source");

  // First source group wins for amps that appear in multiple overlapping groups.
  const assignedGroup = new Map<number, XmlpAmpGroup>();
  for (const group of sourceGroups) {
    for (const octet of group.members) {
      if (unitByOctet.has(octet) && !assignedGroup.has(octet)) {
        assignedGroup.set(octet, group);
      }
    }
  }

  // Category and side are not always repeated in a source group name. NM and
  // some Soundvision projects instead expose parents such as "Main K2",
  // "SUBS", "Outfill" and "Frontfill", plus separate LEFT/RIGHT membership.
  // Index all non-source memberships so each amp can inherit that context.
  const contextGroupsByOctet = new Map<number, XmlpAmpGroup[]>();
  for (const group of map.groups) {
    if (group.role === "source") continue;
    for (const octet of group.members) {
      if (!unitByOctet.has(octet)) continue;
      const groups = contextGroupsByOctet.get(octet) ?? [];
      groups.push(group);
      contextGroupsByOctet.set(octet, groups);
    }
  }

  // Every amplifier that isn't a sidefill or a delay is main PA and goes into
  // one shared pool — mains, subs, outfills, frontfills, and cabinet-named or
  // otherwise unrecognized groups alike. The pool is split evenly across the
  // two main power drops (Main L / Main R); per-amp L/R labels in the session
  // don't determine which drop feeds them.
  const mainsPool: XmlpAmpUnit[] = [];
  const sidefillUnits: XmlpAmpUnit[] = [];
  const delayGroups = new Map<string, XmlpAmpUnit[]>();

  for (const [octet, sourceGroup] of assignedGroup) {
    const unit = unitByOctet.get(octet)!;
    const contextGroups = [...(contextGroupsByOctet.get(octet) ?? [])].sort(
      (left, right) => left.members.length - right.members.length,
    );
    const directSection = classifySection(sourceGroup.name);
    const section =
      directSection === "OTHER"
        ? contextGroups
            .map((group) => classifySection(group.name))
            .find((candidate) => candidate !== "OTHER") ?? "OTHER"
        : directSection;

    if (section === "SIDE") {
      sidefillUnits.push(unit);
    } else if (section === "DELAY") {
      const units = delayGroups.get(sourceGroup.name) ?? [];
      units.push(unit);
      delayGroups.set(sourceGroup.name, units);
    } else {
      mainsPool.push(unit);
      if (section === "OTHER") {
        warnings.push(
          `Grupo "${sourceGroup.name}" no se identificó como sidefill ni delay; sus amplificadores se añadieron al PA principal.`,
        );
      }
    }
  }

  const tables: XmlpPowerBuiltTable[] = [];

  // Split the pooled amplifiers as evenly as possible into a Main L and a Main
  // R PDU, balancing each model between them and alternating which side gets
  // the odd unit so the two hoist-powered drops carry the same load.
  if (mainsPool.length > 0) {
    const mainsCounts = countAmpsByComponent(mainsPool, components, warnings);
    const leftCounts = new Map<string, { component: ConsumosComponent; quantity: number }>();
    const rightCounts = new Map<string, { component: ConsumosComponent; quantity: number }>();
    let oddGoesLeft = true;
    for (const [key, { component, quantity }] of mainsCounts) {
      let left = Math.floor(quantity / 2);
      let right = left;
      if (quantity % 2 === 1) {
        if (oddGoesLeft) left += 1;
        else right += 1;
        oddGoesLeft = !oddGoesLeft;
      }
      if (left > 0) leftCounts.set(key, { component, quantity: left });
      if (right > 0) rightCounts.set(key, { component, quantity: right });
    }

    (["L", "R"] as const).forEach((side) => {
      const rows = rowsFromCounts(side === "L" ? leftCounts : rightCounts);
      addExtraRow(rows, "Varios", 1, components, warnings, `Main ${side}`);
      tables.push({
        name: `Main ${side}`,
        rows,
        includesHoist: true,
        position: side === "L" ? "DOSL" : "DOSR",
      });
    });
  }

  if (sidefillUnits.length > 0) {
    const rows = rowsFromCounts(countAmpsByComponent(sidefillUnits, components, warnings));
    const monitorRows = buildMonitorPduRows(components);
    rows.push(...monitorRows.rows);
    for (const componentName of monitorRows.missingComponents) {
      warnings.push(
        `No se encontró el componente "${componentName}" en el catálogo; no se añadió esa fila a ${MONITOR_PDU_NAME}.`,
      );
    }
    if (rows.length > 0) {
      tables.push({ name: MONITOR_PDU_NAME, rows, includesHoist: false });
    }
  }

  for (const [name, units] of delayGroups) {
    const rows = rowsFromCounts(countAmpsByComponent(units, components, warnings));
    addExtraRow(rows, "Varios", 1, components, warnings, `"${name}"`);
    if (rows.length === 0) continue;
    tables.push({ name: name.trim() || `Delay ${tables.length + 1}`, rows, includesHoist: false });
  }

  return { tables, warnings: [...new Set(warnings)] };
}
