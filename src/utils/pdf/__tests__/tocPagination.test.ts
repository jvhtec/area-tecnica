import { describe, expect, it } from 'vitest';
import { generateTableOfContents, type TocSection } from '@/utils/pdf/tocGenerator';

/**
 * The page number printed on a page must be the page number in the contents.
 * These cover the offsets that produce it: the cover, the contents itself, and
 * the divider that opens each section.
 */
describe('table of contents pagination', () => {
  const sections: TocSection[] = [
    { title: 'Turnos de personal', pageCount: 3, hasDivider: true },
    { title: 'Programa del día', pageCount: 2, hasDivider: true },
    {
      title: 'Fichas de artista',
      pageCount: 4,
      hasDivider: true,
      children: [
        { title: 'Artista A', pageCount: 2 },
        { title: 'Artista B', pageCount: 2 },
      ],
    },
  ];

  it('starts the first section after the cover and the contents', async () => {
    const { links, pageCount } = await generateTableOfContents(sections);

    // Cover is page 1, the contents occupies the next `pageCount` pages.
    expect(links[0].targetPage).toBe(1 + pageCount + 1);
  });

  it('advances each section by its own page count plus its divider', async () => {
    const { links, pageCount } = await generateTableOfContents(sections);
    const targets = links.map((link) => link.targetPage);
    const first = 1 + pageCount + 1;

    // Section 1: divider + 3 pages. Section 2: divider + 2. Section 3 follows.
    expect(targets).toContain(first);
    expect(targets).toContain(first + 4);
    expect(targets).toContain(first + 4 + 3);
  });

  it('points a child at the page after its section divider', async () => {
    const { links, pageCount } = await generateTableOfContents(sections);
    const artistSectionStart = 1 + pageCount + 1 + (3 + 1) + (2 + 1);

    // The first artist begins one page after the divider that opens the section.
    expect(links).toContainEqual(
      expect.objectContaining({ targetPage: artistSectionStart + 1 }),
    );
    // The second artist follows the first artist's two pages.
    expect(links).toContainEqual(
      expect.objectContaining({ targetPage: artistSectionStart + 3 }),
    );
  });

  it('counts the divider when sizing the whole bundle', async () => {
    const { links, pageCount } = await generateTableOfContents(sections);
    const lastSectionTarget = Math.max(
      ...links.filter((link) => link.height === 17).map((link) => link.targetPage),
    );

    // Three sections, each opened by a divider, after the cover and contents.
    expect(lastSectionTarget).toBe(1 + pageCount + 1 + (3 + 1) + (2 + 1));
  });

  it('never points past the end of the bundle', async () => {
    const { links, pageCount } = await generateTableOfContents(sections);
    const bundlePages =
      1 + pageCount + sections.reduce((total, section) => total + section.pageCount + 1, 0);

    for (const link of links) {
      expect(link.targetPage).toBeGreaterThan(0);
      expect(link.targetPage).toBeLessThanOrEqual(bundlePages);
    }
  });

  it('produces a contents page even when there is nothing to list', async () => {
    const { blob, links, pageCount } = await generateTableOfContents([]);

    expect(pageCount).toBe(1);
    expect(links).toEqual([]);
    expect(blob.size).toBeGreaterThan(0);
  });
});
