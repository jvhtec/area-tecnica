import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveFlexUrl,
  FLEX_UI_BASE_URL,
  FLEX_VIEW_IDS,
  __resetFlexAuthCacheForTests,
  type FlexTreeNode,
} from '@/utils/flexUrlResolver';
import { flexApiFetch } from '@/lib/flex-api-client';
import { FLEX_FOLDER_IDS } from '@/utils/flex-folders/constants';

vi.mock('@/lib/flex-api-client', () => ({
  flexApiFetch: vi.fn(),
}));

describe('resolveFlexUrl', () => {
  const getProxyMock = () => flexApiFetch as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetFlexAuthCacheForTests();
    vi.clearAllMocks();
  });

  it('resolves simple element URL for simple project element domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'simple-id',
      domainId: 'simple-project-element',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('simple-id')}/view/simple-element/header`
    );
    expect(getProxyMock()).not.toHaveBeenCalled();
  });

  it('resolves financial document URL for fin-doc domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'fin-doc-id',
      domainId: 'fin-doc',
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent('fin-doc-id')}/doc-view/${FLEX_VIEW_IDS.FIN_DOC}/header`
    );
  });

  it('resolves crew call URL for contact list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'crew-id',
      domainId: 'contact-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#contact-list/${encodeURIComponent('crew-id')}/view/${FLEX_VIEW_IDS.CREW_CALL}/header`
    );
  });

  it('resolves expense sheet URL for expense sheet domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'expense-id',
      domainId: 'expense-sheet',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#expense-sheet/${encodeURIComponent('expense-id')}/view/${FLEX_VIEW_IDS.EXPENSE_SHEET}/header`
    );
  });

  it('resolves remote file list URL for remote file list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'remote-id',
      domainId: 'remote-file-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#remote-file-list/${encodeURIComponent('remote-id')}/view/${FLEX_VIEW_IDS.REMOTE_FILE_LIST}/header`
    );
  });

  it('resolves equipment list URL for equipment list domain', async () => {
    const node: FlexTreeNode = {
      nodeId: 'equipment-id',
      domainId: 'equipment-list',
    };

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#equipment-list/${encodeURIComponent('equipment-id')}/view/${FLEX_VIEW_IDS.EQUIPMENT_LIST}/header`
    );
  });

  it('falls back to simple element for dryhire job when metadata is missing', async () => {
    const node: FlexTreeNode = {
      nodeId: 'dryhire-folder-id',
    };

    const url = await resolveFlexUrl(node, { jobType: 'dryhire' });

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('dryhire-folder-id')}/view/simple-element/header`
    );
    expect(getProxyMock()).not.toHaveBeenCalled();
  });

  it('falls back to simple element for tourdate job with tourdate hint', async () => {
    const node: FlexTreeNode = {
      nodeId: 'tourdate-folder-id',
      viewHint: 'tourdate-folder',
    };

    const url = await resolveFlexUrl(node, { jobType: 'tourdate' });

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#element/${encodeURIComponent('tourdate-folder-id')}/view/simple-element/header`
    );
    expect(getProxyMock()).not.toHaveBeenCalled();
  });

  it('fetches metadata when schema cannot be determined and applies headers', async () => {
    const node: FlexTreeNode = {
      nodeId: 'metadata-id',
    };

    getProxyMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: async () => ({
        domainId: { data: 'fin-doc' },
        elementDefinitionId: { data: FLEX_FOLDER_IDS.presupuesto },
      }),
      text: async () => '',
    });

    const url = await resolveFlexUrl(node);

    expect(url).toBe(
      `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent('metadata-id')}/doc-view/${FLEX_VIEW_IDS.FIN_DOC}/header`
    );

    expect(getProxyMock()).toHaveBeenCalledWith(
      '/element/metadata-id/key-info/',
      { method: 'GET' },
    );
  });

  it('returns null when schema cannot be determined even after metadata fetch', async () => {
    const node: FlexTreeNode = {
      nodeId: 'unknown-id',
    };

    getProxyMock().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      headers: new Headers(),
      json: async () => ({}),
      text: async () => '',
    });

    const url = await resolveFlexUrl(node, { jobType: 'single' });

    expect(url).toBeNull();
  });
});
