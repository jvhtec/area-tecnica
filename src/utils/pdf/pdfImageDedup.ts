import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';

/**
 * Cross-document image deduplication for merged PDFs.
 *
 * The festival bundle is assembled by concatenating independently generated
 * documents, so the festival logo arrives once per source document — around
 * thirty copies of the same raw bitmap, each with its own soft mask. Nothing
 * about the merge notices they are identical.
 *
 * This pass hashes every image XObject, keeps one copy of each distinct image,
 * repoints every reference at it and deletes the rest.
 */

/**
 * Two independent 32-bit FNV-1a lanes, kept in Number space.
 *
 * This runs over whole image bitmaps — megabytes per bundle — on the same
 * thread that is generating the document, so it stays in `Math.imul` rather
 * than allocating a BigInt per byte. Combined with the byte length in the key,
 * two lanes are ample for telling embedded images apart.
 */
const hashBytes = (bytes: Uint8Array): string => {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const byte of bytes) {
    a = Math.imul(a ^ byte, 0x01000193) >>> 0;
    b = Math.imul(b ^ byte, 0x85ebca6b) >>> 0;
  }
  return `${bytes.length}:${a.toString(16)}:${b.toString(16)}`;
};

/**
 * Serialises a value into a comparison key, resolving references so that two
 * images differing only in object numbers still compare equal. Streams are
 * hashed by content, which is what makes duplicate soft masks match.
 */
const canonicalKey = (
  context: PDFContext,
  value: PDFObject | undefined,
  depth = 0,
  cache?: Map<string, string>,
): string => {
  if (!value) return 'null';
  if (depth > 4) return 'deep';

  if (value instanceof PDFRef) {
    const cached = cache?.get(value.toString());
    if (cached !== undefined) return cached;
    const key = canonicalKey(context, context.lookup(value), depth + 1, cache);
    cache?.set(value.toString(), key);
    return key;
  }
  if (value instanceof PDFRawStream) {
    return `stream(${canonicalKey(context, value.dict, depth + 1, cache)},${hashBytes(value.getContents())})`;
  }
  if (value instanceof PDFStream) {
    return `stream(${value.toString()})`;
  }
  if (value instanceof PDFArray) {
    return `[${value.asArray().map((entry) => canonicalKey(context, entry, depth + 1, cache)).join(',')}]`;
  }
  if (value instanceof PDFDict) {
    return `<<${[...value.entries()]
      .map(([key, entry]) => `${key.toString()} ${canonicalKey(context, entry, depth + 1, cache)}`)
      .sort()
      .join(' ')}>>`;
  }

  return value.toString();
};

const isImageStream = (object: PDFObject): object is PDFRawStream =>
  object instanceof PDFRawStream &&
  object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image');

/** Rewrites references inside a container, in place. Refs are not followed. */
const rewriteReferences = (
  container: PDFObject,
  replacements: Map<string, PDFRef>,
): void => {
  if (container instanceof PDFStream) {
    rewriteReferences(container.dict, replacements);
    return;
  }

  if (container instanceof PDFArray) {
    container.asArray().forEach((entry, index) => {
      if (entry instanceof PDFRef) {
        const replacement = replacements.get(entry.toString());
        if (replacement) container.set(index, replacement);
      } else if (entry instanceof PDFDict || entry instanceof PDFArray) {
        rewriteReferences(entry, replacements);
      }
    });
    return;
  }

  if (container instanceof PDFDict) {
    for (const [key, entry] of container.entries()) {
      if (entry instanceof PDFRef) {
        const replacement = replacements.get(entry.toString());
        if (replacement) container.set(key, replacement);
      } else if (entry instanceof PDFDict || entry instanceof PDFArray) {
        rewriteReferences(entry, replacements);
      }
    }
  }
};

export interface ImageDedupResult {
  /** Distinct images kept. */
  kept: number;
  /** Duplicate image objects removed. */
  removed: number;
}

/**
 * Collapses duplicate image XObjects in a loaded document, in place.
 *
 * Runs repeatedly until it settles: deduplicating soft masks can make two
 * base images that previously differed become identical, so one pass is not
 * always enough.
 */
export const deduplicateContextImages = (context: PDFContext): ImageDedupResult => {
  let removed = 0;
  let kept = 0;

  for (let pass = 0; pass < 3; pass += 1) {
    // Refs are remapped between passes, so the cache is per pass.
    const keyCache = new Map<string, string>();
    const canonical = new Map<string, PDFRef>();
    const replacements = new Map<string, PDFRef>();
    const duplicates: PDFRef[] = [];

    for (const [ref, object] of context.enumerateIndirectObjects()) {
      if (!isImageStream(object)) continue;

      const key = canonicalKey(context, object, 0, keyCache);
      const existing = canonical.get(key);
      if (existing) {
        replacements.set(ref.toString(), existing);
        duplicates.push(ref);
      } else {
        canonical.set(key, ref);
      }
    }

    kept = canonical.size;
    if (duplicates.length === 0) break;

    for (const [, object] of context.enumerateIndirectObjects()) {
      rewriteReferences(object, replacements);
    }

    for (const ref of duplicates) {
      context.delete(ref);
    }

    removed += duplicates.length;
  }

  return { kept, removed };
};
