import { describe, expect, it } from "vitest";
import { findQuoteEquipmentListCandidates, isPullSheetKeyInfo } from "./discovery";

const eventId = "10000000-0000-4000-8000-000000000001";
const quoteId = "20000000-0000-4000-8000-000000000002";
const sheetId = "a0000000-0000-4000-8000-000000000003";
const lightsId = "40000000-0000-4000-8000-000000000004";
const structureId = "50000000-0000-4000-8000-000000000005";
const shipId = "60000000-0000-4000-8000-000000000006";
const definitionId = "a220432c-af33-11df-b8d5-00e08175e43e";

function equipment(nodeId = sheetId, overrides: Record<string, unknown> = {}) {
  return { nodeId, parentId: quoteId, domainId: "equipment-list", ...overrides };
}

function quote(children: unknown[] = [equipment()], overrides: Record<string, unknown> = {}) {
  return { nodeId: quoteId, parentId: eventId, domainId: "financial-document", children, ...overrides };
}

describe("quote equipment-list discovery", () => {
  it.each(["object", "array"])("scopes a GSTQ-like whole-event %s response to the requested quote", (shape) => {
    const event = {
      nodeId: eventId,
      children: [
        { nodeId: lightsId, name: "GSTQ Luces", children: [equipment(lightsId, { parentId: lightsId })] },
        quote([equipment(sheetId, { name: "Unrelated label", definitionId: "not-authoritative-in-tree" })], { name: "GSTQ Sonido" }),
        { nodeId: structureId, name: "GSTQ Estructura", children: [equipment(structureId, { parentId: structureId })] },
        equipment(shipId, { name: "GSTQ Sonido Pull Sheet" }), // Even a matching parent elsewhere is insufficient.
      ],
    };
    expect(findQuoteEquipmentListCandidates(shape === "array" ? [event] : event, quoteId)).toEqual([sheetId]);
  });

  it("accepts a quote-root response and deduplicates UUID candidates", () => {
    expect(findQuoteEquipmentListCandidates(quote([equipment(), equipment(), equipment(sheetId.toUpperCase())]), quoteId))
      .toEqual([sheetId]);
  });

  it("fails closed for missing, deleted, or duplicate quote roots", () => {
    for (const tree of [null, [], {}, { children: [equipment()] }, quote(undefined, { deleted: true }),
      [quote(), quote()], { nodeId: eventId, children: [quote(), { children: [quote()] }] },
      quote([{ ...quote(), parentId: quoteId }])]) {
      expect(findQuoteEquipmentListCandidates(tree, quoteId)).toEqual([]);
    }
    expect(findQuoteEquipmentListCandidates([quote(undefined, { deleted: true }), quote()], quoteId)).toEqual([sheetId]);
  });

  it("rejects deleted children, wrong or missing parents, invalid IDs, and other domains", () => {
    const invalidChildren = [
      equipment(sheetId, { deleted: true }), equipment(sheetId, { parentId: eventId }),
      equipment(sheetId, { parentId: undefined }), equipment("invalid"), equipment(` ${sheetId}`),
      equipment(sheetId, { nodeId: 42 }), equipment(sheetId, { domainId: "folder" }),
      equipment(sheetId, { domainId: undefined, name: "Pull Sheet Sonido" }), null, [equipment()],
    ];
    expect(findQuoteEquipmentListCandidates(quote(invalidChildren), quoteId)).toEqual([]);
  });

  it("prunes deleted ancestors before locating or counting quote roots", () => {
    const deletedBranch = { nodeId: lightsId, deleted: true, children: [{ children: [quote()] }] };
    expect(findQuoteEquipmentListCandidates({ nodeId: eventId, children: [deletedBranch] }, quoteId)).toEqual([]);
    expect(findQuoteEquipmentListCandidates({ nodeId: eventId, children: [deletedBranch, quote()] }, quoteId))
      .toEqual([sheetId]);
    expect(findQuoteEquipmentListCandidates({ nodeId: eventId, deleted: true, children: [quote()] }, quoteId))
      .toEqual([]);
  });

  it("excludes grandchildren, including ship manifests, without reading candidate descendants", () => {
    const candidate = equipment();
    Object.defineProperty(candidate, "children", {
      get() { throw new Error("Candidate descendants must not be inspected"); },
    });
    expect(findQuoteEquipmentListCandidates(quote([
      candidate,
      { nodeId: lightsId, domainId: "folder", children: [equipment(shipId)] },
    ]), quoteId)).toEqual([sheetId]);
    expect(findQuoteEquipmentListCandidates(quote([equipment(sheetId, {
      children: [equipment(shipId, { parentId: sheetId, isManifest: true })],
    })]), quoteId)).toEqual([sheetId]);
  });

  it("rejects invalid quote IDs and arbitrary response wrappers", () => {
    for (const id of ["", "not-a-uuid", ` ${quoteId}`, `${quoteId}/tree`]) {
      expect(findQuoteEquipmentListCandidates(quote(), id)).toEqual([]);
    }
    expect(findQuoteEquipmentListCandidates({ data: quote() }, quoteId)).toEqual([]);
    expect(findQuoteEquipmentListCandidates(quote([], { children: { data: [equipment()] } }), quoteId)).toEqual([]);
  });
});

describe("pull sheet key-info verification", () => {
  const info = { elementId: sheetId, definitionId, isManifest: false, deleted: false };

  it("accepts only the expected element's pull sheet definition", () => {
    expect(isPullSheetKeyInfo(info, sheetId)).toBe(true);
    expect(isPullSheetKeyInfo({ ...info, isManifest: false, deleted: false }, sheetId)).toBe(true);
    expect(isPullSheetKeyInfo({ ...info, elementId: sheetId.toUpperCase(), definitionId: definitionId.toUpperCase() }, sheetId))
      .toBe(true);
  });

  it("rejects manifests, wrong elements or definitions, and deleted elements", () => {
    for (const value of [
      { ...info, isManifest: true }, { ...info, deleted: true }, { ...info, elementId: shipId },
      { ...info, isManifest: undefined }, { ...info, isManifest: null }, { ...info, isManifest: "true" },
      { ...info, deleted: undefined }, { ...info, deleted: null }, { ...info, deleted: "true" },
      { ...info, definitionId: shipId }, { ...info, elementId: "invalid" },
      { ...info, elementId: undefined }, { ...info, definitionId: undefined },
      { ...info, definitionId: { id: definitionId } }, { ...info, elementId: { data: sheetId } },
    ]) expect(isPullSheetKeyInfo(value, sheetId)).toBe(false);
    expect(isPullSheetKeyInfo(info, "invalid")).toBe(false);
  });

  it("rejects wrappers, aliases, inherited identities, and display labels", () => {
    for (const value of [null, [], [info], { data: info }, { unrelated: info },
      { id: sheetId, definitionId }, { elementId: sheetId, definition: { id: definitionId } },
      { elementId: sheetId, name: "Pull Sheet", definitionName: "Sonido" }, Object.create(info)]) {
      expect(isPullSheetKeyInfo(value, sheetId)).toBe(false);
    }
  });
});
