import { describe, expect, it, vi } from 'vitest';

import { PDFDocument } from '../pdf-document';

describe('PDFDocument', () => {
  it('wraps text lines and advances vertical position for each wrapped segment', () => {
    const pdfDoc = new PDFDocument();
    const splitSpy = vi
      .spyOn(pdfDoc, 'splitText')
      .mockReturnValueOnce(['first segment', 'second segment']);
    const addTextSpy = vi.spyOn(pdfDoc, 'addText').mockImplementation(() => undefined);

    const nextY = pdfDoc.addWrappedLines(['long text'], 30, 100, { lineHeight: 6 });

    expect(splitSpy.mock.calls[0][0]).toBe('long text');
    expect(splitSpy.mock.calls[0][1]).toBeCloseTo(160, 2);
    expect(addTextSpy).toHaveBeenNthCalledWith(1, 'first segment', 30, 100, undefined);
    expect(addTextSpy).toHaveBeenNthCalledWith(2, 'second segment', 30, 106, undefined);
    expect(nextY).toBe(112);
  });
});
