import { describe, expect, it } from "vitest";

import { parseNwmXml } from "./parse.ts";

describe("parseNwmXml", () => {
  it("decodes XML entities once without double-unescaping literal entity text", () => {
    const map = parseNwmXml(
      '<Nwm2><COMPONENTS sessionName="A &amp; B &lt; C &amp;lt; literal" /></Nwm2>'
    );

    expect(map.sessionName).toBe("A & B < C &lt; literal");
  });

  it("identifies supported Network Manager controller models", () => {
    const xml = `<Nwm2><COMPONENTS sessionName="models">
      <LAVIRTUALUNIT ampIp="11" presetName="A" unitType="2" />
      <LAVIRTUALUNIT ampIp="12" presetName="B" unitType="4" />
      <LAVIRTUALUNIT ampIp="13" presetName="C" unitType="8" />
      <LAVIRTUALUNIT ampIp="14" presetName="D" unitType="16" />
    </COMPONENTS></Nwm2>`;

    expect(parseNwmXml(xml).units.map((unit) => unit.model)).toEqual([
      "LA8",
      "LA4",
      "LA12X",
      "LA4X",
    ]);
  });
});
