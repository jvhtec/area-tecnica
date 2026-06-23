import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flexApiFetch } from '@/lib/flex-api-client';
import { resolveFlexUrl } from '../resolveFlexUrl';

vi.mock('@/lib/flex-api-client', () => ({
  flexApiFetch: vi.fn(),
}));

describe('resolveFlexUrl (schema hints)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bypasses Supabase when schemaId provides a strong hint', async () => {
    const url = await resolveFlexUrl({
      elementId: 'fin-doc-id',
      context: {
        schemaId: 'fin_doc',
      },
    });

    expect(url).toContain('#fin-doc/');
    expect(flexApiFetch).not.toHaveBeenCalled();
  });
});
