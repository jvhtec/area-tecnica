/**
 * Types for Flex element tree structure
 */
export interface FlexElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  children?: FlexElementNode[];
}

export interface FlatElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  depth: number;
}

/**
 * Fetches the element tree from Flex API starting from a given main element
 * @param mainElementId The root element ID to fetch the tree from
 * @returns Array of element nodes in the tree
 */
export async function getElementTree(
  mainElementId: string
): Promise<FlexElementNode[]> {
  try {
    const response = await fetch(
      `https://sectorpro.flexrentalsolutions.com/f5/api/element/${mainElementId}/tree`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Flex element tree fetch error:", errorData);
      throw new Error(
        errorData.exceptionMessage || "Failed to fetch element tree from Flex"
      );
    }

    const data = await response.json();
    console.log("Fetched Flex element tree:", data);

    // Transform API response to our format
    return transformFlexTreeResponse(data);
  } catch (error) {
    console.error("Exception fetching Flex element tree:", error);
    throw error;
  }
}

/**
 * Transform Flex API response to our normalized tree structure
 */
function transformFlexTreeResponse(data: unknown): FlexElementNode[] {
  if (!data) return [];

  // Handle if data is a single element
  if (typeof data === "object" && data !== null && "elementId" in data) {
    return [transformSingleElement(data)];
  }

  // Handle if data is an array
  if (Array.isArray(data)) {
    return data.map(transformSingleElement);
  }

  // Handle if data has a children or items property
  if (
    typeof data === "object" &&
    data !== null &&
    ("children" in data || "items" in data)
  ) {
    const items =
      "children" in data ? data.children : "items" in data ? data.items : null;
    return Array.isArray(items) ? items.map(transformSingleElement) : [];
  }

  return [];
}

/**
 * Transform a single element from Flex API format
 */
function transformSingleElement(element: unknown): FlexElementNode {
  if (typeof element !== "object" || element === null) {
    return {
      elementId: "",
      displayName: "Unnamed",
    };
  }

  const el = element as Record<string, unknown>;
  const node: FlexElementNode = {
    elementId:
      (typeof el.elementId === "string" ? el.elementId : null) ||
      (typeof el.id === "string" ? el.id : null) ||
      "",
    displayName:
      (typeof el.displayName === "string" ? el.displayName : null) ||
      (typeof el.name === "string" ? el.name : null) ||
      "Unnamed",
    documentNumber:
      (typeof el.documentNumber === "string" ? el.documentNumber : null) ||
      (typeof el.docNumber === "string" ? el.docNumber : null) ||
      undefined,
    parentElementId:
      (typeof el.parentElementId === "string" ? el.parentElementId : null) ||
      (typeof el.parentId === "string" ? el.parentId : null) ||
      undefined,
  };

  // Recursively transform children
  if (Array.isArray(el.children)) {
    node.children = el.children.map(transformSingleElement);
  }

  return node;
}

/**
 * Flatten a hierarchical tree into a list with depth information
 * Useful for rendering in a scrollable list with indentation
 * @param nodes The tree nodes to flatten
 * @param depth Current depth level (starts at 0)
 * @returns Flattened array of nodes with depth information
 */
export function flattenTree(
  nodes: FlexElementNode[],
  depth: number = 0
): FlatElementNode[] {
  const result: FlatElementNode[] = [];

  for (const node of nodes) {
    // Add current node
    result.push({
      elementId: node.elementId,
      displayName: node.displayName,
      documentNumber: node.documentNumber,
      parentElementId: node.parentElementId,
      depth,
    });

    // Recursively add children
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }

  return result;
}

/**
 * Search/filter tree nodes by display name or document number
 * @param nodes The nodes to search
 * @param query The search query string
 * @returns Filtered and flattened nodes matching the query
 */
export function searchTree(
  nodes: FlexElementNode[],
  query: string
): FlatElementNode[] {
  if (!query.trim()) {
    return flattenTree(nodes);
  }

  const lowerQuery = query.toLowerCase();
  const result: FlatElementNode[] = [];

  function searchRecursive(
    searchNodes: FlexElementNode[],
    depth: number
  ): void {
    for (const node of searchNodes) {
      const matchesName = node.displayName
        .toLowerCase()
        .includes(lowerQuery);
      const matchesDocNumber = node.documentNumber
        ?.toLowerCase()
        .includes(lowerQuery);

      if (matchesName || matchesDocNumber) {
        result.push({
          elementId: node.elementId,
          displayName: node.displayName,
          documentNumber: node.documentNumber,
          parentElementId: node.parentElementId,
          depth,
        });
      }

      // Continue searching children
      if (node.children && node.children.length > 0) {
        searchRecursive(node.children, depth + 1);
      }
    }
  }

  searchRecursive(nodes, 0);
  return result;
}
