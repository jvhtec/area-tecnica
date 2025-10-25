/**
 * Centralized Flex configuration
 * Contains base URLs, view IDs, and other Flex-specific constants
 */

export const FLEX_CONFIG = {
  baseUrl: 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop',
  apiBaseUrl: 'https://sectorpro.flexrentalsolutions.com/f5/api',
  viewIds: {
    presupuesto: 'ca6b072c-b122-11df-b8d5-00e08175e43e',
    hojaGastos: '566d32e0-1a1e-11e0-a472-00e08175e43e',
    crewCall: '139e2f60-8d20-11e2-b07f-00e08175e43e',
  },
} as const;

/**
 * Get the base URL for Flex web UI
 */
export function getFlexBaseUrl(): string {
  return FLEX_CONFIG.baseUrl;
}

/**
 * Get the base URL for Flex API
 */
export function getFlexApiBaseUrl(): string {
  return FLEX_CONFIG.apiBaseUrl;
}

/**
 * Get a specific view ID by name
 */
export function getFlexViewId(viewName: keyof typeof FLEX_CONFIG.viewIds): string {
  return FLEX_CONFIG.viewIds[viewName];
}
