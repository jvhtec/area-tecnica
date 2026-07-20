// Parses a decrypted L-Acoustics Network Manager session XML (`Nwm2`) into a
// normalized amplifier map. The XML is regex-scanned rather than DOM-parsed:
// the documents are large, attribute-only for the parts we need, and not always
// strictly well-formed, so a targeted scan is more robust than a full parser.

export interface NwmUnit {
  /** Last octet of the amp IP (the file stores only this). */
  octet: number;
  /** Full IP assuming the 192.168.1.x control range NM uses. */
  ip: string;
  presetName: string;
  familyName: string;
  /** Amp hardware model derived from unitType. */
  model: string;
  x: number;
  y: number;
}

export interface NwmGroup {
  name: string;
  role: string;
  /** Member amp octets. */
  members: number[];
}

export interface NwmMap {
  sessionName: string;
  units: NwmUnit[];
  groups: NwmGroup[];
  flysheet?: SoundvisionFlysheet;
}

export interface SoundvisionFlysheetEnclosure {
  model: string;
  splayAngleDegrees: number | null;
  siteAngleDegrees: number | null;
  trimHeightMeters: number | null;
}

export interface SoundvisionFlysheetArray {
  groupName: string;
  arrayName: string;
  deployment: "flown" | "stacked" | "unknown";
  azimuthDegrees: number | null;
  topSiteDegrees: number | null;
  bottomSiteDegrees: number | null;
  topHeightMeters: number | null;
  bottomHeightMeters: number | null;
  riggingFrame: string;
  flyingBarSetting: string;
  pickupConfiguration: string;
  totalMassKg: number | null;
  frontLoadKg: number | null;
  rearLoadKg: number | null;
  enclosures: SoundvisionFlysheetEnclosure[];
  warnings: string[];
}

export interface SoundvisionFlysheet {
  projectName: string;
  arrays: SoundvisionFlysheetArray[];
}

