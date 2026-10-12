import { describe, expect, it } from "vitest";
import { decodeFlexPdf, headerText, isPublishableStatus, manifestReportUrl, manifestStatusId, soundManifestFileName } from "./manifest";

const prepared = "70b2de6c-aee8-11df-b8d5-00e08175e43e";
const shipped = "4dc8c4ec-aee9-11df-b8d5-00e08175e43e";
const id = "58db6132-8762-483b-a290-c6741f0f5c35";

describe("Sound manifest contracts in ordinary CI", () => {
  it("accepts only the manifest's own allowed status ID", () => {
    for (const status of [prepared, shipped, shipped.toUpperCase()]) expect(isPublishableStatus(status)).toBe(true);
    for (const status of [null, undefined, "Preparado", id, {}, ""]) expect(isPublishableStatus(status)).toBe(false);
    expect(manifestStatusId({ statusId: { data: { id: shipped, name: "Enviado" } } })).toBe(shipped);
    for (const header of [null, [], { unrelated: { statusId: prepared } }, { statusId: { data: { name: "Preparado" } } }, { statusId: "Preparado" }]) {
      expect(manifestStatusId(header)).toBeNull();
    }
  });

  it("uses the manifest and element view in the report URL", () => {
    const url = new URL(manifestReportUrl(id));
    expect(url.searchParams.get("PROJECT_ELEMENT_ID")).toBe(id);
    expect(url.searchParams.get("ELEMENT_VIEW_ID")).toBe("54110f73-c28a-11f1-bdc7-02e7c1b689d7");
    expect(url.searchParams.has("DOCUMENT_VIEW_ID")).toBe(false);
    expect(url.searchParams.get("REPORT_TIME_ZONE")).toBe("Europe/Madrid");
    expect(() => manifestReportUrl("../another-job")).toThrow();
  });

  it("preserves ordinary letters and digits while sanitizing filenames", () => {
    expect(soundManifestFileName({ jobTitle: "Concierto:\tMadrid / Sala\u0000", startTime: "2026-10-12T18:00:00Z", manifestId: id, documentNumber: "MS/0042" }))
      .toBe("Manifiesto de salida - Sonido - 2026-10-12 - Concierto Madrid Sala - MS 0042 - 58db6132.pdf");
    expect(headerText({ data: { displayString: "MS-0042" } })).toBe("MS-0042");
    expect(headerText({ data: {} })).toBeNull();
  });

  it("decodes binary and line-wrapped base64 PDFs and rejects non-PDF bodies", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");
    expect(decodeFlexPdf(pdf)).toEqual(pdf);
    const base64 = btoa(new TextDecoder().decode(pdf));
    expect(decodeFlexPdf(new TextEncoder().encode(base64))).toEqual(pdf);
    expect(decodeFlexPdf(new TextEncoder().encode(`${base64.slice(0, 8)}\r\n${base64.slice(8)}`))).toEqual(pdf);
    for (const body of ["<html>error</html>", btoa("not a PDF"), "abc\\n"]) {
      expect(() => decodeFlexPdf(new TextEncoder().encode(body))).toThrow();
    }
  });

  it.each([
    ["2026-10-11T22:30:00Z", "2026-10-12"],
    ["2026-12-11T23:30:00Z", "2026-12-12"],
    ["2026-10-11T21:30:00Z", "2026-10-11"],
    ["invalid", "sin-fecha"],
  ])("names %s using the Madrid calendar date", (startTime, date) => {
    expect(soundManifestFileName({ jobTitle: "Evento", startTime, manifestId: id })).toContain(`Sonido - ${date} - Evento`);
  });
});
