import { describe, expect, it } from "vitest";

import { parseFlexPullsheetTransportXml } from "@/services/flexPullsheets";

describe("parseFlexPullsheetTransportXml", () => {
  it("reads normal equipment-list condensed records used by Pull Sheets", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <report>
        <condensedRecords>
          <record>
            <quantity>24</quantity>
            <description>K2</description>
            <itemBarcode>00160</itemBarcode>
            <itemLength>134</itemLength>
            <itemWidth>40</itemWidth>
            <itemHeight>35.4</itemHeight>
            <isVirtual>false</isVirtual>
            <noteText>Main PA</noteText>
          </record>
          <record>
            <quantity>1</quantity>
            <description>Material de Sonido</description>
            <isVirtual>true</isVirtual>
          </record>
        </condensedRecords>
      </report>`;

    expect(parseFlexPullsheetTransportXml(xml)).toEqual([
      {
        description: "K2",
        quantity: 24,
        itemBarcode: "00160",
        itemLengthCm: 134,
        itemWidthCm: 40,
        itemHeightCm: 35.4,
        noteText: "Main PA",
        isVirtual: false,
      },
      {
        description: "Material de Sonido",
        quantity: 1,
        itemBarcode: null,
        itemLengthCm: null,
        itemWidthCm: null,
        itemHeightCm: null,
        noteText: null,
        isVirtual: true,
      },
    ]);
  });

  it("supports comma decimals and top-level condensedRecord variants", () => {
    const xml = `<report>
      <condensedRecord>
        <quantity>2</quantity>
        <description>Rack</description>
        <itemLength>60,5</itemLength>
        <itemWidth>50</itemWidth>
        <itemHeight>90</itemHeight>
      </condensedRecord>
    </report>`;

    expect(parseFlexPullsheetTransportXml(xml)[0]).toMatchObject({
      quantity: 2,
      itemLengthCm: 60.5,
      itemWidthCm: 50,
      itemHeightCm: 90,
      isVirtual: false,
    });
  });

  it("rejects malformed producer XML instead of silently returning an empty plan", () => {
    expect(() => parseFlexPullsheetTransportXml("<report><record>")).toThrow(
      "Flex equipment-list producer returned invalid XML",
    );
  });
});
