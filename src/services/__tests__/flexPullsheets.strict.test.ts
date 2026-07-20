import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flexApiFetch } from '@/lib/flex-api-client';
import {
  FLEX_CATEGORY_MAP,
  pushEquipmentToFlexDocumentStrict,
} from '../flexPullsheets';

vi.mock('@/lib/flex-api-client', () => ({ flexApiFetch: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const response = (ok: boolean, lineItemId?: string) => ({
  ok,
  status: ok ? 200 : 500,
  statusText: ok ? 'OK' : 'Error',
  headers: new Headers(),
  json: vi.fn().mockResolvedValue(lineItemId ? { addedResourceLineIds: [lineItemId] } : {}),
  text: vi.fn().mockResolvedValue(ok ? '' : 'upstream failed'),
});

describe('pushEquipmentToFlexDocumentStrict', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a Pull Sheet header before children and passes its line ID as parent', async () => {
    vi.mocked(flexApiFetch)
      .mockResolvedValueOnce(response(true, 'main-header'))
      .mockResolvedValueOnce(response(true, 'k2-line'));

    const result = await pushEquipmentToFlexDocumentStrict(
      { elementId: 'pullsheet-1', documentType: 'pullsheet' },
      [{ resourceId: 'k2-resource', quantity: 24, name: 'K2', flexCategoryKey: 'pa_mains' }],
    );

    expect(flexApiFetch).toHaveBeenNthCalledWith(
      1,
      `/line-item/pullsheet-1/add-resource/${FLEX_CATEGORY_MAP.get('pa_mains')}`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(flexApiFetch).toHaveBeenNthCalledWith(
      2,
      '/line-item/pullsheet-1/add-resource/k2-resource',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('parentLineItemId=main-header'),
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      groupsCreated: ['pa_mains'],
      equipmentLinesAdded: 1,
      totalQuantitiesRepresented: 24,
    }));
  });

  it('uses the financial-document transport for Presupuestos', async () => {
    vi.mocked(flexApiFetch)
      .mockResolvedValueOnce(response(true, 'amp-header'))
      .mockResolvedValueOnce(response(true, 'amp-line'));

    await pushEquipmentToFlexDocumentStrict(
      { elementId: 'quote-1', documentType: 'presupuesto' },
      [{ resourceId: 'amp-resource', quantity: 3, name: 'LA12X', flexCategoryKey: 'pa_amp' }],
    );

    expect(vi.mocked(flexApiFetch).mock.calls[0][0]).toMatch(
      /^\/financial-document-line-item\/quote-1\/add-resource\//,
    );
    expect(vi.mocked(flexApiFetch).mock.calls[1][0]).toContain(
      '/financial-document-line-item/quote-1/add-resource/amp-resource?',
    );
    expect(vi.mocked(flexApiFetch).mock.calls[1][1]?.body).toContain(
      'parentLineItemId=amp-header',
    );
  });

  it('never sends children to root when their category header fails', async () => {
    vi.mocked(flexApiFetch).mockResolvedValueOnce(response(false));

    const result = await pushEquipmentToFlexDocumentStrict(
      { elementId: 'pullsheet-1', documentType: 'pullsheet' },
      [{ resourceId: 'sub-resource', quantity: 12, name: 'KS28', flexCategoryKey: 'pa_subs' }],
    );

    expect(flexApiFetch).toHaveBeenCalledTimes(1);
    expect(result.groupsFailed).toHaveLength(1);
    expect(result.childrenSkippedBecauseParentFailed).toEqual([
      expect.objectContaining({ name: 'KS28', flexCategoryKey: 'pa_subs' }),
    ]);
    expect(result.equipmentLinesAdded).toBe(0);
  });

  it('continues independent groups after one parent failure', async () => {
    vi.mocked(flexApiFetch)
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true, 'amp-header'))
      .mockResolvedValueOnce(response(true, 'amp-line'));

    const result = await pushEquipmentToFlexDocumentStrict(
      { elementId: 'pullsheet-1', documentType: 'pullsheet' },
      [
        { resourceId: 'k2-resource', quantity: 2, name: 'K2', flexCategoryKey: 'pa_mains' },
        { resourceId: 'amp-resource', quantity: 1, name: 'LA12X', flexCategoryKey: 'pa_amp' },
      ],
    );

    expect(result.groupsFailed).toHaveLength(1);
    expect(result.groupsCreated).toEqual(['pa_amp']);
    expect(result.equipmentLinesAdded).toBe(1);
  });

  it('aggregates only within category plus resource and creates no empty headers', async () => {
    vi.mocked(flexApiFetch)
      .mockResolvedValueOnce(response(true, 'main-header'))
      .mockResolvedValueOnce(response(true, 'main-child'))
      .mockResolvedValueOnce(response(true, 'out-header'))
      .mockResolvedValueOnce(response(true, 'out-child'));

    const result = await pushEquipmentToFlexDocumentStrict(
      { elementId: 'pullsheet-1', documentType: 'pullsheet' },
      [
        { resourceId: 'k2-resource', quantity: 2, name: 'K2 L', flexCategoryKey: 'pa_mains' },
        { resourceId: 'k2-resource', quantity: 3, name: 'K2 R', flexCategoryKey: 'pa_mains' },
        { resourceId: 'k2-resource', quantity: 1, name: 'K2 Out', flexCategoryKey: 'pa_outfill' },
      ],
    );

    expect(flexApiFetch).toHaveBeenCalledTimes(4);
    expect(result.equipmentLinesAdded).toBe(2);
    expect(result.totalQuantitiesRepresented).toBe(6);
    expect(vi.mocked(flexApiFetch).mock.calls[1][1]?.body).toContain('quantity=5');
  });
});
