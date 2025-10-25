export type FlexLinkIntent =
  | 'simple-element'
  | 'financial-document'
  | 'expense-sheet'
  | 'contact-list'
  | 'remote-file-list'
  | 'equipment-list';

export const FLEX_TEMPLATE_IDS = {
  financialDocumentView: 'ca6b072c-b122-11df-b8d5-00e08175e43e',
  expenseSheetView: '566d32e0-1a1e-11e0-a472-00e08175e43e',
  contactListView: 'default-contact-list-view',
  remoteFileListView: 'default-remote-file-list-view',
  equipmentListView: 'default-equipment-list-view',
} as const;

export function getFlexBaseUrl(): string {
  const envUrl = import.meta.env.VITE_FLEX_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl;
  }
  return 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';
}

function normalizeBaseUrl(baseUrl: string): string {
  let normalized = baseUrl.trim();
  
  if (normalized.endsWith('#')) {
    normalized = normalized.slice(0, -1);
  }
  
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

function validateElementId(elementId: string | null | undefined): void {
  if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
    throw new Error(`Invalid elementId: "${elementId}"`);
  }
}

function buildHashFragment(intent: FlexLinkIntent, elementId: string): string {
  switch (intent) {
    case 'simple-element':
      return `#element/${elementId}/view/simple-element/header`;
    
    case 'financial-document':
      return `#fin-doc/${elementId}/doc-view/${FLEX_TEMPLATE_IDS.financialDocumentView}/header`;
    
    case 'expense-sheet':
      return `#fin-doc/${elementId}/doc-view/${FLEX_TEMPLATE_IDS.expenseSheetView}/header`;
    
    case 'contact-list':
      return `#element/${elementId}/view/contact-list/header`;
    
    case 'remote-file-list':
      return `#element/${elementId}/view/remote-file-list/header`;
    
    case 'equipment-list':
      return `#element/${elementId}/view/equipment-list/header`;
    
    default:
      const exhaustiveCheck: never = intent;
      throw new Error(`Unknown intent: ${exhaustiveCheck}`);
  }
}

export interface BuildFlexUrlOptions {
  intent: FlexLinkIntent;
  elementId: string;
  baseUrl?: string;
}

export function buildFlexUrl(options: BuildFlexUrlOptions): string {
  const { intent, elementId, baseUrl } = options;
  
  validateElementId(elementId);
  
  const base = normalizeBaseUrl(baseUrl || getFlexBaseUrl());
  const hash = buildHashFragment(intent, elementId);
  
  return `${base}${hash}`;
}
