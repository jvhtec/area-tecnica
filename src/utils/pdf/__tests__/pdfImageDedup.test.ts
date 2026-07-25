import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { deduplicateContextImages } from '@/utils/pdf/pdfImageDedup';
import { mergePDFs } from '@/utils/pdf/pdfMerge';

/**
 * A PNG with an alpha channel, so pdf-lib embeds it as an image plus a soft
 * mask — the same shape as a real festival logo, which is what makes the
 * duplication expensive.
 */
const makePng = (seed: number, alphaSeed = seed): Uint8Array => {
  const size = 24;
  const raw: number[] = [];
  for (let y = 0; y < size; y += 1) {
    raw.push(0); // filter byte per scanline
    for (let x = 0; x < size; x += 1) {
      // Colour comes from `seed`, the alpha channel from `alphaSeed`, so tests
      // can vary the image and its soft mask independently.
      const alpha = (x + alphaSeed) % 4 < 2 ? 255 : 128;
      raw.push((x * seed) % 256, (y * seed) % 256, ((x + y) * seed) % 256, alpha);
    }
  }

  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  const crc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Uint8Array): number[] => {
    const typeBytes = [...type].map((character) => character.charCodeAt(0));
    const body = new Uint8Array([...typeBytes, ...data]);
    const length = data.length;
    const crc = crc32(body);
    return [
      (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff,
      ...body,
      (crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff,
    ];
  };

  // Stored (uncompressed) deflate blocks keep this dependency-free.
  const zlib: number[] = [0x78, 0x01];
  for (let offset = 0; offset < raw.length; offset += 0xffff) {
    const slice = raw.slice(offset, offset + 0xffff);
    const isLast = offset + 0xffff >= raw.length ? 1 : 0;
    zlib.push(isLast, slice.length & 0xff, (slice.length >>> 8) & 0xff,
      ~slice.length & 0xff, (~slice.length >>> 8) & 0xff, ...slice);
  }
  let adlerA = 1;
  let adlerB = 0;
  for (const byte of raw) {
    adlerA = (adlerA + byte) % 65521;
    adlerB = (adlerB + adlerA) % 65521;
  }
  zlib.push((adlerB >>> 8) & 0xff, adlerB & 0xff, (adlerA >>> 8) & 0xff, adlerA & 0xff);

  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', new Uint8Array([0, 0, 0, size, 0, 0, 0, size, 8, 6, 0, 0, 0])),
    ...chunk('IDAT', new Uint8Array(zlib)),
    ...chunk('IEND', new Uint8Array()),
  ]);
};

const countImages = async (blob: Blob): Promise<number> => {
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  let images = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (
      object instanceof PDFRawStream &&
      object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')
    ) {
      images += 1;
    }
  }
  return images;
};

const documentWithLogo = async (png: Uint8Array, pages = 1): Promise<Blob> => {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(png);
  for (let index = 0; index < pages; index += 1) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 40, y: 700, width: 80, height: 80 });
  }
  return new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' });
};

describe('merged bundle image deduplication', () => {
  it('keeps one copy of a logo embedded by every source document', async () => {
    const logo = makePng(7);
    const sources = await Promise.all(Array.from({ length: 8 }, () => documentWithLogo(logo)));

    const withoutDedup = await mergePDFs(sources, { deduplicateImages: false });
    const merged = await mergePDFs(sources);

    // A PNG with alpha embeds as an image plus its soft mask.
    expect(await countImages(withoutDedup)).toBe(16);
    expect(await countImages(merged)).toBe(2);
  });

  it('makes the bundle smaller rather than just tidier', async () => {
    const logo = makePng(3);
    const sources = await Promise.all(Array.from({ length: 8 }, () => documentWithLogo(logo)));

    const withoutDedup = await mergePDFs(sources, { deduplicateImages: false });
    const merged = await mergePDFs(sources);

    expect(merged.size).toBeLessThan(withoutDedup.size / 2);
  });

  it('does not merge images that only look alike', async () => {
    const sources = await Promise.all([
      documentWithLogo(makePng(3)),
      documentWithLogo(makePng(5)),
      documentWithLogo(makePng(3)),
    ]);

    const merged = await mergePDFs(sources);

    // Two distinct images survive, each with its own soft mask.
    expect(await countImages(merged)).toBe(4);
  });

  it('shares a soft mask between images that genuinely have the same one', async () => {
    // Same alpha channel, different colour: the masks collapse, the images do not.
    const sources = await Promise.all([
      documentWithLogo(makePng(2, 9)),
      documentWithLogo(makePng(4, 9)),
    ]);

    const merged = await mergePDFs(sources);

    expect(await countImages(merged)).toBe(3);
  });

  it('leaves every page still drawing its image', async () => {
    const logo = makePng(11);
    const sources = await Promise.all([
      documentWithLogo(logo, 2),
      documentWithLogo(logo, 3),
    ]);

    const merged = await mergePDFs(sources);
    const doc = await PDFDocument.load(await merged.arrayBuffer());

    expect(doc.getPageCount()).toBe(5);
    for (const page of doc.getPages()) {
      const resources = page.node.Resources();
      const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), (
        await import('pdf-lib')
      ).PDFDict);
      expect(xObjects?.keys().length).toBeGreaterThan(0);
    }
  });

  it('is a no-op on a document with nothing to collapse', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);

    const result = deduplicateContextImages(doc.context);

    expect(result).toEqual({ kept: 0, removed: 0 });
  });
});
