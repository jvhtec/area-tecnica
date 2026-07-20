import { describe, expect, it } from "vitest";

import { parseNwmXml, parseSoundvisionFlysheet, parseXmlpXml } from "./parse.ts";

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

const soundvisionProject = `<project name="Gira &amp; Festival.xmlp">
  <physical_configuration name="PA principal">
    <cluster name="MAIN L">
      <deployment_orientation>flown</deployment_orientation>
      <azimuth>12.5</azimuth>
      <top_height>11.2</top_height>
      <bottom_height>4.35</bottom_height>
      <top_site>-2.5</top_site>
      <bottom_site>-24.5</bottom_site>
      <total_mass>1180.6</total_mass>
      <front_load>640.2</front_load>
      <rear_load>540.4</rear_load>
      <rigging_element type="K2-BUMP">
        <bar_hole>A</bar_hole>
        <motor_configuration><front>5</front><rear>21</rear></motor_configuration>
      </rigging_element>
      <elements>
        <element type="K2"><site>-2.5</site><z>11.2</z></element>
        <element type="K2"><site>-7.5</site><z>9.8</z></element>
        <element type="K2"><site>-17.5</site><z>7.1</z></element>
        <element type="K2"><site>-24.5</site><z>4.35</z></element>
      </elements>
      <connection_sets><connection_set><inter_angles>
        <angle>5</angle><angle>10</angle><angle>0.25</angle>
      </inter_angles></connection_set></connection_sets>
      <mechanical_warning>Factor de seguridad por debajo del mínimo.</mechanical_warning>
    </cluster>
    <Cluster name="SUB L" deployment="stacked_cardioid" azimuth="0">
      <rigging_element><type>KS28-OUTRIG</type></rigging_element>
      <elements>
        <enclosure model="KS28" splay="0" />
        <enclosure model="KS28" splay="0" />
      </elements>
    </Cluster>
  </physical_configuration>
</project>`;

