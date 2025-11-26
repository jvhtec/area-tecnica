import { supabase } from '@/lib/supabase';
import { FLEX_API_BASE_URL } from '@/lib/api-config';
import { FLEX_FOLDER_IDS } from './flex-folders/constants';

export const FLEX_UI_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';

export const FLEX_VIEW_IDS = {
  FIN_DOC: 'ca6b072c-b122-11df-b8d5-00e08175e43e',
  CREW_CALL: '139e2f60-8d20-11e2-b07f-00e08175e43e',
  EXPENSE_SHEET: '7a7f52a8-c0f6-11e2-9b7f-00e08175e43e',
  REMOTE_FILE_LIST: 'a12fdbe4-e6aa-11df-8f1c-00e08175e43e',
  EQUIPMENT_LIST: 'd7a94fba-bbf1-11df-b8d5-00e08175e43e',
} as const;

const SIMPLE_DOMAIN_HINTS = new Set([
  'simple-project-element',
  'project-folder',
  'department-folder',
  'job-folder',
  'tour-folder',
  'folder',
  'simple-element',
]);

const SIMPLE_VIEW_HINTS = new Set([
  'simple-element',
  'folder',
  'dryhire-folder',
  'tourdate-folder',
  'department-folder',
]);

const FIN_DOC_DOMAIN_HINTS = new Set([
  'fin-doc',
  'financial-document',
  'financial-doc',
  'presupuesto',
  'dryhire-fin-doc',
]);

const FIN_DOC_VIEW_HINTS = new Set([
  'fin-doc',
  'financial-document',
  'financial-doc',
  'presupuesto',
]);

const FIN_DOC_DEFINITION_IDS = new Set(
  [
    FLEX_FOLDER_IDS.presupuesto,
    FLEX_FOLDER_IDS.presupuestoDryHire,
    FLEX_FOLDER_IDS.hojaGastos,
    FLEX_FOLDER_IDS.ordenCompra,
    FLEX_FOLDER_IDS.ordenSubalquiler,
    FLEX_FOLDER_IDS.ordenTrabajo,
    FLEX_FOLDER_IDS.pullSheet,
  ].map(id => id.toLowerCase())
);

const CREW_CALL_DOMAIN_HINTS = new Set(['contact-list', 'crew-call', 'contact-list-element']);
const CREW_CALL_VIEW_HINTS = new Set(['crew-call', 'contact-list']);
const CREW_CALL_DEFINITION_IDS = new Set([FLEX_FOLDER_IDS.crewCall.toLowerCase()]);

const EXPENSE_SHEET_DOMAIN_HINTS = new Set(['expense-sheet', 'expense', 'expense-list', 'expense-report']);
const EXPENSE_SHEET_VIEW_HINTS = new Set(['expense-sheet', 'expense']);

const REMOTE_FILE_LIST_DOMAIN_HINTS = new Set(['remote-file-list', 'remote-files', 'file-list', 'file-library']);
const REMOTE_FILE_LIST_VIEW_HINTS = new Set(['remote-file-list', 'remote-files']);

const EQUIPMENT_LIST_DOMAIN_HINTS = new Set(['equipment-list', 'equipment', 'equipment-schedule', 'equipment-log']);
const EQUIPMENT_LIST_VIEW_HINTS = new Set(['equipment-list', 'equipment']);

const JOB_TYPES_SIMPLE = new Set(['dryhire', 'tourdate']);

export type FlexUrlSchema =
  | 'simple-element'
  | 'fin-doc'
  | 'crew-call'
  | 'expense-sheet'
  | 'remote-file-list'
  | 'equipment-list';

