// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { festivalGeometry } from '@/utils/pdf/festival-report/tokens';

describe('festivalGeometry', () => {
  // jsPDF's A4 is 297.00008 mm tall, so deriving the footer from the page edge
  // moves these by 83 nanometres. Two decimals is 0.01 mm — far finer than any
  // press — and still proves the shipped layout did not shift.
  it('keeps the shipped A4 values', () => {
    const portrait = festivalGeometry(new jsPDF());
    expect(portrait.contentBottom).toBeCloseTo(272, 2);
    expect(portrait.footerRuleY).toBeCloseTo(278.5, 2);
    expect(portrait.footerTextY).toBeCloseTo(282, 2);
    expect(portrait.mm).toBe(1);

    const landscape = festivalGeometry(new jsPDF({ orientation: 'landscape' }));
    expect(landscape.contentBottom).toBeCloseTo(186, 2);
    expect(landscape.footerRuleY).toBeCloseTo(192, 2);
    expect(landscape.footerTextY).toBeCloseTo(195.5, 2);
    expect(landscape.mm).toBe(1);
  });

  it('follows the sheet on A3, instead of pinning the footer to A4', () => {
    const a3 = festivalGeometry(new jsPDF('landscape', 'mm', [420, 297]));
    expect(a3.mm).toBe(1);
    expect(a3.pageHeight).toBeCloseTo(297, 2);
    expect(a3.contentBottom).toBeCloseTo(273, 2);
    expect(a3.footerTextY).toBeCloseTo(282.5, 2);
  });
});
