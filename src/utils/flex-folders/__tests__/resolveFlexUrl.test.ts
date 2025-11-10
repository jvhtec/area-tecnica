import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFlexUrl } from '../resolveFlexUrl';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('resolveFlexUrl (schema hints)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { X_AUTH_TOKEN: 'token' },
      error: null,
    });
  });

  it('bypasses Supabase when schemaId provides a strong hint', async () => {
    const url = await resolveFlexUrl({
      elementId: 'fin-doc-id',
      context: {
        schemaId: 'fin_doc',
      },
    });

    expect(url).toContain('#fin-doc/');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
