import { describe, expect, it } from "vitest";

import { SOUND_CONSUMOS_CONFIG } from "../departmentConfigs";
import { buildXmlpPowerTables, type XmlpAmpMap } from "../xmlpPowerImport";

const components = SOUND_CONSUMOS_CONFIG.components;

const rowFor = (result: ReturnType<typeof buildXmlpPowerTables>, tableName: string, componentName: string) =>
  result.tables
    .find((table) => table.name === tableName)
    ?.rows.find((row) => row.componentName === componentName);

describe("buildXmlpPowerTables", () => {
  it("merges mains/subs/outfills/frontfills by side into Main L / Main R with hoist and a Varios row", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 11, model: "LA12X" },
        { octet: 12, model: "LA12X" },
        { octet: 21, model: "LA12X" },
        { octet: 31, model: "LA12X" }, // sub
        { octet: 41, model: "LA12X" }, // out fill
        { octet: 51, model: "LA12X" }, // front fill
      ],
      groups: [
        { name: "MAIN L", role: "source", members: [11, 12] },
        { name: "MAIN R", role: "source", members: [21] },
        { name: "SUB L", role: "source", members: [31] },
        { name: "OUT R", role: "source", members: [41] },
        { name: "FRONT FILL L", role: "source", members: [51] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);

    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);

    const mainL = result.tables.find((table) => table.name === "Main L")!;
    expect(mainL.includesHoist).toBe(true);
    expect(mainL.position).toBe("DOSL");
    expect(mainL.rows).toEqual([
      expect.objectContaining({ componentName: "LA12X", quantity: "4" }), // 11,12 (main) + 31 (sub) + 51 (front fill)
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);

    const mainR = result.tables.find((table) => table.name === "Main R")!;
    expect(mainR.includesHoist).toBe(true);
    expect(mainR.position).toBe("DOSR");
    expect(mainR.rows).toEqual([
      expect.objectContaining({ componentName: "LA12X", quantity: "2" }), // 21 (main) + 41 (out)
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);
  });

  it("merges sidefill amps (both sides) into a single stage PDU with the monitor-world extras", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 61, model: "LA4X" },
        { octet: 62, model: "LA4X" },
      ],
      groups: [
        { name: "SIDEFILL L", role: "source", members: [61] },
        { name: "SIDEFILL R", role: "source", members: [62] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);

    expect(result.tables).toHaveLength(1);
    const sidefill = result.tables[0];
    expect(sidefill.name).toBe("Monitores");
    expect(sidefill.includesHoist).toBe(false);
    expect(sidefill.position).toBeUndefined();
    expect(sidefill.rows).toEqual([
      expect.objectContaining({ componentName: "LA4X", quantity: "2" }),
      expect.objectContaining({ componentName: "Control Mon (L)", quantity: "1" }),
      expect.objectContaining({ componentName: "RF Rack", quantity: "1" }),
      expect.objectContaining({ componentName: "Backline", quantity: "1" }),
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);
  });

  it("keeps every delay group as its own PDU, named as in the session file, each with a Varios row", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 71, model: "LA8" },
        { octet: 72, model: "LA8" },
      ],
      groups: [
        { name: "DELAY 1 L", role: "source", members: [71] },
        { name: "DELAY 1 R", role: "source", members: [72] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);

    expect(result.tables.map((table) => table.name).sort()).toEqual(["DELAY 1 L", "DELAY 1 R"]);
    for (const table of result.tables) {
      expect(table.includesHoist).toBe(false);
      expect(table.position).toBeUndefined();
      expect(table.rows).toEqual([
        expect.objectContaining({ componentName: "LA8", quantity: "1" }),
        expect.objectContaining({ componentName: "Varios", quantity: "1" }),
      ]);
    }
  });

  it("does not misclassify SIDEFILL as a front/out fill despite sharing the FILL keyword", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "SIDEFILL L", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["Monitores"]);
  });

  it("warns and drops amps whose model has no catalog equivalent", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "type99" }],
      groups: [{ name: "MAIN L", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    // Only the forced Varios row survives; the unmatched amp is dropped.
    expect(rowFor(result, "Main L", "Varios")).toBeDefined();
    expect(result.warnings).toContain(
      'Amplificador con modelo "type99" sin equivalencia en el catálogo de consumos; no se incluyó.',
    );
  });

  it("skips a PA-classified group when its side cannot be determined, with a warning", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "MAIN", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables).toEqual([]);
    expect(result.warnings).toEqual([
      'No se pudo determinar el lado (L/R) del grupo "MAIN"; no se importó.',
    ]);
  });

  it("ignores and warns about groups that match none of the known sections", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "KARA 1", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables).toEqual([]);
    expect(result.warnings).toEqual([
      'Grupo "KARA 1" no coincide con mains/subs/outfills/frontfills/sidefill/delay; sus amplificadores no se incluyeron.',
    ]);
  });

  it("assigns an amp shared across overlapping source groups to the first group only", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [
        { name: "MAIN L", role: "source", members: [1] },
        { name: "MAIN R", role: "source", members: [1] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["Main L"]);
  });

  it("recognizes an abbreviated bare 'SIDE' group as sidefill", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA4X" }],
      groups: [{ name: "SIDE L", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["Monitores"]);
  });

  it("recognizes the 'DLY' abbreviation (vowel-dropped, not a prefix of DELAY) as a delay group", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA8" }],
      groups: [{ name: "DLY 1 L", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["DLY 1 L"]);
  });

  it("classifies group names regardless of case (mixed/lowercase)", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "main l", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["Main L"]);
  });

  it("reads the fully spelled-out side word (LEFT/RIGHT), not just L/R", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "MAIN LEFT", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name)).toEqual(["Main L"]);
    expect(result.tables[0].position).toBe("DOSL");
  });

  it("ignores non-source-role groups entirely (parent/zoning groups)", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "MAINS", role: "parent", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
