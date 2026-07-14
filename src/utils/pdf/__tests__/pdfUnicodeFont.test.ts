import type jsPDF from 'jspdf';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerPdfUnicodeFont } from '@/utils/pdf/pdfUnicodeFont';

describe('PDF Unicode electrical notation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the static font for report text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
    });
    vi.stubGlobal('fetch', fetchMock);

    const addFileToVFS = vi.fn();
    const addFont = vi.fn();
    const doc = { addFileToVFS, addFont } as unknown as jsPDF;

    await expect(registerPdfUnicodeFont(doc)).resolves.toBe('NotoSansPdf');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(addFileToVFS).toHaveBeenCalledTimes(1);
    expect(addFont).toHaveBeenCalledWith(
      'NotoSansPdf.ttf',
      'NotoSansPdf',
      'normal',
    );
  });

  it('falls back when the font asset cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const doc = { addFileToVFS: vi.fn(), addFont: vi.fn() } as unknown as jsPDF;

    await expect(registerPdfUnicodeFont(doc)).resolves.toBeNull();
    expect(doc.addFont).not.toHaveBeenCalled();
  });

});
