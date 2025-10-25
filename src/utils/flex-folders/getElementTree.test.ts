import { describe, it, expect } from "vitest";
import {
  flattenTree,
  searchTree,
  type FlexElementNode,
} from "./getElementTree";

describe("getElementTree utilities", () => {
  describe("flattenTree", () => {
    it("should flatten a single-level tree", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Element 1",
          documentNumber: "DOC-001",
        },
        {
          elementId: "2",
          displayName: "Element 2",
          documentNumber: "DOC-002",
        },
      ];

      const result = flattenTree(tree);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        elementId: "1",
        displayName: "Element 1",
        documentNumber: "DOC-001",
        parentElementId: undefined,
        depth: 0,
      });
      expect(result[1]).toEqual({
        elementId: "2",
        displayName: "Element 2",
        documentNumber: "DOC-002",
        parentElementId: undefined,
        depth: 0,
      });
    });

    it("should flatten a multi-level tree with correct depth", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Root",
          children: [
            {
              elementId: "1.1",
              displayName: "Child 1",
              children: [
                {
                  elementId: "1.1.1",
                  displayName: "Grandchild 1",
                },
              ],
            },
            {
              elementId: "1.2",
              displayName: "Child 2",
            },
          ],
        },
      ];

      const result = flattenTree(tree);

      expect(result).toHaveLength(4);
      expect(result[0].elementId).toBe("1");
      expect(result[0].depth).toBe(0);
      expect(result[1].elementId).toBe("1.1");
      expect(result[1].depth).toBe(1);
      expect(result[2].elementId).toBe("1.1.1");
      expect(result[2].depth).toBe(2);
      expect(result[3].elementId).toBe("1.2");
      expect(result[3].depth).toBe(1);
    });

    it("should handle empty tree", () => {
      const tree: FlexElementNode[] = [];
      const result = flattenTree(tree);
      expect(result).toHaveLength(0);
    });

    it("should preserve all node properties", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Test Element",
          documentNumber: "DOC-123",
          parentElementId: "parent-1",
        },
      ];

      const result = flattenTree(tree);

      expect(result[0]).toMatchObject({
        elementId: "1",
        displayName: "Test Element",
        documentNumber: "DOC-123",
        parentElementId: "parent-1",
      });
    });
  });

  describe("searchTree", () => {
    const sampleTree: FlexElementNode[] = [
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
          {
            elementId: "1.2",
            displayName: "Speakers",
            documentNumber: "SPK-001",
          },
        ],
      },
      {
        elementId: "2",
        displayName: "Light Equipment",
        documentNumber: "LIGHT-001",
        children: [
          {
            elementId: "2.1",
            displayName: "LED Panels",
            documentNumber: "LED-001",
          },
        ],
      },
    ];

    it("should return all nodes when query is empty", () => {
      const result = searchTree(sampleTree, "");
      expect(result).toHaveLength(5);
    });

    it("should return all nodes when query is whitespace only", () => {
      const result = searchTree(sampleTree, "   ");
      expect(result).toHaveLength(5);
    });

    it("should filter by display name (case insensitive)", () => {
      const result = searchTree(sampleTree, "sound");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Sound Equipment");
    });

    it("should filter by document number", () => {
      const result = searchTree(sampleTree, "MIC-001");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Microphones");
    });

    it("should filter by partial match", () => {
      const result = searchTree(sampleTree, "Equipment");
      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe("Sound Equipment");
      expect(result[1].displayName).toBe("Light Equipment");
    });

    it("should preserve depth information in search results", () => {
      const result = searchTree(sampleTree, "LED");
      expect(result).toHaveLength(1);
      expect(result[0].depth).toBe(1);
    });

    it("should return empty array when no matches found", () => {
      const result = searchTree(sampleTree, "NonExistent");
      expect(result).toHaveLength(0);
    });

    it("should match child nodes correctly", () => {
      const result = searchTree(sampleTree, "Microphones");
      expect(result).toHaveLength(1);
      expect(result[0].elementId).toBe("1.1");
      expect(result[0].depth).toBe(1);
    });

    it("should handle case insensitive search", () => {
      const result = searchTree(sampleTree, "SPEAKERS");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Speakers");
    });
  });

  describe("tree traversal edge cases", () => {
    it("should handle nodes without children property", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Node 1",
        },
      ];

      const result = flattenTree(tree);
      expect(result).toHaveLength(1);
    });

    it("should handle nodes with empty children array", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Node 1",
          children: [],
        },
      ];

      const result = flattenTree(tree);
      expect(result).toHaveLength(1);
    });

    it("should handle deep nesting correctly", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Level 0",
          children: [
            {
              elementId: "2",
              displayName: "Level 1",
              children: [
                {
                  elementId: "3",
                  displayName: "Level 2",
                  children: [
                    {
                      elementId: "4",
                      displayName: "Level 3",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = flattenTree(tree);
      expect(result).toHaveLength(4);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(2);
      expect(result[3].depth).toBe(3);
    });

    it("should handle multiple siblings at different depths", () => {
      const tree: FlexElementNode[] = [
        {
          elementId: "1",
          displayName: "Parent 1",
          children: [
            { elementId: "1.1", displayName: "Child 1.1" },
            { elementId: "1.2", displayName: "Child 1.2" },
          ],
        },
        {
          elementId: "2",
          displayName: "Parent 2",
          children: [
            { elementId: "2.1", displayName: "Child 2.1" },
          ],
        },
      ];

      const result = flattenTree(tree);
      expect(result).toHaveLength(5);
      expect(result.filter((n) => n.depth === 0)).toHaveLength(2);
      expect(result.filter((n) => n.depth === 1)).toHaveLength(3);
    });
  });
});
