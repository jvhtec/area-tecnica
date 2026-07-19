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
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&apos;/g, "'");
}

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

  const groups: NwmGroup[] = [];
  for (const m of xml.matchAll(/<LAGROUP\b([^>]*)>([\s\S]*?)<\/LAGROUP>/g)) {
    const a = attrs(m[1]);
    if (!a.Name) continue;
    const members = [...m[2].matchAll(/<unit\s+unitIp="(\d+)"/g)].map((u) => Number(u[1]));
    groups.push({ name: decodeXmlEntities(a.Name), role: a.role ?? "", members });
  }

  return { sessionName, units, groups };
}
