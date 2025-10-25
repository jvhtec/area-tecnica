import { describe, it, expect } from "vitest";
import {
  flattenTree,
  searchTree,
  filterTreeWithAncestors,
  createTourdateFilterPredicate,
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

  describe("filterTreeWithAncestors", () => {
    const tourTree: FlexElementNode[] = [
      {
        elementId: "tour-main",
        displayName: "Tour Main Folder",
        children: [
          {
            elementId: "sound-dept",
            displayName: "Sound Department",
            children: [
              {
                elementId: "date1-sound",
                displayName: "Barcelona - Jan 15 - Sound",
                documentNumber: "2501155S",
              },
              {
                elementId: "date2-sound",
                displayName: "Madrid - Jan 20 - Sound",
                documentNumber: "2501205S",
              },
            ],
          },
          {
            elementId: "lights-dept",
            displayName: "Lights Department",
            children: [
              {
                elementId: "date1-lights",
                displayName: "Barcelona - Jan 15 - Lights",
                documentNumber: "2501155L",
              },
            ],
          },
        ],
      },
    ];

    it("should filter nodes by predicate", () => {
      const predicate = (node: FlexElementNode) =>
        node.documentNumber?.startsWith("250115") || false;

      const result = filterTreeWithAncestors(tourTree, predicate);

      // Should include matching nodes and their ancestors
      expect(result).toHaveLength(1); // tour-main
      expect(result[0].elementId).toBe("tour-main");
      expect(result[0].children).toHaveLength(2); // sound-dept and lights-dept
      
      const soundDept = result[0].children?.find(c => c.elementId === "sound-dept");
      expect(soundDept).toBeDefined();
      expect(soundDept?.children).toHaveLength(1); // Only date1-sound
      expect(soundDept?.children?.[0].elementId).toBe("date1-sound");
      
      const lightsDept = result[0].children?.find(c => c.elementId === "lights-dept");
      expect(lightsDept).toBeDefined();
      expect(lightsDept?.children).toHaveLength(1); // date1-lights
    });

    it("should preserve ancestor hierarchy", () => {
      const predicate = (node: FlexElementNode) =>
        node.documentNumber === "2501205S";

      const result = filterTreeWithAncestors(tourTree, predicate);

      // Should include: tour-main > sound-dept > date2-sound
      expect(result).toHaveLength(1);
      expect(result[0].elementId).toBe("tour-main");
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].elementId).toBe("sound-dept");
      expect(result[0].children?.[0].children).toHaveLength(1);
      expect(result[0].children?.[0].children?.[0].elementId).toBe("date2-sound");
    });

    it("should return empty array when no matches", () => {
      const predicate = (node: FlexElementNode) =>
        node.documentNumber === "NONEXISTENT";

      const result = filterTreeWithAncestors(tourTree, predicate);
      expect(result).toHaveLength(0);
    });

    it("should handle nodes without document numbers", () => {
      const predicate = (node: FlexElementNode) =>
        node.displayName.includes("Sound Department");

      const result = filterTreeWithAncestors(tourTree, predicate);

      // Should include tour-main and sound-dept (but not its children since they don't match)
      expect(result).toHaveLength(1);
      expect(result[0].elementId).toBe("tour-main");
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].elementId).toBe("sound-dept");
      expect(result[0].children?.[0].children).toBeUndefined();
    });

    it("should work with multiple matching branches", () => {
      const predicate = (node: FlexElementNode) =>
        node.documentNumber?.includes("5S") || false;

      const result = filterTreeWithAncestors(tourTree, predicate);

      // Should include both sound dates
      expect(result).toHaveLength(1);
      const soundDept = result[0].children?.find(c => c.elementId === "sound-dept");
      expect(soundDept?.children).toHaveLength(2);
    });
  });

  describe("createTourdateFilterPredicate", () => {
    it("should create predicate that matches document numbers by date", () => {
      const date = new Date("2025-01-15T10:00:00Z");
      const predicate = createTourdateFilterPredicate(date);

      const matchingNode: FlexElementNode = {
        elementId: "1",
        displayName: "Test",
        documentNumber: "2501155S", // YYMMDD + suffix
      };

      const nonMatchingNode: FlexElementNode = {
        elementId: "2",
        displayName: "Test",
        documentNumber: "2501205S",
      };

      expect(predicate(matchingNode)).toBe(true);
      expect(predicate(nonMatchingNode)).toBe(false);
    });

    it("should work with ISO date strings", () => {
      const dateString = "2025-01-15T00:00:00Z";
      const predicate = createTourdateFilterPredicate(dateString);

      const matchingNode: FlexElementNode = {
        elementId: "1",
        displayName: "Test",
        documentNumber: "2501155S",
      };

      expect(predicate(matchingNode)).toBe(true);
    });

    it("should not match nodes without document numbers", () => {
      const date = new Date("2025-01-15T10:00:00Z");
      const predicate = createTourdateFilterPredicate(date);

      const nodeWithoutDocNumber: FlexElementNode = {
        elementId: "1",
        displayName: "Parent Folder",
      };

      expect(predicate(nodeWithoutDocNumber)).toBe(false);
    });

    it("should match different department suffixes for same date", () => {
      const date = new Date("2025-01-15T10:00:00Z");
      const predicate = createTourdateFilterPredicate(date);

      const soundNode: FlexElementNode = {
        elementId: "1",
        displayName: "Sound",
        documentNumber: "2501155S",
      };

      const lightsNode: FlexElementNode = {
        elementId: "2",
        displayName: "Lights",
        documentNumber: "2501155L",
      };

      const videoNode: FlexElementNode = {
        elementId: "3",
        displayName: "Video",
        documentNumber: "2501155V",
      };

      expect(predicate(soundNode)).toBe(true);
      expect(predicate(lightsNode)).toBe(true);
      expect(predicate(videoNode)).toBe(true);
    });

    it("should handle dates in different months and years", () => {
      const decemberDate = new Date("2024-12-31T10:00:00Z");
      const predicate = createTourdateFilterPredicate(decemberDate);

      const matchingNode: FlexElementNode = {
        elementId: "1",
        displayName: "Test",
        documentNumber: "2412315S",
      };

      const nonMatchingNode: FlexElementNode = {
        elementId: "2",
        displayName: "Test",
        documentNumber: "2501015S", // Different date
      };

      expect(predicate(matchingNode)).toBe(true);
      expect(predicate(nonMatchingNode)).toBe(false);
    });
  });
});
