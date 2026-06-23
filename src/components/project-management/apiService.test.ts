import { beforeEach, describe, expect, it, vi } from "vitest";

import { flexApiFetch } from "@/lib/flex-api-client";
import { getElementTree, type ElementTreeNode } from "./apiService";

vi.mock("@/lib/flex-api-client", () => ({
  flexApiFetch: vi.fn(),
}));

function proxyResponse(options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  data?: unknown;
}) {
  return {
    ok: options.ok,
    status: options.status ?? 200,
    statusText: options.statusText ?? "",
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(options.data),
    text: vi.fn().mockResolvedValue(""),
  };
}

describe("getElementTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches an element tree through the server-side proxy", async () => {
    const tree: ElementTreeNode[] = [
      {
        nodeId: "root",
        name: "Root",
        displayName: "Root",
        leaf: false,
        children: [],
      },
    ];
    vi.mocked(flexApiFetch).mockResolvedValue(
      proxyResponse({ ok: true, data: tree }),
    );

    await expect(getElementTree("test-element-id")).resolves.toEqual(tree);
    expect(flexApiFetch).toHaveBeenCalledWith(
      "/element/test-element-id/tree",
      { headers: { "Content-Type": "application/json" } },
    );
  });

  it("returns an empty array for an unexpected payload", async () => {
    vi.mocked(flexApiFetch).mockResolvedValue(
      proxyResponse({ ok: true, data: { unexpected: true } }),
    );

    await expect(getElementTree("test-element-id")).resolves.toEqual([]);
  });

  it("surfaces an upstream error without exposing credentials", async () => {
    vi.mocked(flexApiFetch).mockResolvedValue(
      proxyResponse({
        ok: false,
        status: 404,
        statusText: "Not Found",
        data: {},
      }),
    );

    await expect(getElementTree("missing")).rejects.toThrow(
      "Failed to fetch element tree for element ID missing: Not Found (404)",
    );
  });

  it("surfaces proxy network errors", async () => {
    vi.mocked(flexApiFetch).mockRejectedValue(new Error("Network error"));

    await expect(getElementTree("test-element-id")).rejects.toThrow(
      "Network error",
    );
  });
});
