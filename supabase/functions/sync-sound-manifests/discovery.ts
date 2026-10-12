const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PULL_SHEET_DEFINITION_ID = "a220432c-af33-11df-b8d5-00e08175e43e";

/** Accept named fields only from object responses, excluding arrays and primitives. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Only the quote's direct children qualify; null distinguishes invalid discovery from an empty quote. */
export function findQuoteEquipmentListCandidates(tree: unknown, quoteId: string): string[] | null {
  if (!UUID.test(quoteId)) return null;
  const normalizedQuoteId = quoteId.toLowerCase();
  const pending: unknown[] = Array.isArray(tree) ? [...tree] : [tree];
  let quote: Record<string, unknown> | null = null;
  while (pending.length) {
    const node = asRecord(pending.pop());
    if (!node || node.deleted === true) continue;
    if (typeof node.nodeId === "string" && UUID.test(node.nodeId) && node.nodeId.toLowerCase() === normalizedQuoteId) {
      if (quote) return null; // Ambiguous roots must never select another quote's equipment.
      quote = node;
    }
    // Equipment lists can contain ship manifests; those descendants are never candidates.
    if (node.domainId === "equipment-list") continue;
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  if (!quote) return null;
  if (quote.children === null) return [];
  if (!Array.isArray(quote.children)) return null;
  const candidates = new Set<string>();
  for (const value of quote.children) {
    const child = asRecord(value);
    if (child && child.domainId === "equipment-list" && child.deleted !== true &&
      typeof child.parentId === "string" && UUID.test(child.parentId) && child.parentId.toLowerCase() === normalizedQuoteId &&
      typeof child.nodeId === "string" && UUID.test(child.nodeId)) {
      candidates.add(child.nodeId.toLowerCase());
    }
  }
  return [...candidates];
}

/** Verify the candidate's own key-info, never labels or arbitrary nested wrappers. */
export function isPullSheetKeyInfo(value: unknown, expectedId: string): boolean {
  const info = asRecord(value);
  return UUID.test(expectedId) && info !== null &&
    Object.prototype.hasOwnProperty.call(info, "elementId") &&
    Object.prototype.hasOwnProperty.call(info, "definitionId") &&
    typeof info.elementId === "string" && UUID.test(info.elementId) &&
    info.elementId.toLowerCase() === expectedId.toLowerCase() &&
    typeof info.definitionId === "string" &&
    info.definitionId.toLowerCase() === PULL_SHEET_DEFINITION_ID &&
    info.isManifest === false && info.deleted === false;
}
