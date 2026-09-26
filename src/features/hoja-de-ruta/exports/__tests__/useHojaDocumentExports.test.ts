import { describe, expect, it } from "vitest";

import { getHojaPublishBlockReason } from "@/features/hoja-de-ruta/exports/useHojaDocumentExports";

describe("getHojaPublishBlockReason", () => {
  it("blocks publication when the editor knows its version is stale", () => {
    expect(getHojaPublishBlockReason(true, "approved")).toBe("conflict");
    expect(getHojaPublishBlockReason(true, "final")).toBe("conflict");
  });

  it("allows only conflict-free approved or final versions", () => {
    expect(getHojaPublishBlockReason(false, "draft")).toBe("status");
    expect(getHojaPublishBlockReason(false, "review")).toBe("status");
    expect(getHojaPublishBlockReason(false, "approved")).toBeNull();
    expect(getHojaPublishBlockReason(false, "final")).toBeNull();
  });
});
