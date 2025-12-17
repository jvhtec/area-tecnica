/**
 * Extracts the Flex element ID from a Flex URL
 *
 * Supports patterns like:
 * - https://flex.domain.com/app/element/{elementId}
 * - https://flex.domain.com/f5/ui/?desktop#element/{elementId}/view/...
 * - https://flex.domain.com/f5/ui/?desktop#fin-doc/{elementId}/...
 * - https://flex.domain.com/f5/ui/?desktop#contact-list/{elementId}/...
 *
 * @param url - The Flex URL to parse
 * @returns The element ID if found, null otherwise
 */
export function extractFlexElementId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // Parse the URL
    const urlObj = new URL(trimmed);

    // Check hash fragment first (for UI URLs like #element/{id}/...)
    if (urlObj.hash) {
      const hashMatch = urlObj.hash.match(/[#/](?:element|fin-doc|contact-list|expense-sheet|remote-file-list|equipment-list)\/([a-f0-9-]{36})/i);
      if (hashMatch && hashMatch[1]) {
        return hashMatch[1];
      }
    }

    // Check pathname (for API URLs like /element/{id})
    if (urlObj.pathname) {
      const pathMatch = urlObj.pathname.match(/\/element\/([a-f0-9-]{36})/i);
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
      }
    }

    return null;
  } catch (error) {
    // If URL parsing fails, try regex on the raw string
    const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    const match = trimmed.match(uuidPattern);
    return match ? match[0] : null;
  }
}

/**
 * Validates if a string looks like a Flex URL
 *
 * @param url - The URL to validate
 * @returns True if it looks like a Flex URL, false otherwise
 */
export function isFlexUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();

  // Check if it contains common Flex URL patterns
  return (
    trimmed.includes('flexrentalsolutions.com') ||
    trimmed.includes('/f5/ui/') ||
    trimmed.includes('#element/') ||
    trimmed.includes('#fin-doc/') ||
    trimmed.includes('/element/')
  );
}
