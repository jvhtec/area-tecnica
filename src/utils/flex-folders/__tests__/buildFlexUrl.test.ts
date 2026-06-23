import { beforeEach, describe, expect, it, vi } from "vitest";

import { flexApiFetch } from "@/lib/flex-api-client";
import {
  buildFlexUrl,
  buildFlexUrlWithTypeDetection,
  getElementDetails,
  isFinancialDocument,
  isSimpleFolder,
} from "../buildFlexUrl";
import { FLEX_FOLDER_IDS } from "../constants";
import { FLEX_CONFIG } from "../config";

vi.mock("@/lib/flex-api-client", () => ({
  flexApiFetch: vi.fn(),
}));

function proxyResponse(ok: boolean, data: unknown, statusText = "") {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(""),
  };
}

describe("buildFlexUrl", () => {
  it("builds financial document URLs", () => {
    expect(buildFlexUrl("id", FLEX_FOLDER_IDS.presupuesto)).toContain(
      `#fin-doc/id/doc-view/${FLEX_CONFIG.viewIds.presupuesto}/detail`,
    );
    expect(buildFlexUrl("id", FLEX_FOLDER_IDS.hojaGastos)).toContain(
      `#fin-doc/id/doc-view/${FLEX_CONFIG.viewIds.expenseSheet}/detail`,
    );
  });

  it("builds crew, equipment and simple element URLs", () => {
    expect(buildFlexUrl("id", FLEX_FOLDER_IDS.crewCall)).toContain(
      `#contact-list/id/view/${FLEX_CONFIG.viewIds.crewCall}/detail`,
    );
    expect(buildFlexUrl("id", FLEX_FOLDER_IDS.pullSheet)).toContain(
      "#element/id/view/equipment-list/detail",
    );
    expect(buildFlexUrl("id", FLEX_FOLDER_IDS.mainFolder)).toContain(
      "#element/id/view/simple-element/detail",
    );
  });

  it.each([[""], ["   "], [null], [undefined]])(
    "rejects invalid element IDs",
    (elementId) => {
      expect(() => buildFlexUrl(elementId as string)).toThrow("Invalid elementId");
    },
  );
});

describe("intent helpers", () => {
  it("classifies financial documents", () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.presupuesto)).toBe(true);
    expect(isFinancialDocument(FLEX_FOLDER_IDS.mainFolder)).toBe(false);
    expect(isFinancialDocument(undefined)).toBe(false);
  });

  it("classifies simple folders", () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.mainFolder)).toBe(true);
    expect(isSimpleFolder(FLEX_FOLDER_IDS.presupuesto)).toBe(false);
    expect(isSimpleFolder(undefined)).toBe(false);
  });
});

describe("server-side type detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches element metadata through the Flex proxy", async () => {
    vi.mocked(flexApiFetch).mockResolvedValue(
      proxyResponse(true, {
        elementDefinitionId: { data: "definition-id" },
        name: { data: "Test Element" },
        documentNumber: { data: "DOC-123" },
      }),
    );

    await expect(getElementDetails("element-id")).resolves.toEqual({
      elementId: "element-id",
      definitionId: "definition-id",
      name: "Test Element",
      documentNumber: "DOC-123",
    });
    expect(flexApiFetch).toHaveBeenCalledWith(
      "/element/element-id/key-info/",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("falls back safely when metadata cannot be fetched", async () => {
    vi.mocked(flexApiFetch).mockRejectedValue(new Error("proxy unavailable"));
    await expect(getElementDetails("element-id")).resolves.toEqual({
      elementId: "element-id",
    });
  });

  it("uses strong local context without a network call", async () => {
    await expect(
      buildFlexUrlWithTypeDetection("element-id", {
        definitionId: FLEX_FOLDER_IDS.presupuesto,
      }),
    ).resolves.toContain("#fin-doc/element-id/doc-view/");

    await expect(
      buildFlexUrlWithTypeDetection("element-id", { jobType: "dryhire" }),
    ).resolves.toContain("#element/element-id/view/simple-element/detail");

    await expect(
      buildFlexUrlWithTypeDetection("element-id", {
        viewHint: "equipment-list",
      }),
    ).resolves.toContain("#element/element-id/view/equipment-list/detail");

    expect(flexApiFetch).not.toHaveBeenCalled();
  });

  it("uses proxied metadata when context is ambiguous", async () => {
    vi.mocked(flexApiFetch).mockResolvedValue(
      proxyResponse(true, {
        elementDefinitionId: { data: FLEX_FOLDER_IDS.presupuesto },
      }),
    );

    await expect(
      buildFlexUrlWithTypeDetection("element-id"),
    ).resolves.toContain("#fin-doc/element-id/doc-view/");
  });

  it("rejects invalid IDs before making a request", async () => {
    await expect(buildFlexUrlWithTypeDetection("")).rejects.toThrow(
      "Invalid elementId",
    );
    expect(flexApiFetch).not.toHaveBeenCalled();
  });
});
