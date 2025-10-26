import { describe, it, expect } from 'vitest';
import { buildFlexUrlByIntent } from '../urlBuilder';
import { FLEX_CONFIG } from '../config';

describe('buildFlexUrlByIntent', () => {
  it('should build simple-element URL', () => {
    const url = buildFlexUrlByIntent('simple-element', 'test-id');
    expect(url).toContain('#element/test-id/view/simple-element/detail');
    expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
  });

  it('should build fin-doc URL', () => {
    const url = buildFlexUrlByIntent('fin-doc', 'test-id');
    expect(url).toContain('#fin-doc/test-id/doc-view/');
    expect(url).toContain('/detail');
    expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
  });

  it('should build expense-sheet URL', () => {
    const url = buildFlexUrlByIntent('expense-sheet', 'test-id');
    expect(url).toBe(
      `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/test-id/doc-view/${FLEX_CONFIG.viewIds.expenseSheet}/detail`
    );
  });

  it('should build contact-list URL', () => {
    const url = buildFlexUrlByIntent('contact-list', 'test-id');
    expect(url).toContain('#element/test-id/view/contact-list/detail');
    expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
  });

  it('should build equipment-list URL', () => {
    const url = buildFlexUrlByIntent('equipment-list', 'test-id');
    expect(url).toContain('#element/test-id/view/equipment-list/detail');
    expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
  });

  it('should build remote-file-list URL', () => {
    const url = buildFlexUrlByIntent('remote-file-list', 'test-id');
    expect(url).toContain('#element/test-id/view/remote-file-list/detail');
    expect(url).toContain('https://sectorpro.flexrentalsolutions.com');
  });

  it('should accept custom viewId for fin-doc', () => {
    const customViewId = 'custom-view-id';
    const url = buildFlexUrlByIntent('fin-doc', 'test-id', customViewId);
    expect(url).toContain(`#fin-doc/test-id/doc-view/${customViewId}/detail`);
  });

  it('should accept custom viewId for contact-list', () => {
    const customViewId = 'custom-view-id';
    const url = buildFlexUrlByIntent('contact-list', 'test-id', customViewId);
    expect(url).toContain(`#element/test-id/view/${customViewId}/detail`);
  });

  it('should throw error for empty elementId', () => {
    expect(() => buildFlexUrlByIntent('simple-element', '')).toThrow('Invalid elementId');
  });

  it('should throw error for null elementId', () => {
    expect(() => buildFlexUrlByIntent('simple-element', null as any)).toThrow('Invalid elementId');
  });

  it('should throw error for undefined elementId', () => {
    expect(() => buildFlexUrlByIntent('simple-element', undefined as any)).toThrow('Invalid elementId');
  });

  it('should throw error for whitespace-only elementId', () => {
    expect(() => buildFlexUrlByIntent('simple-element', '   ')).toThrow('Invalid elementId');
  });
});