describe("parseSoundvisionFlysheet", () => {
  it("extracts Spanish-flysheet deployment data without calculating missing mechanics", () => {
    const flysheet = parseSoundvisionFlysheet(soundvisionProject);

    expect(flysheet.projectName).toBe("Gira & Festival");
    expect(flysheet.arrays).toHaveLength(2);
    expect(flysheet.arrays[0]).toMatchObject({
      groupName: "PA principal",
      arrayName: "MAIN L",
      deployment: "flown",
      azimuthDegrees: 12.5,
      topHeightMeters: 11.2,
      bottomHeightMeters: 4.35,
      riggingFrame: "K2-BUMP",
      flyingBarSetting: "Orificio A",
      pickupConfiguration: "F: 5 / R: 21",
      totalMassKg: 1180.6,
      frontLoadKg: 640.2,
      rearLoadKg: 540.4,
      warnings: ["Factor de seguridad por debajo del mínimo."],
    });
    expect(flysheet.arrays[0].enclosures).toEqual([
      { model: "K2", splayAngleDegrees: 5, siteAngleDegrees: -2.5, trimHeightMeters: 11.2 },
      { model: "K2", splayAngleDegrees: 10, siteAngleDegrees: -7.5, trimHeightMeters: 9.8 },
      { model: "K2", splayAngleDegrees: 0.25, siteAngleDegrees: -17.5, trimHeightMeters: 7.1 },
      { model: "K2", splayAngleDegrees: null, siteAngleDegrees: -24.5, trimHeightMeters: 4.35 },
    ]);
    expect(flysheet.arrays[1]).toMatchObject({
      arrayName: "SUB L",
      deployment: "stacked",
      azimuthDegrees: 0,
      riggingFrame: "KS28-OUTRIG",
      flyingBarSetting: "",
      totalMassKg: null,
      frontLoadKg: null,
      rearLoadKg: null,
    });
    expect(flysheet.arrays[1].enclosures).toEqual([
      { model: "KS28", splayAngleDegrees: 0, siteAngleDegrees: null, trimHeightMeters: null },
      { model: "KS28", splayAngleDegrees: 0, siteAngleDegrees: null, trimHeightMeters: null },
    ]);
  });

  it("returns no arrays for XMLP projects without serialized clusters", () => {
    expect(parseSoundvisionFlysheet("<project name=\"Sala\"><scene /></project>")).toEqual({
      projectName: "Sala",
      arrays: [],
    });
  });

  it("handles the nested physical-configuration shape and flying-bar variants from Soundvision", () => {
    const realShape = `<project><physical_configuration><children>
      <cluster><name>K2 simple</name><configuration>vertical_flown</configuration>
        <rigging_element_index>0</rigging_element_index><elements>
          <rigging_element><model>K2-BUMP_HoleA_1xK2-BAR</model><configuration>flown</configuration></rigging_element>
          <enclosure><model>K2</model><physical_configuration>55/55</physical_configuration></enclosure>
          <enclosure><model>K2</model><physical_configuration>55/55</physical_configuration></enclosure>
        </elements><inter_angles><angle></angle><angle>0</angle><angle>0.25</angle></inter_angles>
        <motor_positions>0 20</motor_positions><position>0 10 8</position><orientation>0 0 12</orientation>
      </cluster>
      <cluster><name>K2 doble</name><configuration>vertical_flown</configuration><elements>
        <rigging_element><model>K2-BUMP_HoleA_2xK2-BAR</model></rigging_element>
        <enclosure><model>K2</model></enclosure>
      </elements><inter_angles><angle></angle><angle>0</angle></inter_angles>
      <motor_positions>10 31</motor_positions><position>-2 10 9</position><orientation>6.5 0 0</orientation></cluster>
      <cluster><name>K2 invertido</name><configuration>vertical_flown</configuration><elements>
        <rigging_element><model>K2-BUMP_HoleA_1xK2-BAR_Inv</model></rigging_element>
        <enclosure><model>K2</model></enclosure>
      </elements><inter_angles><angle></angle><angle>0</angle></inter_angles>
      <motor_positions>20 0</motor_positions></cluster>
    </children></physical_configuration></project>`;

    const flysheet = parseSoundvisionFlysheet(realShape, "muestra.xmlp");

    expect(flysheet.projectName).toBe("muestra");
    expect(flysheet.arrays).toHaveLength(3);
    expect(flysheet.arrays[0]).toMatchObject({
      arrayName: "K2 simple",
      deployment: "flown",
      azimuthDegrees: 12,
      topSiteDegrees: 0,
      bottomSiteDegrees: -0.25,
      topHeightMeters: 8,
      riggingFrame: "K2-BUMP",
      flyingBarSetting: "1x K2-BAR · Orificio A",
      pickupConfiguration: "Posiciones: 0 / 20",
    });
    expect(flysheet.arrays.map((array) => array.flyingBarSetting)).toEqual([
      "1x K2-BAR · Orificio A",
      "2x K2-BAR · Orificio A",
      "1x K2-BAR · Orificio A · Invertido",
    ]);
  });

  it("keeps arrays from mixed nested and flat physical configurations", () => {
    const mixedShape = `<project name="Mixed configurations">
      <physical_configuration name="Main"><children>
        <cluster name="K2 L"><elements>
          <rigging_element model="K2-BUMP" />
          <enclosure model="K2" />
        </elements></cluster>
      </children></physical_configuration>
      <physical_configuration name="Out">
        <cluster name="Out L"><elements>
          <rigging_element model="KARA-MINIBU" />
          <enclosure model="KARA II 90" />
        </elements></cluster>
        <cluster name="Out R"><elements>
          <rigging_element model="KARA-MINIBU" />
          <enclosure model="KARA II 90" />
        </elements></cluster>
      </physical_configuration>
    </project>`;

    const flysheet = parseSoundvisionFlysheet(mixedShape);

    expect(flysheet.arrays.map((array) => ({
      groupName: array.groupName,
      arrayName: array.arrayName,
    }))).toEqual([
      { groupName: "Main", arrayName: "K2 L" },
      { groupName: "Out", arrayName: "Out L" },
      { groupName: "Out", arrayName: "Out R" },
    ]);
  });

  it("attaches flysheet data to the existing XMLP amplifier map", () => {
    const xml = soundvisionProject.replace(
      "</project>",
      `<physical_configuration><amplification><units>
        <unit><model>LA12X</model><ip>11</ip><channelSet><preset>K2 110</preset></channelSet></unit>
      </units></amplification></physical_configuration>
      <nwm_session><LAGROUP Name="MAIN L" role="source"><unit unitIp="11" /></LAGROUP></nwm_session>
      </project>`,
    );
    const map = parseXmlpXml(xml, "fallback.xmlp");

    expect(map.units).toHaveLength(1);
    expect(map.flysheet?.arrays.map((array) => array.arrayName)).toEqual(["MAIN L", "SUB L"]);
  });
});
