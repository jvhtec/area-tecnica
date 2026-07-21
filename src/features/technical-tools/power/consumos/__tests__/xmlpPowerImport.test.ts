import { describe, expect, it } from "vitest";

import { SOUND_CONSUMOS_CONFIG } from "../departmentConfigs";
import { buildXmlpPowerTables, type XmlpAmpMap } from "../xmlpPowerImport";

const components = SOUND_CONSUMOS_CONFIG.components;

const rowFor = (result: ReturnType<typeof buildXmlpPowerTables>, tableName: string, componentName: string) =>
  result.tables
    .find((table) => table.name === tableName)
    ?.rows.find((row) => row.componentName === componentName);

describe("buildXmlpPowerTables", () => {
  it("pools mains/subs/outfills/frontfills and splits them evenly into Main L / Main R with hoist and a Varios row", () => {
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

    // All 6 PA amps pool and split evenly, regardless of the L/R labels above.
    const mainL = result.tables.find((table) => table.name === "Main L")!;
    expect(mainL.includesHoist).toBe(true);
    expect(mainL.position).toBe("DOSL");
    expect(mainL.rows).toEqual([
      expect.objectContaining({ componentName: "LA12X", quantity: "3" }),
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);

    const mainR = result.tables.find((table) => table.name === "Main R")!;
    expect(mainR.includesHoist).toBe(true);
    expect(mainR.position).toBe("DOSR");
    expect(mainR.rows).toEqual([
      expect.objectContaining({ componentName: "LA12X", quantity: "3" }),
      expect.objectContaining({ componentName: "Varios", quantity: "1" }),
    ]);
  });

  it("pools every non-sidefill, non-delay amp and splits it half to Main L, half to Main R", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 11, model: "LA12X" }, // main
        { octet: 12, model: "LA12X" }, // main
        { octet: 21, model: "LA12X" }, // sub
        { octet: 22, model: "LA12X" }, // outfill
        { octet: 31, model: "LA4X" }, // sidefill (excluded from the pool)
        { octet: 41, model: "LA8" }, // delay (excluded from the pool)
      ],
      groups: [
        { name: "MAIN L", role: "source", members: [11] },
        { name: "MAIN R", role: "source", members: [12] },
        { name: "SUBS", role: "source", members: [21] },
        { name: "OUTFILL", role: "source", members: [22] },
        { name: "SIDEFILL", role: "source", members: [31] },
        { name: "DELAY 1", role: "source", members: [41] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);

    // 4 main-PA amps split 2/2; sidefill -> Monitores, delay -> its own PDU.
    expect(result.tables.map((table) => table.name).sort()).toEqual([
      "DELAY 1",
      "Main L",
      "Main R",
      "Monitores",
    ]);
    const mainL = result.tables.find((table) => table.name === "Main L")!;
    const mainR = result.tables.find((table) => table.name === "Main R")!;
    expect(mainL.includesHoist).toBe(true);
    expect(mainR.includesHoist).toBe(true);
    expect(rowFor(result, "Main L", "LA12X")?.quantity).toBe("2");
    expect(rowFor(result, "Main R", "LA12X")?.quantity).toBe("2");
    // The sidefill/delay amps never leak into the main pool.
    expect(rowFor(result, "Main L", "LA4X")).toBeUndefined();
    expect(rowFor(result, "Main R", "LA8")).toBeUndefined();
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

  it("splits unsided PA groups evenly across Main L and Main R", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 1, model: "LA12X" },
        { octet: 2, model: "LA12X" },
        { octet: 3, model: "LA12X" },
        { octet: 4, model: "LA12X" },
      ],
      groups: [
        { name: "Main K2", role: "source", members: [1] },
        { name: "SUBS", role: "source", members: [2] },
        { name: "Outfill", role: "source", members: [3] },
        { name: "Frontfill", role: "source", members: [4] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
    expect(rowFor(result, "Main L", "LA12X")).toEqual(expect.objectContaining({ quantity: "2" }));
    expect(rowFor(result, "Main R", "LA12X")).toEqual(expect.objectContaining({ quantity: "2" }));
    expect(result.tables.find((table) => table.name === "Main L")?.position).toBe("DOSL");
    expect(result.tables.find((table) => table.name === "Main R")?.position).toBe("DOSR");
    expect(result.warnings).toEqual([]);
  });

  it("uses screenshot-style parent groups to classify cabinet-named source groups", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 11, model: "LA12X" },
        { octet: 12, model: "LA12X" },
        { octet: 21, model: "LA12X" },
        { octet: 22, model: "LA12X" },
      ],
      groups: [
        { name: "ALL", role: "parent", members: [11, 12, 21, 22] },
        { name: "Main K2", role: "parent", members: [11, 12] },
        { name: "SUBS", role: "parent", members: [21] },
        { name: "Outfill", role: "parent", members: [22] },
        { name: "K2 L", role: "source", members: [11] },
        { name: "K2 R", role: "source", members: [12] },
        { name: "KS28 L", role: "source", members: [21] },
        { name: "KARA R", role: "source", members: [22] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
    expect(rowFor(result, "Main L", "LA12X")).toEqual(
      expect.objectContaining({ quantity: "2" }),
    );
    expect(rowFor(result, "Main R", "LA12X")).toEqual(
      expect.objectContaining({ quantity: "2" }),
    );
    expect(result.warnings).toEqual([]);
  });

  it("uses independent LEFT/RIGHT membership when source names have no side", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 11, model: "LA12X" },
        { octet: 12, model: "LA12X" },
      ],
      groups: [
        { name: "Main K2", role: "parent", members: [11, 12] },
        { name: "LEFT", role: "side", members: [11] },
        { name: "RIGHT", role: "side", members: [12] },
        { name: "K2", role: "source", members: [11, 12] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
    expect(rowFor(result, "Main L", "LA12X")?.quantity).toBe("1");
    expect(rowFor(result, "Main R", "LA12X")?.quantity).toBe("1");
  });

  it("recognizes common PA, fill, sidefill, and delay abbreviations", () => {
    const map: XmlpAmpMap = {
      units: [
        { octet: 1, model: "LA12X" },
        { octet: 2, model: "LA12X" },
        { octet: 3, model: "LA4X" },
        { octet: 4, model: "LA8" },
      ],
      groups: [
        { name: "PA L", role: "source", members: [1] },
        { name: "FF R", role: "source", members: [2] },
        { name: "SF", role: "source", members: [3] },
        { name: "DLY 1", role: "source", members: [4] },
      ],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual([
      "DLY 1",
      "Main L",
      "Main R",
      "Monitores",
    ]);
  });

  it("folds unrecognized (non-sidefill, non-delay) groups into the main PA pool with a note", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "KARA 1", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
    expect(rowFor(result, "Main L", "LA12X")).toEqual(expect.objectContaining({ quantity: "1" }));
    expect(result.warnings).toContain(
      'Grupo "KARA 1" no se identificó como sidefill ni delay; sus amplificadores se añadieron al PA principal.',
    );
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
    // The shared amp is assigned to the first source group only, so it is
    // counted once across the pooled Main L / Main R split (not double-added).
    const mainLA12X = result.tables
      .filter((table) => table.name.startsWith("Main "))
      .flatMap((table) => table.rows)
      .filter((row) => row.componentName === "LA12X")
      .reduce((sum, row) => sum + Number(row.quantity), 0);
    expect(mainLA12X).toBe(1);
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
    // Recognized as main PA (not dropped) and routed into the pooled split.
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
  });

  it("recognizes the fully spelled-out MAIN keyword as main PA", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA12X" }],
      groups: [{ name: "MAIN LEFT", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(result.tables.map((table) => table.name).sort()).toEqual(["Main L", "Main R"]);
    expect(result.tables.find((table) => table.name === "Main L")?.position).toBe("DOSL");
    expect(result.tables.find((table) => table.name === "Main R")?.position).toBe("DOSR");
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

  it("maps legacy LA4 units to the bundled LA4X planning component instead of dropping them", () => {
    const map: XmlpAmpMap = {
      units: [{ octet: 1, model: "LA4" }],
      groups: [{ name: "SIDE L", role: "source", members: [1] }],
    };

    const result = buildXmlpPowerTables(map, components);
    expect(rowFor(result, "Monitores", "LA4X")).toEqual(
      expect.objectContaining({ quantity: "1", watts: "750" }),
    );
    expect(result.warnings).toEqual([]);
  });
});