// L-Acoustics amplified-controller unitType → model. Only type 8 (LA12X, all
// K/Kara/KS series) is confirmed from captured sessions; the rest are best-effort
// and fall back to a generic label so we never assert a wrong model.
const UNIT_TYPE_MODEL: Record<string, string> = {
  "2": "LA8",
  "4": "LA4",
  "8": "LA12X",
  "16": "LA4X",
};

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textOf(body: string, tag: string): string {
  const m = body.match(new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`, "i"));
  return m ? decodeXmlEntities(m[1]) : "";
}

interface XmlBlock {
  attributes: string;
  body: string;
  start: number;
  end: number;
}

function extractXmlBlocks(xml: string, tag: string): XmlBlock[] {
  const blocks: XmlBlock[] = [];
  const stack: Array<{ attributes: string; bodyStart: number; start: number }> = [];
  const tokenPattern = new RegExp(`<${tag}\\b([^>]*)>|</${tag}>`, "gi");
  for (const match of xml.matchAll(tokenPattern)) {
    if (match[0].startsWith("</")) {
      const open = stack.pop();
      if (open) {
        blocks.push({
          attributes: open.attributes,
          body: xml.slice(open.bodyStart, match.index),
          start: open.start,
          end: match.index + match[0].length,
        });
      }
    } else if (!match[0].endsWith("/>")) {
      stack.push({
        attributes: match[1] ?? "",
        bodyStart: match.index + match[0].length,
        start: match.index,
      });
    }
  }
  return blocks;
}

function firstTextOf(body: string, tags: readonly string[]): string {
  for (const tag of tags) {
    const value = textOf(body, tag);
    if (value) return value;
  }
  return "";
}

function firstNumberOf(body: string, tags: readonly string[]): number | null {
  const text = firstTextOf(body, tags).trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function firstAttribute(
  attributes: Record<string, string>,
  names: readonly string[],
): string {
  for (const name of names) {
    const match = Object.entries(attributes).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    );
    if (match?.[1]) return decodeXmlEntities(match[1]);
  }
  return "";
}

function firstNumberAttribute(
  attributes: Record<string, string>,
  names: readonly string[],
): number | null {
  const text = firstAttribute(attributes, names).trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseNumericValues(body: string): number[] {
  const values = [
    ...[...body.matchAll(/>\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*</gi)].map(
      (match) => ({ index: match.index, value: Number(match[1]) }),
    ),
    ...[...body.matchAll(/\b(?:value|angle)="(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)"/gi)].map(
      (match) => ({ index: match.index, value: Number(match[1]) }),
    ),
  ];
  return values
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => a.index - b.index)
    .map(({ value }) => value);
}

function parseNumericTokens(value: string): number[] {
  return [...value.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
}

function parseDeployment(value: string): SoundvisionFlysheetArray["deployment"] {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("flown") || normalized.includes("fly")) return "flown";
  if (normalized.includes("stack") || normalized.includes("ground")) return "stacked";
  return "unknown";
}

function parsePickupConfiguration(body: string): string {
  const motorConfiguration = body.match(
    /<motor_configuration>([\s\S]*?)<\/motor_configuration>/i,
  )?.[1] ?? "";
  const front = firstTextOf(motorConfiguration, ["front"]);
  const rear = firstTextOf(motorConfiguration, ["rear"]);
  const pullback = firstTextOf(motorConfiguration, ["pullback"]);
  const parts = [
    front ? `F: ${front}` : "",
    rear ? `R: ${rear}` : "",
    pullback ? `PB: ${pullback}` : "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" / ");

  const motorPositions = firstTextOf(body, ["motor_positions"]);
  const positions = parseNumericTokens(motorPositions);
  if (positions.length > 0) return `Posiciones: ${positions.join(" / ")}`;

  const motorCount = firstTextOf(body, ["motors", "num_motors"]);
  return motorCount ? `${motorCount} motor${motorCount === "1" ? "" : "es"}` : "";
}

function parseFlyingBarSetting(
  clusterMetadata: string,
  clusterAttributes: Record<string, string>,
  riggingBody: string,
  riggingAttributes: Record<string, string>,
  riggingModel: string,
): string {
  const embeddedParts: string[] = [];
  const bar = riggingModel.match(/_(\d+)x([^_]*?-BAR)(?:_|$)/i);
  if (bar) embeddedParts.push(`${bar[1]}x ${bar[2]}`);
  const embeddedHole = riggingModel.match(/_Hole([^_]+)(?:_|$)/i);
  if (embeddedHole) embeddedParts.push(`Orificio ${embeddedHole[1]}`);
  if (/(?:^|_)Inv(?:_|$)/i.test(riggingModel)) embeddedParts.push("Invertido");
  if (embeddedParts.length > 0) return embeddedParts.join(" · ");

  const directSetting =
    firstTextOf(riggingBody, ["flying_bar_setting", "bar_setting"]) ||
    firstTextOf(clusterMetadata, ["flying_bar_setting", "bar_setting"]) ||
    firstAttribute(riggingAttributes, ["flying_bar_setting", "bar_setting"]) ||
    firstAttribute(clusterAttributes, ["flying_bar_setting", "bar_setting"]);
  if (directSetting) return directSetting;

  const hole =
    firstTextOf(riggingBody, ["bar_hole", "hole"]) ||
    firstTextOf(clusterMetadata, ["bar_hole", "hole"]) ||
    firstAttribute(riggingAttributes, ["bar_hole", "hole"]) ||
    firstAttribute(clusterAttributes, ["bar_hole", "hole"]);
  if (hole) return `Orificio ${hole}`;

  const index =
    firstTextOf(riggingBody, ["rigging_element_index"]) ||
    firstTextOf(clusterMetadata, ["rigging_element_index"]) ||
    firstAttribute(riggingAttributes, ["rigging_element_index"]) ||
    firstAttribute(clusterAttributes, ["rigging_element_index"]);
  return index ? `Índice ${index}` : "";
}

function parseWarnings(body: string): string[] {
  const warnings = [
    ...body.matchAll(
      /<(?:mechanical_warning|warning)\b[^>]*>([\s\S]*?)<\/(?:mechanical_warning|warning)>/gi,
    ),
  ]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .map(decodeXmlEntities)
    .filter(Boolean);
  return [...new Set(warnings)];
}

function parseEnclosures(clusterBody: string): SoundvisionFlysheetEnclosure[] {
  const elementsBody = extractXmlBlocks(clusterBody, "elements")
    .filter((block) => /<(?:element|enclosure)\b/i.test(block.body))
    .sort((a, b) => b.body.length - a.body.length)[0]?.body ?? "";
  const elementMatches = elementsBody
    ? [
        ...[...elementsBody.matchAll(/<(element|enclosure)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(
          (match) => ({ index: match.index, attributes: match[2], body: match[3] }),
        ),
        ...[...elementsBody.matchAll(/<(?:element|enclosure)\b([^>]*)\/>/gi)].map(
          (match) => ({ index: match.index, attributes: match[1], body: "" }),
        ),
      ].sort((a, b) => a.index - b.index)
    : [];

  const interAnglesBody =
    clusterBody.match(/<inter_angles>([\s\S]*?)<\/inter_angles>/i)?.[1] ?? "";
  const interAngles = parseNumericValues(interAnglesBody);

  return elementMatches.map((match, index) => {
    const elementAttributes = attrs(match.attributes);
    const elementBody = match.body;
    const model =
      firstAttribute(elementAttributes, ["type", "model", "refid", "name"]) ||
      firstTextOf(elementBody, ["type", "model", "refid", "name", "enclosure_type"]);
    return {
      model: model || `RECINTO ${index + 1}`,
      splayAngleDegrees:
        firstNumberOf(elementBody, ["splay", "splay_angle", "inter_angle", "angle"]) ??
        firstNumberAttribute(elementAttributes, ["splay", "splay_angle", "inter_angle", "angle"]) ??
        interAngles[index] ??
        null,
      siteAngleDegrees:
        firstNumberOf(elementBody, ["site", "site_angle"]) ??
        firstNumberAttribute(elementAttributes, ["site", "site_angle"]),
      trimHeightMeters:
        firstNumberOf(elementBody, ["trim", "trim_height", "z"]) ??
        firstNumberAttribute(elementAttributes, ["trim", "trim_height", "z"]),
    };
  });
}

/**
 * Extracts the deployment data serialized in a Soundvision project. Loads and
 * safety factors calculated by Soundvision's proprietary mechanical engine are
 * intentionally left null unless they are explicitly present in the XML.
 */
export function parseSoundvisionFlysheet(
  xml: string,
  fallbackProjectName = "",
): SoundvisionFlysheet {
  const projectTag = xml.match(/<project\b([^>]*)>/i)?.[1] ?? "";
  const projectName =
    firstAttribute(attrs(projectTag), ["name", "projectName", "project_name"]) ||
    firstTextOf(xml.slice(0, 20_000), ["project_name", "projectName"]) ||
    fallbackProjectName;

  const arrays: SoundvisionFlysheetArray[] = [];
  const allConfigurations = extractXmlBlocks(xml, "physical_configuration");
  const clusters = extractXmlBlocks(xml, "cluster");

  for (const cluster of clusters) {
    const configuration = allConfigurations
      .filter((candidate) => candidate.start < cluster.start && candidate.end > cluster.end)
      .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    if (!configuration) continue;

    const configurationAttributes = attrs(configuration.attributes);
    const configurationBody = configuration.body;
    const groupName =
      firstAttribute(configurationAttributes, ["name", "id"]) ||
      firstTextOf(configurationBody.split(/<cluster\b/i)[0], ["name", "label"]) ||
      "SISTEMA";

    const clusterAttributes = attrs(cluster.attributes);
    const clusterBody = cluster.body;
    const elements = parseEnclosures(clusterBody);
    if (elements.length === 0) continue;

    const clusterMetadata = clusterBody
      .replace(/<elements>[\s\S]*?<\/elements>/i, "")
      .replace(/<connection_sets>[\s\S]*?<\/connection_sets>/i, "");
    const arrayName =
      firstAttribute(clusterAttributes, ["name", "id", "label"]) ||
      firstTextOf(clusterMetadata, ["name", "label"]) ||
      `ARRAY ${arrays.length + 1}`;
    const riggingBlock = extractXmlBlocks(clusterBody, "rigging_element")[0];
    const riggingBody = riggingBlock?.body ?? "";
    const riggingAttributes = attrs(riggingBlock?.attributes ?? "");
    const riggingModel =
      firstAttribute(riggingAttributes, ["type", "model", "refid", "name"]) ||
      firstTextOf(riggingBody, ["type", "model", "refid", "name"]);
    const topElement = elements[0];
    const bottomElement = elements[elements.length - 1];
    const position = parseNumericTokens(firstTextOf(clusterMetadata, ["position"]));
    const orientation = parseNumericTokens(firstTextOf(clusterMetadata, ["orientation"]));
    const topSiteDegrees =
      firstNumberOf(clusterMetadata, ["top_site", "top_site_angle"]) ??
      topElement.siteAngleDegrees ??
      orientation[0] ??
      null;
    const serializedSplay = elements
      .map((element) => element.splayAngleDegrees)
      .filter((angle): angle is number => angle !== null);

    const deployment = parseDeployment([
      firstTextOf(clusterMetadata, ["configuration", "deployment", "deployment_orientation"]),
      firstAttribute(clusterAttributes, ["deployment_orientation", "deployment", "configuration"]),
      firstTextOf(riggingBody, ["configuration", "deployment", "deployment_orientation"]),
      firstTextOf(clusterBody, ["configuration"]),
    ].filter(Boolean).join(" "));

    arrays.push({
      groupName,
      arrayName,
      deployment,
      azimuthDegrees:
        firstNumberOf(clusterMetadata, ["azimuth", "azimuth_angle"]) ??
        firstNumberAttribute(clusterAttributes, ["azimuth", "azimuth_angle"]) ??
        orientation[2] ??
        null,
      topSiteDegrees,
      bottomSiteDegrees:
        firstNumberOf(clusterMetadata, ["bottom_site", "bottom_site_angle"]) ??
        bottomElement.siteAngleDegrees ??
        (topSiteDegrees !== null && serializedSplay.length > 0
          ? topSiteDegrees - serializedSplay.reduce((sum, angle) => sum + angle, 0)
          : null),
      topHeightMeters:
        firstNumberOf(clusterMetadata, ["top_height", "top_z", "top_elevation"]) ??
        topElement.trimHeightMeters ??
        position[2] ??
        null,
      bottomHeightMeters:
        firstNumberOf(clusterMetadata, ["bottom_height", "bottom_z", "bottom_elevation"]) ??
        bottomElement.trimHeightMeters,
      riggingFrame: riggingModel.replace(/_Hole.*$/i, ""),
      flyingBarSetting: parseFlyingBarSetting(
        clusterMetadata,
        clusterAttributes,
        riggingBody,
        riggingAttributes,
        riggingModel,
      ),
      pickupConfiguration: parsePickupConfiguration(clusterBody),
      totalMassKg: firstNumberOf(clusterMetadata, ["total_mass", "total_weight"]),
      frontLoadKg: firstNumberOf(clusterMetadata, ["front_load", "front_pick_load"]),
      rearLoadKg: firstNumberOf(clusterMetadata, ["rear_load", "rear_pick_load"]),
      enclosures: elements,
      warnings: parseWarnings(clusterBody),
    });
  }

  return { projectName: projectName.replace(/\.xmlp$/i, ""), arrays };
}

/** Extracts LAGROUP definitions (shared by both NM and embedded Soundvision sessions). */
function parseGroups(xml: string): NwmGroup[] {
  const groups: NwmGroup[] = [];
  for (const m of xml.matchAll(/<LAGROUP\b([^>]*)>([\s\S]*?)<\/LAGROUP>/g)) {
    const a = attrs(m[1]);
    if (!a.Name) continue;
    const members = [...m[2].matchAll(/<unit\s+unitIp="(\d+)"/g)].map((u) => Number(u[1]));
    groups.push({ name: decodeXmlEntities(a.Name), role: a.role ?? "", members });
  }
  return groups;
}

/** Parses a standalone NM `.nwm` session XML (`Nwm2`). */
export function parseNwmXml(xml: string): NwmMap {
  const sessionMatch = xml.match(/<COMPONENTS[^>]*\bsessionName="([^"]*)"/);
  const sessionName = sessionMatch ? decodeXmlEntities(sessionMatch[1]) : "";

  const units: NwmUnit[] = [];
  for (const m of xml.matchAll(/<LAVIRTUALUNIT\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.presetName === undefined) continue; // control devices (switches/P1) carry no preset
    const octet = Number(a.ampIp);
    if (!Number.isFinite(octet)) continue;
    units.push({
      octet,
      ip: `192.168.1.${octet}`,
      presetName: decodeXmlEntities(a.presetName),
      familyName: decodeXmlEntities(a.familyName ?? ""),
      model: UNIT_TYPE_MODEL[a.unitType] ?? `type${a.unitType ?? "?"}`,
      x: Number(a.xpos ?? 0),
      y: Number(a.ypos ?? 0),
    });
  }

  return { sessionName, units, groups: parseGroups(xml) };
}

/**
 * Parses a Soundvision `.xmlp` project XML. Amps come from
 * `physical_configuration/amplification/units` (element-nested: `<model>`,
 * `<ip>` octet, first `<channelSet><preset>`); the sided groups come from the
 * embedded `<nwm_session>` block's LAGROUPs (same schema as a standalone `.nwm`).
 */
export function parseXmlpXml(xml: string, fallbackProjectName = ""): NwmMap {
  const sessionMatch = xml.match(/<COMPONENTS[^>]*\bsessionName="([^"]*)"/);
  const sessionName = (sessionMatch ? decodeXmlEntities(sessionMatch[1]) : fallbackProjectName)
    .replace(/\.xmlp$/i, "");

  const ampSection = xml.match(/<amplification>([\s\S]*?)<\/amplification>/)?.[1] ?? "";
  const unitsSection = ampSection.match(/<units>([\s\S]*?)<\/units>/)?.[1] ?? "";

  const units: NwmUnit[] = [];
  for (const m of unitsSection.matchAll(/<unit>([\s\S]*?)<\/unit>/g)) {
    const body = m[1];
    const octet = Number(textOf(body, "ip"));
    if (!Number.isFinite(octet) || octet === 0) continue;
    const preset = textOf(body, "preset"); // first channelSet preset
    const model = textOf(body, "model");
    units.push({
      octet,
      ip: `192.168.1.${octet}`,
      presetName: preset,
      familyName: "",
      model: model || "LA12X",
      x: 0,
      y: 0,
    });
  }

  const embedded = xml.match(/<nwm_session>([\s\S]*?)<\/nwm_session>/)?.[1] ?? "";
  return {
    sessionName,
    units,
    groups: parseGroups(embedded),
    flysheet: parseSoundvisionFlysheet(xml, sessionName),
  };
}
