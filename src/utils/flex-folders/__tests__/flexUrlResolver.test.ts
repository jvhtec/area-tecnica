import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveFlexUrl,
  FLEX_UI_BASE_URL,
  FLEX_VIEW_IDS,
  __resetFlexAuthCacheForTests,
  type FlexTreeNode,
} from '../../flexUrlResolver';
import { FLEX_FOLDER_IDS } from '../constants';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('resolveFlexUrl', () => {
  const invokeMock = () => supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
  const getFetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetFlexAuthCacheForTests();
    vi.clearAllMocks();
    invokeMock().mockResolvedValue({
      data: { X_AUTH_TOKEN: 'test-token' },
      error: null,
    });
    globalThis.fetch = vi.fn() as any;
  });

  it('resolves simple element URL for simple project element domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'simple-id',
      domainId: 'simple-project-element',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('simple-id')}/view/simple-element/detail`
    );
    expect(invokeMock()).not.toHaveBeenCalled();
    expect(getFetchMock()).not.toHaveBeenCalled();
  });

  it('resolves financial document URL for fin-doc domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'fin-doc-id',
      domainId: 'fin-doc',
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent('fin-doc-id')}/doc-view/${FLEX_VIEW_IDS.FIN_DOC}/detail`
    );
  });

  it('resolves crew call URL for contact list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'crew-id',
      domainId: 'contact-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#contact-list/${encodeURIComponent('crew-id')}/view/${FLEX_VIEW_IDS.CREW_CALL}/detail`
    );
  });

  it('resolves expense sheet URL for expense sheet domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'expense-id',
      domainId: 'expense-sheet',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#expense-sheet/${encodeURIComponent('expense-id')}/view/${FLEX_VIEW_IDS.EXPENSE_SHEET}/detail`
    );
  });

  it('resolves remote file list URL for remote file list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'remote-id',
      domainId: 'remote-file-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#remote-file-list/${encodeURIComponent('remote-id')}/view/${FLEX_VIEW_IDS.REMOTE_FILE_LIST}/detail`
    );
  });

  it('resolves equipment list URL for equipment list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'equipment-id',
      domainId: 'equipment-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#equipment-list/${encodeURIComponent('equipment-id')}/view/${FLEX_VIEW_IDS.EQUIPMENT_LIST}/detail`
    );
  });

  it('falls back to simple element for dryhire job when metadata is missing', async () => {
    const node: FlexTreeNode = {
      nodeId: 'dryhire-folder-id',
    };

    const url = await resolveFlexUrl(node, { jobType: 'dryhire' });

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('dryhire-folder-id')}/view/simple-element/detail`
    );
    expect(getFetchMock()).not.toHaveBeenCalled();
  });

  it('falls back to simple element for tourdate job with tourdate hint', async () => {
    const node: FlexTreeNode = {
      nodeId: 'tourdate-folder-id',
      viewHint: 'tourdate-folder',
    };

    const url = await resolveFlexUrl(node, { jobType: 'tourdate' });

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('tourdate-folder-id')}/view/simple-element/detail`
    );
    expect(getFetchMock()).not.toHaveBeenCalled();
  });

  it('fetches metadata when schema cannot be determined and applies headers', async () => {
    const node: FlexTreeNode = {
      nodeId: 'metadata-id',
    };

    __resetFlexAuthCacheForTests();
    invokeMock().mockResolvedValue({
      data: { X_AUTH_TOKEN: 'metadata-token' },
      error: null,
    });

    getFetchMock().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        domainId: { data: 'fin-doc' },
        elementDefinitionId: { data: FLEX_FOLDER_IDS.presupuesto },
      }),
    } as unknown as Response);

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent('metadata-id')}/doc-view/${FLEX_VIEW_IDS.FIN_DOC}/detail`
    );

    expect(invokeMock()).toHaveBeenCalledTimes(1);
    expect(getFetchMock()).toHaveBeenCalledTimes(1);

    const [, init] = getFetchMock().mock.calls[0] as [RequestInfo, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('X-Auth-Token')).toBe('metadata-token');
    expect(headers.get('apikey')).toBe('metadata-token');
  });

  it('returns null when schema cannot be determined even after metadata fetch', async () => {
    const node: FlexTreeNode = {
      nodeId: 'unknown-id',
    };

    __resetFlexAuthCacheForTests();
    invokeMock().mockResolvedValue({
      data: { X_AUTH_TOKEN: 'fail-token' },
      error: null,
    });

    getFetchMock().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as unknown as Response);

    const url = await resolveFlexUrl(node, { jobType: 'single' });

    expect(url).toBeNull();
  });
});
