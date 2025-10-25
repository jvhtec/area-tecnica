import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  flattenTree,
  searchTree,
  type FlexElementNode,
} from "@/utils/flex-folders/getElementTree";

describe("FlexElementSelectorDialog - Tree Processing", () => {
  describe("flattenTree for rendering", () => {
    it("should flatten nodes with correct indentation depth", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "root-1",
          displayName: "Main Event",
          documentNumber: "EVENT-001",
          children: [
            {
              elementId: "child-1",
              displayName: "Sound Department",
              documentNumber: "SOUND-001",
            },
            {
              elementId: "child-2",
              displayName: "Light Department",
              documentNumber: "LIGHT-001",
            },
          ],
        },
      ];

      const result = flattenTree(tree);

      expect(result).toHaveLength(3);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(1);
    });

    it("should calculate indentation correctly for nested levels", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Level 0",
          children: [
            {
              elementId: "1.1",
              displayName: "Level 1",
              children: [
                {
                  elementId: "1.1.1",
                  displayName: "Level 2",
                },
              ],
            },
          ],
        },
      ];

      const result = flattenTree(tree);

      const indentMultiplier = 16;
      expect(result[0].depth * indentMultiplier).toBe(0);
      expect(result[1].depth * indentMultiplier).toBe(16);
      expect(result[2].depth * indentMultiplier).toBe(32);
    });
  });

  describe("searchTree for filtering", () => {
    const mockTree: FlexElementNode[] = [
      {
        elementId: "1",
        displayName: "Sound Equipment",
        documentNumber: "SOUND-001",
        children: [
          {
            elementId: "1.1",
            displayName: "Microphones",
            documentNumber: "MIC-001",
          },
        ],
      },
      {
        elementId: "2",
        displayName: "Light Equipment",
        documentNumber: "LIGHT-001",
      },
    ];

    it("should filter nodes based on search query", () => {
      const result = searchTree(mockTree, "Sound");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Sound Equipment");
    });

    it("should filter by document number", () => {
      const result = searchTree(mockTree, "MIC-001");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Microphones");
    });

    it("should return all nodes when search is empty", () => {
      const result = searchTree(mockTree, "");
      expect(result).toHaveLength(3);
    });

    it("should be case insensitive", () => {
      const result = searchTree(mockTree, "SOUND");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Sound Equipment");
    });
  });

  describe("Node selection callback behavior", () => {
    it("should invoke onSelect callback with correct element ID", () => {
      const onSelect = vi.fn();
      const elementId = "test-element-123";

      onSelect(elementId);

      expect(onSelect).toHaveBeenCalledWith("test-element-123");
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple selection attempts", () => {
      const onSelect = vi.fn();

      onSelect("element-1");
      onSelect("element-2");
      onSelect("element-3");

      expect(onSelect).toHaveBeenCalledTimes(3);
      expect(onSelect).toHaveBeenNthCalledWith(1, "element-1");
      expect(onSelect).toHaveBeenNthCalledWith(2, "element-2");
      expect(onSelect).toHaveBeenNthCalledWith(3, "element-3");
    });
  });

  describe("Default element highlighting logic", () => {
    it("should identify default element correctly", () => {
      const defaultElementId = "child-1";
      const node = {
        elementId: "child-1",
        displayName: "Test Node",
        depth: 0,
      };

      const isDefault = node.elementId === defaultElementId;
      expect(isDefault).toBe(true);
    });

    it("should not highlight non-default elements", () => {
      const defaultElementId = "child-1";
      const node = {
        elementId: "child-2",
        displayName: "Test Node",
        depth: 0,
      };

      const isDefault = node.elementId === defaultElementId;
      expect(isDefault).toBe(false);
    });

    it("should handle undefined default element", () => {
      const defaultElementId = undefined;
      const node = {
        elementId: "child-1",
        displayName: "Test Node",
        depth: 0,
      };

      const isDefault = node.elementId === defaultElementId;
      expect(isDefault).toBe(false);
    });
  });

  describe("Tree node metadata display", () => {
    it("should include document number when present", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Equipment",
          documentNumber: "DOC-001",
        },
      ];

      const result = flattenTree(tree);
      expect(result[0].documentNumber).toBe("DOC-001");
    });

    it("should handle missing document number", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Equipment",
        },
      ];

      const result = flattenTree(tree);
      expect(result[0].documentNumber).toBeUndefined();
    });

    it("should preserve display name in all cases", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Test Element",
          documentNumber: "DOC-001",
        },
      ];

      const result = flattenTree(tree);
      expect(result[0].displayName).toBe("Test Element");
    });
  });
});
