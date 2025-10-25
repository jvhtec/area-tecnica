import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getElementTree, ElementTreeNode } from "./apiService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

global.fetch = vi.fn();

describe("getElementTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw error when auth token retrieval fails", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { X_AUTH_TOKEN: null },
      error: { message: "Failed to get secret" },
    });

    await expect(getElementTree("test-element-id")).rejects.toThrow(
      "Failed to get auth token"
    );
  });

  it("should fetch element tree successfully with happy path data", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    const mockTreeData: ElementTreeNode[] = [
      {
        nodeId: "1",
        name: "Root Element",
        displayName: "Root Element",
        documentNumber: "DOC-001",
        parentId: null,
        iconUrl: "https://example.com/icon.png",
        leaf: false,
        children: [
          {
            nodeId: "1.1",
            name: "Child Element",
            displayName: "Child Element",
            documentNumber: "DOC-002",
            parentId: "1",
            iconUrl: "https://example.com/child-icon.png",
            leaf: true,
          },
        ],
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockTreeData,
    } as Response);

    const result = await getElementTree("test-element-id");

    expect(result).toEqual(mockTreeData);
    expect(fetch).toHaveBeenCalledWith(
      "https://sectorpro.flexrentalsolutions.com/f5/api/element/test-element-id/tree",
      {
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": "test-token",
        },
      }
    );
  });

  it("should return empty array when API returns non-array data", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    const mockNonArrayData = {
      message: "Unexpected format",
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockNonArrayData,
    } as Response);

    const result = await getElementTree("test-element-id");

    expect(result).toEqual([]);
  });

  it("should handle empty tree response", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);

    const result = await getElementTree("test-element-id");

    expect(result).toEqual([]);
  });

  it("should throw error on 404 response", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
    } as Response);

    await expect(getElementTree("invalid-element-id")).rejects.toThrow(
      "Failed to fetch element tree for element ID invalid-element-id: Not Found (404)"
    );
  });

  it("should throw error on 500 response", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    } as Response);

    await expect(getElementTree("test-element-id")).rejects.toThrow(
      "Failed to fetch element tree for element ID test-element-id: Internal Server Error (500)"
    );
  });

  it("should throw error on 401 unauthorized response", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    } as Response);

    await expect(getElementTree("test-element-id")).rejects.toThrow(
      "Failed to fetch element tree for element ID test-element-id: Unauthorized (401)"
    );
  });

  it("should handle network errors gracefully", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    await expect(getElementTree("test-element-id")).rejects.toThrow(
      "Network error"
    );
  });

  it("should handle complex nested tree structures", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    const mockComplexTree: ElementTreeNode[] = [
      {
        nodeId: "root",
        name: "Root",
        displayName: "Root Element",
        documentNumber: "ROOT-001",
        parentId: null,
        leaf: false,
        children: [
          {
            nodeId: "child1",
            name: "Child 1",
            displayName: "Child 1",
            documentNumber: "CHILD-001",
            parentId: "root",
            leaf: false,
            children: [
              {
                nodeId: "grandchild1",
                name: "Grandchild 1",
                displayName: "Grandchild 1",
                documentNumber: "GC-001",
                parentId: "child1",
                leaf: true,
              },
            ],
          },
          {
            nodeId: "child2",
            name: "Child 2",
            displayName: "Child 2",
            documentNumber: "CHILD-002",
            parentId: "root",
            leaf: true,
          },
        ],
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockComplexTree,
    } as Response);

    const result = await getElementTree("root-element-id");

    expect(result).toEqual(mockComplexTree);
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].children).toHaveLength(1);
  });

  it("should make multiple fetch calls with the same auth token", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { X_AUTH_TOKEN: "test-token" },
      error: null,
    });
    
    const mockTreeData: ElementTreeNode[] = [
      {
        nodeId: "1",
        name: "Element",
        displayName: "Element",
        leaf: true,
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTreeData,
    } as Response);

    const result1 = await getElementTree("element-1");
    const result2 = await getElementTree("element-2");

    expect(result1).toEqual(mockTreeData);
    expect(result2).toEqual(mockTreeData);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://sectorpro.flexrentalsolutions.com/f5/api/element/element-1/tree",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Auth-Token": "test-token",
        }),
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://sectorpro.flexrentalsolutions.com/f5/api/element/element-2/tree",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Auth-Token": "test-token",
        }),
      })
    );
  });
});
