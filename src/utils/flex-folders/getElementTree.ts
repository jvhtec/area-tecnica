import { supabase } from "@/integrations/supabase/client";
import { onFlexTokenInvalidate } from "@/utils/flexTokenCache";

/**
 * Types for Flex element tree structure
 */
export interface FlexElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  domainId?: string;
  definitionId?: string;
  schemaId?: string;
  viewHint?: string;
  children?: FlexElementNode[];
}

export interface FlatElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  domainId?: string;
  definitionId?: string;
  schemaId?: string;
  viewHint?: string;
  depth: number;
}

let cachedFlexToken: string | null = null;
onFlexTokenInvalidate(() => { cachedFlexToken = null; });

/**
 * Gets the Flex authentication token from Supabase secrets
 */
async function getFlexAuthToken(): Promise<string> {
  if (cachedFlexToken) return cachedFlexToken;

  const { data, error } = await supabase.functions.invoke('get-secret', {
    body: { secretName: 'X_AUTH_TOKEN' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to resolve Flex auth token');
  }

  const token = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN;
  if (!token) {
    throw new Error('Flex auth token response missing X_AUTH_TOKEN');
  }

  cachedFlexToken = token;
  return token;
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
    const token = await getFlexAuthToken();

    const response = await fetch(
      `https://sectorpro.flexrentalsolutions.com/f5/api/element/${mainElementId}/tree`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token,
          "apikey": token,
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
function normalizeToString(value: unknown, visited = new Set<object>()): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "object" && value !== null) {
    if (visited.has(value as object)) {
      return undefined;
    }

    visited.add(value as object);
    const record = value as Record<string, unknown>;

    // Common Flex API pattern: { data: "value" }
    if (typeof record.data === "string") {
      const trimmed = record.data.trim();
      if (trimmed.length > 0) return trimmed;
    }

    // Recurse into known nested containers
    for (const key of ["data", "attributes", "value"]) {
      if (key in record) {
        const nested = normalizeToString(record[key], visited);
        if (nested) return nested;
      }
    }

    // As a final fallback, scan all properties once
    for (const nestedValue of Object.values(record)) {
      const nested = normalizeToString(nestedValue, visited);
      if (nested) return nested;
    }
  }

  return undefined;
}

function extractMetadataField(
  element: Record<string, unknown>,
  keys: string[],
  visited = new Set<object>()
): string | undefined {
  if (visited.has(element)) {
    return undefined;
  }
  visited.add(element);

  for (const key of keys) {
    if (key in element) {
      const value = normalizeToString(element[key]);
      if (value) {
        return value;
      }
    }
  }

  if (typeof element.data === "object" && element.data !== null) {
    const nested = extractMetadataField(
      element.data as Record<string, unknown>,
      keys,
      visited
    );
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function transformSingleElement(element: unknown): FlexElementNode {
  if (typeof element !== "object" || element === null) {
    console.warn('[getElementTree] Received non-object element, returning default:', element);
    return {
      elementId: "",
      displayName: "Unnamed",
    };
  }

  const el = element as Record<string, unknown>;

  // Extract elementId with fallbacks
  const extractedElementId =
    (typeof el.elementId === "string" ? el.elementId : null) ||
    (typeof el.nodeId === "string" ? el.nodeId : null) ||
    (typeof el.id === "string" ? el.id : null) ||
    "";
  
  // Log warning if elementId is empty
  if (!extractedElementId || extractedElementId.trim().length === 0) {
    console.warn('[getElementTree] Element has no valid ID, will be filtered out:', {
      element: el,
      elementId: el.elementId,
      nodeId: el.nodeId,
      id: el.id,
      displayName: el.displayName || el.name,
      documentNumber: el.documentNumber || el.docNumber,
    });
  }
  
  const node: FlexElementNode = {
    elementId: extractedElementId,
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
    domainId:
      (typeof el.domainId === "string" ? el.domainId : null) ||
      undefined,
    definitionId:
      (typeof el.definitionId === "string" ? el.definitionId : null) ||
      (typeof el.elementDefinitionId === "string" ? el.elementDefinitionId : null) ||
      undefined,
    schemaId:
      (typeof el.schemaId === "string" ? el.schemaId : null) ||
      (typeof el.schema_id === "string" ? el.schema_id : null) ||
      extractMetadataField(el, ["schemaId", "schema_id"]) ||
      undefined,
    viewHint:
      (typeof el.viewHint === "string" ? el.viewHint : null) ||
      (typeof el.view_hint === "string" ? el.view_hint : null) ||
      extractMetadataField(el, ["viewHint", "view_hint"]) ||
      undefined,
  };

  if (node.schemaId) {
    node.schemaId = node.schemaId.trim();
  }

  if (node.viewHint) {
    node.viewHint = node.viewHint.trim().toLowerCase();
  }

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
      domainId: node.domainId,
      definitionId: node.definitionId,
      schemaId: node.schemaId,
      viewHint: node.viewHint,
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
          domainId: node.domainId,
          definitionId: node.definitionId,
          schemaId: node.schemaId,
          viewHint: node.viewHint,
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

/**
 * Type for a filter predicate function
 */
export type TreeFilterPredicate = (node: FlexElementNode) => boolean;

/**
 * Filter tree nodes by a predicate while preserving ancestor hierarchy
 * This ensures that parent nodes are included even if they don't match,
 * as long as they have descendants that match
 * @param nodes The nodes to filter
 * @param predicate Function that returns true for nodes to keep
 * @returns Filtered tree with ancestors preserved
 */
export function filterTreeWithAncestors(
  nodes: FlexElementNode[],
  predicate: TreeFilterPredicate
): FlexElementNode[] {
  const result: FlexElementNode[] = [];

  for (const node of nodes) {
    // Check if node itself matches
    const nodeMatches = predicate(node);
    
    // Recursively filter children
    const filteredChildren = node.children
      ? filterTreeWithAncestors(node.children, predicate)
      : [];

    // Include node if it matches OR if it has matching descendants
    if (nodeMatches || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : undefined,
      });
    }
  }

  return result;
}

/**
 * Creates a predicate function for filtering tourdate nodes by document number pattern
 * Tourdate document numbers follow the pattern: YYMMDD + SUFFIX (e.g., "2501015S" for 2025-01-01 sound)
 * @param date The tourdate date (ISO string or Date object)
 * @returns Predicate function that matches nodes with the date pattern in their document number
 */
export function createTourdateFilterPredicate(
  date: string | Date
): TreeFilterPredicate {
  // Convert date to YYMMDD format
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const documentDatePattern = dateObj
    .toISOString()
    .slice(2, 10) // Get YYMMDD from ISO string
    .replace(/-/g, ""); // Remove dashes

  return (node: FlexElementNode) => {
    // If node has no document number, it's likely a parent folder - don't match it directly
    // but let filterTreeWithAncestors include it if it has matching descendants
    if (!node.documentNumber) {
      return false;
    }

    // Match if document number starts with the date pattern
    return node.documentNumber.startsWith(documentDatePattern);
  };
}