export interface FlexTreeNode {
  nodeId: string;
  elementId?: string | null;
  parentNodeId?: string | null;
  parentElementId?: string | null;
  domainId?: string | null;
  definitionId?: string | null;
  documentNumber?: string | null;
  displayName?: string | null;
  schemaId?: string | null;
  viewHint?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface FlexUrlResolverContext {
  jobType?: 'single' | 'festival' | 'dryhire' | 'tourdate' | 'evento';
  viewHint?: string | null;
  fallbackDefinitionId?: string | null;
  fallbackDomainId?: string | null;
}

interface SchemaMetadata {
  domainId?: string;
  definitionId?: string;
  viewHint?: string;
  schemaId?: string;
  documentNumber?: string;
  displayName?: string;
}

interface NormalizedSchemaMetadata {
  domainId?: string;
  definitionId?: string;
  viewHint?: string;
  schemaId?: string;
}

interface SchemaResolution {
  schema: FlexUrlSchema | null;
  reason?: string;
}

let cachedFlexToken: string | null = null;
let pendingTokenPromise: Promise<string> | null = null;

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalize(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function pickPrimaryElementId(node: FlexTreeNode): string | null {
  const dynamic = node as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    node.nodeId,
    node.elementId,
    dynamic?.element_id,
    dynamic?.elementId,
    dynamic?.id,
    node.metadata && typeof node.metadata === 'object'
      ? (node.metadata as Record<string, unknown>).elementId
      : undefined,
  ];

  for (const candidate of candidates) {
    const value = coerceString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

async function getFlexAuthToken(): Promise<string> {
  if (cachedFlexToken) {
    return cachedFlexToken;
  }

  if (pendingTokenPromise) {
    return pendingTokenPromise;
  }

  pendingTokenPromise = (async () => {
    console.log('[flexUrlResolver] Fetching Flex auth token');
    const { data, error } = await supabase.functions.invoke('get-secret', {
      body: { secretName: 'X_AUTH_TOKEN' },
    });

    if (error) {
      pendingTokenPromise = null;
      throw new Error(error.message || 'Failed to resolve Flex auth token');
    }

    const token = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN;
    if (!token) {
      pendingTokenPromise = null;
      throw new Error('Flex auth token response missing X_AUTH_TOKEN');
    }

    cachedFlexToken = token;
    pendingTokenPromise = null;
    return token;
  })();

  try {
    return await pendingTokenPromise;
  } catch (error) {
    cachedFlexToken = null;
    throw error;
  }
}

async function flexApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getFlexAuthToken();
  const headers = new Headers(init.headers || {});

  if (!headers.has('X-Auth-Token')) {
    headers.set('X-Auth-Token', token);
  }
  if (!headers.has('apikey')) {
    headers.set('apikey', token);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const url = path.startsWith('http')
    ? path
    : `${FLEX_API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  return fetch(url, {
    ...init,
    headers,
  });
}

function extractFlexField(value: unknown): string | undefined {
  if (!value || typeof value === 'string') {
    return coerceString(value);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('data' in record) {
      return coerceString(record.data);
    }
  }

  return undefined;
}

async function fetchElementMetadata(elementId: string): Promise<SchemaMetadata | null> {
  try {
    console.log('[flexUrlResolver] Fetching element metadata', { elementId });
    const response = await flexApiFetch(`/element/${encodeURIComponent(elementId)}/key-info/`, {
      method: 'GET',
    });

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // ignore json parsing errors in logs
      }
      console.warn('[flexUrlResolver] Failed to fetch element metadata', {
        elementId,
        status: response.status,
        statusText: response.statusText,
        payload,
      });
      return null;
    }

    const data = await response.json();
    const metadata: SchemaMetadata = {
      domainId:
        extractFlexField((data as any)?.domainId) ||
        extractFlexField((data as any)?.domainID),
      definitionId:
        extractFlexField((data as any)?.elementDefinitionId) ||
        extractFlexField((data as any)?.definitionId),
      viewHint:
        extractFlexField((data as any)?.viewHint) ||
        extractFlexField((data as any)?.view_hint),
      schemaId: extractFlexField((data as any)?.schemaId),
      documentNumber:
        extractFlexField((data as any)?.documentNumber) ||
        extractFlexField((data as any)?.document_number),
      displayName:
        extractFlexField((data as any)?.displayName) ||
        extractFlexField((data as any)?.name),
    };

    console.log('[flexUrlResolver] Retrieved element metadata', {
      elementId,
      domainId: metadata.domainId,
      definitionId: metadata.definitionId,
      viewHint: metadata.viewHint,
      schemaId: metadata.schemaId,
    });

    return metadata;
  } catch (error) {
    console.error('[flexUrlResolver] Error fetching element metadata', {
      elementId,
      error,
    });
    return null;
  }
}

function normalizeMetadata(
  meta: SchemaMetadata,
  context: FlexUrlResolverContext
): NormalizedSchemaMetadata {
  return {
    domainId: normalize(meta.domainId ?? context.fallbackDomainId),
    definitionId: normalize(meta.definitionId ?? context.fallbackDefinitionId),
    viewHint: normalize(meta.viewHint ?? context.viewHint),
    schemaId: normalize(meta.schemaId),
  };
}

function determineSchema(
  meta: NormalizedSchemaMetadata,
  context: FlexUrlResolverContext
): SchemaResolution {
  const { domainId, definitionId, viewHint, schemaId } = meta;

  if (viewHint) {
    if (CREW_CALL_VIEW_HINTS.has(viewHint)) {
      return { schema: 'crew-call', reason: 'viewHint' };
    }
    if (EXPENSE_SHEET_VIEW_HINTS.has(viewHint)) {
      return { schema: 'expense-sheet', reason: 'viewHint' };
    }
    if (REMOTE_FILE_LIST_VIEW_HINTS.has(viewHint)) {
      return { schema: 'remote-file-list', reason: 'viewHint' };
    }
    if (EQUIPMENT_LIST_VIEW_HINTS.has(viewHint)) {
      return { schema: 'equipment-list', reason: 'viewHint' };
    }
    if (FIN_DOC_VIEW_HINTS.has(viewHint)) {
      return { schema: 'fin-doc', reason: 'viewHint' };
    }
    if (SIMPLE_VIEW_HINTS.has(viewHint)) {
      return { schema: 'simple-element', reason: 'viewHint' };
    }
  }

  if (domainId) {
    if (CREW_CALL_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'crew-call', reason: 'domainId' };
    }
    if (EXPENSE_SHEET_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'expense-sheet', reason: 'domainId' };
    }
    if (REMOTE_FILE_LIST_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'remote-file-list', reason: 'domainId' };
    }
    if (EQUIPMENT_LIST_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'equipment-list', reason: 'domainId' };
    }
    if (FIN_DOC_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'fin-doc', reason: 'domainId' };
    }
    if (SIMPLE_DOMAIN_HINTS.has(domainId)) {
      return { schema: 'simple-element', reason: 'domainId' };
    }
  }

  if (definitionId) {
    if (CREW_CALL_DEFINITION_IDS.has(definitionId)) {
      return { schema: 'crew-call', reason: 'definitionId' };
    }
    if (FIN_DOC_DEFINITION_IDS.has(definitionId)) {
      return { schema: 'fin-doc', reason: 'definitionId' };
    }
  }

  if (schemaId) {
    if (schemaId === 'simple-element') {
      return { schema: 'simple-element', reason: 'schemaId' };
    }
    if (schemaId === 'fin-doc') {
      return { schema: 'fin-doc', reason: 'schemaId' };
    }
    if (schemaId === 'crew-call') {
      return { schema: 'crew-call', reason: 'schemaId' };
    }
    if (schemaId === 'expense-sheet') {
      return { schema: 'expense-sheet', reason: 'schemaId' };
    }
    if (schemaId === 'remote-file-list') {
      return { schema: 'remote-file-list', reason: 'schemaId' };
    }
    if (schemaId === 'equipment-list') {
      return { schema: 'equipment-list', reason: 'schemaId' };
    }
  }

  if (context.jobType && JOB_TYPES_SIMPLE.has(context.jobType)) {
    return { schema: 'simple-element', reason: 'jobType' };
  }

  return { schema: null, reason: 'unknown' };
}

function buildUrl(schema: FlexUrlSchema, elementId: string): string {
  const encodedId = encodeURIComponent(elementId);
  switch (schema) {
    case 'fin-doc':
      return `${FLEX_UI_BASE_URL}#fin-doc/${encodedId}/doc-view/${FLEX_VIEW_IDS.FIN_DOC}/header`;
    case 'crew-call':
      return `${FLEX_UI_BASE_URL}#contact-list/${encodedId}/view/${FLEX_VIEW_IDS.CREW_CALL}/header`;
    case 'expense-sheet':
      return `${FLEX_UI_BASE_URL}#expense-sheet/${encodedId}/view/${FLEX_VIEW_IDS.EXPENSE_SHEET}/header`;
    case 'remote-file-list':
      return `${FLEX_UI_BASE_URL}#remote-file-list/${encodedId}/view/${FLEX_VIEW_IDS.REMOTE_FILE_LIST}/header`;
    case 'equipment-list':
      return `${FLEX_UI_BASE_URL}#equipment-list/${encodedId}/view/${FLEX_VIEW_IDS.EQUIPMENT_LIST}/header`;
    case 'simple-element':
    default:
      return `${FLEX_UI_BASE_URL}#element/${encodedId}/view/simple-element/header`;
  }
}

export async function resolveFlexUrl(
  node: FlexTreeNode,
  context: FlexUrlResolverContext = {}
): Promise<string | null> {
  const elementId = pickPrimaryElementId(node);

  if (!elementId) {
    console.error('[flexUrlResolver] Node is missing a usable element identifier', {
      node,
      context,
    });
    return null;
  }

  const baseMetadata: SchemaMetadata = {
    domainId:
      coerceString(node.domainId) ||
      coerceString(context.fallbackDomainId) ||
      (node.metadata && typeof node.metadata === 'object'
        ? coerceString((node.metadata as Record<string, unknown>).domainId)
        : undefined),
    definitionId:
      coerceString(node.definitionId) ||
      coerceString(context.fallbackDefinitionId) ||
      (node.metadata && typeof node.metadata === 'object'
        ? coerceString((node.metadata as Record<string, unknown>).definitionId)
        : undefined),
    viewHint:
      coerceString(node.viewHint) ||
      coerceString(context.viewHint) ||
      (node.metadata && typeof node.metadata === 'object'
        ? coerceString((node.metadata as Record<string, unknown>).viewHint)
        : undefined),
    schemaId:
      coerceString(node.schemaId) ||
      (node.metadata && typeof node.metadata === 'object'
        ? coerceString((node.metadata as Record<string, unknown>).schemaId)
        : undefined),
    documentNumber: coerceString(node.documentNumber),
    displayName: coerceString(node.displayName),
  };

  console.log('[flexUrlResolver] Resolving Flex URL', {
    elementId,
    jobType: context.jobType,
    domainId: baseMetadata.domainId,
    definitionId: baseMetadata.definitionId,
    viewHint: baseMetadata.viewHint,
    schemaId: baseMetadata.schemaId,
  });

  let normalized = normalizeMetadata(baseMetadata, context);
  let resolution = determineSchema(normalized, context);

  if (!resolution.schema) {
    const fetched = await fetchElementMetadata(elementId);
    if (fetched) {
      if (!baseMetadata.domainId && fetched.domainId) {
        baseMetadata.domainId = fetched.domainId;
      }
      if (!baseMetadata.definitionId && fetched.definitionId) {
        baseMetadata.definitionId = fetched.definitionId;
      }
      if (!baseMetadata.viewHint && fetched.viewHint) {
        baseMetadata.viewHint = fetched.viewHint;
      }
      if (!baseMetadata.schemaId && fetched.schemaId) {
        baseMetadata.schemaId = fetched.schemaId;
      }
      normalized = normalizeMetadata(baseMetadata, context);
      resolution = determineSchema(normalized, context);
    } else if (context.jobType && JOB_TYPES_SIMPLE.has(context.jobType)) {
      resolution = { schema: 'simple-element', reason: 'jobType-fallback' };
    }
  }

  if (!resolution.schema && context.jobType && JOB_TYPES_SIMPLE.has(context.jobType)) {
    console.warn('[flexUrlResolver] Falling back to simple element based on job context', {
      elementId,
      jobType: context.jobType,
    });
    resolution = { schema: 'simple-element', reason: 'jobType-fallback' };
  }

  if (!resolution.schema) {
    console.error('[flexUrlResolver] Unable to resolve Flex URL schema', {
      elementId,
      jobType: context.jobType,
      domainId: baseMetadata.domainId,
      definitionId: baseMetadata.definitionId,
      viewHint: baseMetadata.viewHint,
      schemaId: baseMetadata.schemaId,
    });
    return null;
  }

  const url = buildUrl(resolution.schema, elementId);

  console.log('[flexUrlResolver] Resolved Flex URL', {
    elementId,
    schema: resolution.schema,
    reason: resolution.reason,
    url,
  });

  return url;
}

export function __resetFlexAuthCacheForTests(): void {
  cachedFlexToken = null;
  pendingTokenPromise = null;
}
